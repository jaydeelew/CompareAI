from fastapi import FastAPI, HTTPException, Request, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Any
from .model_runner import run_models, call_openrouter_streaming, clean_model_response, OPENROUTER_MODELS, MODELS_BY_PROVIDER
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
import asyncio
import os
import json
from collections import defaultdict
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Import authentication modules
from .database import get_db, Base, engine
from .models import User, UsageLog
from .dependencies import get_current_user
from .rate_limiting import (
    check_user_rate_limit,
    increment_user_usage,
    check_anonymous_rate_limit,
    increment_anonymous_usage,
    get_user_usage_stats,
    get_anonymous_usage_stats,
    get_model_limit,
    is_overage_allowed,
    get_overage_price,
    anonymous_rate_limit_storage,
    check_extended_tier_limit,
    increment_extended_usage,
    check_anonymous_extended_limit,
    increment_anonymous_extended_usage,
    decrement_extended_usage,
    decrement_anonymous_extended_usage,
)
from .routers import auth, admin

# Tier configuration
TIER_LIMITS = {
    "brief": {"input_chars": 1000, "output_tokens": 2000},
    "standard": {"input_chars": 5000, "output_tokens": 4000},
    "extended": {"input_chars": 15000, "output_tokens": 8192},
}

# Extended tier daily limits per subscription tier
EXTENDED_TIER_LIMITS = {"anonymous": 2, "free": 5, "starter": 10, "starter_plus": 20, "pro": 40, "pro_plus": 80}


def validate_tier_limits(input_data: str, tier: str) -> bool:
    """Validate input length against tier limits"""
    if tier not in TIER_LIMITS:
        return False
    return len(input_data) <= TIER_LIMITS[tier]["input_chars"]


def get_tier_max_tokens(tier: str) -> int:
    """Get max tokens for tier"""
    return TIER_LIMITS.get(tier, TIER_LIMITS["standard"])["output_tokens"]


print(f"Starting in {os.environ.get('ENVIRONMENT', 'production')} mode")

app = FastAPI(title="CompareAI API", version="1.0.0")


# Create database tables on startup
@app.on_event("startup")
async def startup_event():
    """
    Initialize database tables on application startup.
    PostgreSQL handles concurrent table creation safely.
    """
    try:
        Base.metadata.create_all(bind=engine, checkfirst=True)
        print("Database tables initialized successfully")
    except Exception as e:
        print(f"Database initialization error: {e}")
        # Let the application continue, as tables may already exist
        pass


# Add CORS middleware BEFORE including routers
# For development, allow all localhost origins
if os.environ.get("ENVIRONMENT") == "development":
    allowed_origins = ["*"]  # Allow all origins in development
else:
    allowed_origins = [
        "http://54.163.207.252",  # Your frontend URL
        "http://compareintel.com",  # Your frontend domain
        "https://localhost",  # HTTPS localhost (production-like dev)
        "https://localhost:443",  # HTTPS localhost with port
        "http://localhost:5173",  # For local development
        "http://localhost:5174",  # Alternative local port
        "http://localhost:3000",  # Alternative local port
        "http://127.0.0.1:5173",  # Alternative localhost
        "http://127.0.0.1:5174",  # Alternative localhost
        "http://127.0.0.1:3000",  # Alternative localhost
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include authentication router AFTER middleware
app.include_router(auth.router)
app.include_router(admin.router)

# Maximum number of models allowed per request
MAX_MODELS_PER_REQUEST = 9

# Rate limiting configuration
MAX_DAILY_COMPARISONS = 10

# In-memory storage for model performance tracking
model_stats: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"success": 0, "failure": 0, "last_error": None, "last_success": None})


def get_client_ip(request: Request) -> str:
    """Extract client IP address from request, handling proxies"""
    # Check for X-Forwarded-For header (common with proxies/load balancers)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Take the first IP if there are multiple
        return forwarded_for.split(",")[0].strip()

    # Check for X-Real-IP header
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()

    # Fall back to direct client connection
    if request.client:
        return request.client.host

    return "unknown"


def check_rate_limit(identifier: str) -> tuple[bool, int]:
    """
    Check if the identifier (IP or fingerprint) has exceeded the daily limit.
    Returns (is_allowed, current_count)
    """
    today = datetime.now().date().isoformat()
    user_data = rate_limit_storage[identifier]

    # Reset count if it's a new day
    if user_data["date"] != today:
        user_data["count"] = 0
        user_data["date"] = today
        user_data["first_seen"] = datetime.now()

    current_count = user_data["count"]
    is_allowed = current_count < MAX_DAILY_COMPARISONS

    return is_allowed, current_count


def increment_usage(identifier: str):
    """Increment the usage count for the identifier"""
    today = datetime.now().date().isoformat()
    user_data = rate_limit_storage[identifier]

    if user_data["date"] != today:
        user_data["count"] = 1
        user_data["date"] = today
        user_data["first_seen"] = datetime.now()
    else:
        user_data["count"] += 1


class ConversationMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class CompareRequest(BaseModel):
    input_data: str
    models: list[str]
    conversation_history: list[ConversationMessage] = []  # Optional conversation context
    browser_fingerprint: Optional[str] = None  # Optional browser fingerprint for rate limiting
    tier: str = "standard"  # brief, standard, extended


class CompareResponse(BaseModel):
    results: dict[str, str]
    metadata: dict[str, Any]


@app.get("/")
async def root():
    return {"message": "CompareAI API is running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.post("/compare")
async def compare(
    req: CompareRequest, request: Request, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user)
) -> CompareResponse:
    """
    Compare AI models with hybrid rate limiting.

    Supports both authenticated users (subscription-based limits) and
    anonymous users (IP/fingerprint-based limits).
    """
    if not req.input_data.strip():
        raise HTTPException(status_code=400, detail="Input data cannot be empty")

    if not req.models:
        raise HTTPException(status_code=400, detail="At least one model must be selected")

    # Validate tier limits
    if not validate_tier_limits(req.input_data, req.tier):
        tier_limit = TIER_LIMITS[req.tier]["input_chars"]
        raise HTTPException(
            status_code=400,
            detail=f"Input exceeds {req.tier} tier limit of {tier_limit} characters. Current: {len(req.input_data)} characters.",
        )

    # Determine model limit based on user tier
    if current_user:
        tier_model_limit = get_model_limit(current_user.subscription_tier)
        tier_name = current_user.subscription_tier
    else:
        tier_model_limit = 3  # Anonymous users get 3 models max
        tier_name = "anonymous"

    # Enforce tier-specific model limit
    if len(req.models) > tier_model_limit:
        upgrade_message = ""
        if tier_name == "anonymous":
            upgrade_message = " Register for a free account to compare up to 3 models."
        elif tier_name == "free":
            upgrade_message = " Upgrade to Starter for 6 models or Pro for 9 models."
        elif tier_name in ["starter", "starter_plus"]:
            upgrade_message = " Upgrade to Pro for 9 models."

        raise HTTPException(
            status_code=400,
            detail=f"Your {tier_name} tier allows maximum {tier_model_limit} models per comparison. You selected {len(req.models)} models.{upgrade_message}",
        )

    # Get number of models for usage tracking
    num_models = len(req.models)

    # --- HYBRID RATE LIMITING ---
    client_ip = get_client_ip(request)

    is_overage = False
    overage_charge = 0.0

    if current_user:
        # Authenticated user - check subscription tier limits (model response based)
        is_allowed, usage_count, daily_limit = check_user_rate_limit(current_user, db)

        # Check if user has enough model responses remaining
        if usage_count + num_models > daily_limit:
            models_needed = num_models
            models_over_limit = (usage_count + num_models) - daily_limit

            # Check if overage is allowed for this tier
            if is_overage_allowed(current_user.subscription_tier):
                # Overage allowed but pricing not yet implemented
                # For now, allow the request but track it
                is_overage = True
                overage_charge = 0.0  # Pricing TBD

                # Track overage model responses for future billing
                current_user.monthly_overage_count += models_over_limit

                print(f"Authenticated user {current_user.email} - Using {models_over_limit} overage model responses (pricing TBD)")
            else:
                # Free tier - no overages allowed
                models_available = max(0, daily_limit - usage_count)
                raise HTTPException(
                    status_code=429,
                    detail=f"Daily limit of {daily_limit} model responses exceeded. You have {models_available} remaining and need {models_needed}. "
                    f"Upgrade to Starter (150/day) or Pro (450/day) for more capacity and overage options.",
                )

        # Increment authenticated user usage by number of models
        increment_user_usage(current_user, db, count=num_models)

        if is_overage:
            print(
                f"Authenticated user {current_user.email} - Overage: {current_user.monthly_overage_count} model responses this month"
            )
        else:
            print(f"Authenticated user {current_user.email} - Usage: {usage_count + num_models}/{daily_limit} model responses")
    else:
        # Anonymous user - check IP/fingerprint limits (model response based)
        ip_allowed, ip_count = check_anonymous_rate_limit(f"ip:{client_ip}")

        fingerprint_allowed = True
        fingerprint_count = 0
        if req.browser_fingerprint:
            fingerprint_allowed, fingerprint_count = check_anonymous_rate_limit(f"fp:{req.browser_fingerprint}")

        # Check if user has enough model responses remaining
        if not ip_allowed or (req.browser_fingerprint and not fingerprint_allowed):
            models_available = max(0, 10 - max(ip_count, fingerprint_count))
            raise HTTPException(
                status_code=429,
                detail=f"Daily limit of 10 model responses exceeded. You have {models_available} remaining and need {num_models}. "
                f"Register for a free account (20 model responses/day) to continue.",
            )

        # Check if this request would exceed the limit
        if ip_count + num_models > 10 or (req.browser_fingerprint and fingerprint_count + num_models > 10):
            models_available = max(0, 10 - max(ip_count, fingerprint_count))
            raise HTTPException(
                status_code=429,
                detail=f"Daily limit would be exceeded. You have {models_available} model responses remaining and need {num_models}. "
                f"Register for a free account (20 model responses/day) to continue.",
            )

        # Increment anonymous usage by number of models
        increment_anonymous_usage(f"ip:{client_ip}", count=num_models)
        if req.browser_fingerprint:
            increment_anonymous_usage(f"fp:{req.browser_fingerprint}", count=num_models)
        print(f"Anonymous user - IP: {client_ip} ({ip_count + num_models}/10 model responses)")
    # --- END HYBRID RATE LIMITING ---

    # --- EXTENDED TIER LIMITING ---
    if req.tier == "extended":
        if current_user:
            # Check Extended tier limit for authenticated users
            extended_allowed, extended_count, extended_limit = check_extended_tier_limit(current_user, db)

            if not extended_allowed:
                raise HTTPException(
                    status_code=429,
                    detail=f"Daily Extended tier limit of {extended_limit} exceeded. You have used {extended_count} Extended interactions today. "
                    f"Upgrade to a higher tier for more Extended interactions.",
                )

            # Don't increment here - wait until we know requests succeeded
            print(f"Authenticated user {current_user.email} - Extended usage: {extended_count}/{extended_limit} (will increment after success)")
        else:
            # Check Extended tier limit for anonymous users
            ip_extended_allowed, ip_extended_count = check_anonymous_extended_limit(f"ip:{client_ip}")
            fingerprint_extended_allowed = True
            fingerprint_extended_count = 0

            if req.browser_fingerprint:
                fingerprint_extended_allowed, fingerprint_extended_count = check_anonymous_extended_limit(
                    f"fp:{req.browser_fingerprint}"
                )

            if not ip_extended_allowed or (req.browser_fingerprint and not fingerprint_extended_allowed):
                extended_available = max(0, 2 - max(ip_extended_count, fingerprint_extended_count))
                raise HTTPException(
                    status_code=429,
                    detail=f"Daily Extended tier limit of 2 exceeded. You have {extended_available} Extended interactions remaining. "
                    f"Register for a free account to get 5 Extended interactions per day.",
                )

            # Don't increment here - wait until we know requests succeeded
            print(f"Anonymous user - Extended usage: {max(ip_extended_count, fingerprint_extended_count)}/2 (will increment after success)")
    # --- END EXTENDED TIER LIMITING ---

    # Track start time for processing metrics
    start_time = datetime.now()

    try:
        loop = asyncio.get_running_loop()
        results = await loop.run_in_executor(None, run_models, req.input_data, req.models, req.tier, req.conversation_history)

        # Count successful vs failed models
        successful_models = 0
        failed_models = 0

        for model_id, result in results.items():
            current_time = datetime.now().isoformat()
            if result.startswith("Error:"):
                failed_models += 1
                model_stats[model_id]["failure"] += 1
                model_stats[model_id]["last_error"] = current_time
            else:
                successful_models += 1
                model_stats[model_id]["success"] += 1
                model_stats[model_id]["last_success"] = current_time

        # NOW increment extended usage - only for successful models in extended tier
        if req.tier == "extended" and successful_models > 0:
            if current_user:
                increment_extended_usage(current_user, db, count=successful_models)
                print(f"✓ Incremented extended usage for {current_user.email}: +{successful_models} successful models")
            else:
                increment_anonymous_extended_usage(f"ip:{client_ip}", count=successful_models)
                if req.browser_fingerprint:
                    increment_anonymous_extended_usage(f"fp:{req.browser_fingerprint}", count=successful_models)
                print(f"✓ Incremented anonymous extended usage: +{successful_models} successful models")

        # Calculate processing time
        processing_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)

        # Add metadata
        metadata = {
            "input_length": len(req.input_data),
            "models_requested": len(req.models),
            "models_successful": successful_models,
            "models_failed": failed_models,
            "timestamp": datetime.now().isoformat(),
            "processing_time_ms": processing_time_ms,
        }

        # Log usage to database
        usage_log = UsageLog(
            user_id=current_user.id if current_user else None,
            ip_address=client_ip,
            browser_fingerprint=req.browser_fingerprint,
            models_used=json.dumps(req.models),
            input_length=len(req.input_data),
            models_requested=len(req.models),
            models_successful=successful_models,
            models_failed=failed_models,
            processing_time_ms=processing_time_ms,
            estimated_cost=len(req.models) * 0.0166,  # Estimated cost per model
            is_overage=is_overage,
            overage_charge=overage_charge,
        )
        db.add(usage_log)
        db.commit()

        return CompareResponse(results=results, metadata=metadata)

    except Exception as e:
        error_msg = f"Error processing request: {str(e)}"
        print(f"Backend error: {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg)


@app.post("/compare-stream")
async def compare_stream(
    req: CompareRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    Streaming version of /compare endpoint using Server-Sent Events (SSE).

    Returns responses token-by-token as they arrive from OpenRouter for dramatically
    faster perceived response time (first tokens appear in ~500ms vs 6+ seconds).

    Supports all models from streaming-enabled providers:
    - OpenAI, Azure, Anthropic, Fireworks, Cohere, DeepSeek, XAI
    - Together, DeepInfra, Novita, OctoAI, Lepton, AnyScale
    - Mancer, Recursal, Hyperbolic, Infermatic, and more

    SSE Event Format:
    - data: {"model": "model-id", "type": "start"} - Model starting
    - data: {"model": "model-id", "type": "chunk", "content": "text"} - Token chunk
    - data: {"model": "model-id", "type": "done"} - Model complete
    - data: {"type": "complete", "metadata": {...}} - All models done
    - data: {"type": "error", "message": "..."} - Error occurred
    """
    # All the same validation as the regular compare endpoint
    if not req.input_data.strip():
        raise HTTPException(status_code=400, detail="Input data cannot be empty")

    if not req.models:
        raise HTTPException(status_code=400, detail="At least one model must be selected")

    # Validate tier limits
    if not validate_tier_limits(req.input_data, req.tier):
        tier_limit = TIER_LIMITS[req.tier]["input_chars"]
        raise HTTPException(
            status_code=400,
            detail=f"Input exceeds {req.tier} tier limit of {tier_limit} characters. Current: {len(req.input_data)} characters.",
        )

    # Determine model limit based on user tier
    if current_user:
        tier_model_limit = get_model_limit(current_user.subscription_tier)
        tier_name = current_user.subscription_tier
    else:
        tier_model_limit = 3  # Anonymous users get 3 models max
        tier_name = "anonymous"

    # Enforce tier-specific model limit
    if len(req.models) > tier_model_limit:
        upgrade_message = ""
        if tier_name == "anonymous":
            upgrade_message = " Register for a free account to compare up to 3 models."
        elif tier_name == "free":
            upgrade_message = " Upgrade to Starter for 6 models or Pro for 9 models."
        elif tier_name in ["starter", "starter_plus"]:
            upgrade_message = " Upgrade to Pro for 9 models."

        raise HTTPException(
            status_code=400,
            detail=f"Your {tier_name} tier allows maximum {tier_model_limit} models per comparison. You selected {len(req.models)} models.{upgrade_message}",
        )

    # Get number of models for usage tracking
    num_models = len(req.models)

    # --- HYBRID RATE LIMITING (same as regular endpoint) ---
    client_ip = get_client_ip(request)
    is_overage = False
    overage_charge = 0.0

    if current_user:
        is_allowed, usage_count, daily_limit = check_user_rate_limit(current_user, db)

        if usage_count + num_models > daily_limit:
            models_needed = num_models
            models_over_limit = (usage_count + num_models) - daily_limit

            if is_overage_allowed(current_user.subscription_tier):
                is_overage = True
                overage_charge = 0.0
                current_user.monthly_overage_count += models_over_limit
                print(f"Authenticated user {current_user.email} - Using {models_over_limit} overage model responses")
            else:
                models_available = max(0, daily_limit - usage_count)
                raise HTTPException(
                    status_code=429,
                    detail=f"Daily limit of {daily_limit} model responses exceeded. You have {models_available} remaining and need {models_needed}. "
                    f"Upgrade to Starter (150/day) or Pro (450/day) for more capacity.",
                )

        increment_user_usage(current_user, db, count=num_models)
        print(f"Authenticated user {current_user.email} - Usage: {usage_count + num_models}/{daily_limit} model responses")
    else:
        ip_allowed, ip_count = check_anonymous_rate_limit(f"ip:{client_ip}")
        fingerprint_allowed = True
        fingerprint_count = 0
        if req.browser_fingerprint:
            fingerprint_allowed, fingerprint_count = check_anonymous_rate_limit(f"fp:{req.browser_fingerprint}")

        if not ip_allowed or (req.browser_fingerprint and not fingerprint_allowed):
            models_available = max(0, 10 - max(ip_count, fingerprint_count))
            raise HTTPException(
                status_code=429,
                detail=f"Daily limit of 10 model responses exceeded. Register for a free account (20 model responses/day) to continue.",
            )

        if ip_count + num_models > 10 or (req.browser_fingerprint and fingerprint_count + num_models > 10):
            models_available = max(0, 10 - max(ip_count, fingerprint_count))
            raise HTTPException(
                status_code=429,
                detail=f"Daily limit would be exceeded. You have {models_available} model responses remaining and need {num_models}.",
            )

        increment_anonymous_usage(f"ip:{client_ip}", count=num_models)
        if req.browser_fingerprint:
            increment_anonymous_usage(f"fp:{req.browser_fingerprint}", count=num_models)
        print(f"Anonymous user - IP: {client_ip} ({ip_count + num_models}/10 model responses)")

    # --- EXTENDED TIER LIMITING (same as regular endpoint) ---
    if req.tier == "extended":
        if current_user:
            extended_allowed, extended_count, extended_limit = check_extended_tier_limit(current_user, db)
            if not extended_allowed:
                raise HTTPException(status_code=429, detail=f"Daily Extended tier limit of {extended_limit} exceeded.")
            # Don't increment here - wait until we know requests succeeded
            print(f"Authenticated user {current_user.email} - Extended usage: {extended_count}/{extended_limit} (will increment after success)")
        else:
            ip_extended_allowed, ip_extended_count = check_anonymous_extended_limit(f"ip:{client_ip}")
            fingerprint_extended_allowed = True
            fingerprint_extended_count = 0

            if req.browser_fingerprint:
                fingerprint_extended_allowed, fingerprint_extended_count = check_anonymous_extended_limit(
                    f"fp:{req.browser_fingerprint}"
                )

            if not ip_extended_allowed or (req.browser_fingerprint and not fingerprint_extended_allowed):
                raise HTTPException(
                    status_code=429,
                    detail=f"Daily Extended tier limit of 2 exceeded. Register for a free account to get 5 Extended interactions per day.",
                )

            # Don't increment here - wait until we know requests succeeded
            print(f"Anonymous user - Extended usage: {max(ip_extended_count, fingerprint_extended_count)}/2 (will increment after success)")

    # Track if this is an extended interaction (long conversation context)
    # Industry best practice 2025: Separately track context-heavy requests
    is_extended_interaction = False
    conversation_message_count = len(req.conversation_history) if req.conversation_history else 0
    
    # Consider it extended if conversation has more than 10 messages (5 exchanges)
    # This aligns with the context window cost threshold
    if conversation_message_count > 10:
        is_extended_interaction = True
        print(f"📊 Extended interaction detected: {conversation_message_count} messages in history")

    # Track start time for processing metrics
    start_time = datetime.now()

    async def generate_stream():
        """
        Generator function that yields SSE-formatted events.
        Streams responses from all requested models sequentially.
        """
        successful_models = 0
        failed_models = 0
        results_dict = {}

        try:
            # Stream each model's response
            for model_id in req.models:
                # Send start event for this model
                yield f"data: {json.dumps({'model': model_id, 'type': 'start'})}\n\n"

                model_content = ""
                model_error = False

                try:
                    # Stream the model response - run in executor to avoid blocking
                    chunk_count = 0
                    loop = asyncio.get_running_loop()
                    
                    # Check if mock mode is enabled for this user (admin/super-admin only)
                    use_mock = current_user and current_user.mock_mode_enabled if current_user else False
                    if use_mock:
                        print(f"🎭 Mock mode active for user {current_user.email}")

                    # Create the generator in a thread-safe way
                    def stream_chunks():
                        for chunk in call_openrouter_streaming(req.input_data, model_id, req.tier, req.conversation_history, use_mock):
                            yield chunk

                    # Process chunks as they arrive
                    for chunk in stream_chunks():
                        # Don't clean chunks during streaming - cleaning strips whitespace which breaks word boundaries!
                        # The chunk is sent exactly as received to preserve spaces between words
                        model_content += chunk
                        chunk_count += 1

                        # Send chunk event immediately
                        chunk_data = f"data: {json.dumps({'model': model_id, 'type': 'chunk', 'content': chunk})}\n\n"
                        yield chunk_data

                        # Yield control to event loop to ensure immediate sending
                        await asyncio.sleep(0)

                        # Log every 10th chunk for debugging
                        if chunk_count % 10 == 0:
                            print(f"📤 Streamed {chunk_count} chunks for {model_id}, total chars: {len(model_content)}")

                    # Clean the final accumulated content (after streaming is complete)
                    # This removes MathML junk and excessive whitespace
                    model_content = clean_model_response(model_content)
                    
                    # Check if response is an error
                    if model_content.startswith("Error:"):
                        failed_models += 1
                        model_error = True
                        model_stats[model_id]["failure"] += 1
                        model_stats[model_id]["last_error"] = datetime.now().isoformat()
                    else:
                        successful_models += 1
                        model_stats[model_id]["success"] += 1
                        model_stats[model_id]["last_success"] = datetime.now().isoformat()

                    results_dict[model_id] = model_content

                except Exception as e:
                    # Handle model-specific errors
                    error_msg = f"Error: {str(e)[:100]}"
                    results_dict[model_id] = error_msg
                    failed_models += 1
                    model_error = True
                    yield f"data: {json.dumps({'model': model_id, 'type': 'chunk', 'content': error_msg})}\n\n"

                # Send done event for this model
                yield f"data: {json.dumps({'model': model_id, 'type': 'done', 'error': model_error})}\n\n"

            # NOW increment extended usage - only for successful models in extended tier
            if req.tier == "extended" and successful_models > 0:
                if current_user:
                    increment_extended_usage(current_user, db, count=successful_models)
                    print(f"✓ Incremented extended usage for {current_user.email}: +{successful_models} successful models")
                else:
                    increment_anonymous_extended_usage(f"ip:{client_ip}", count=successful_models)
                    if req.browser_fingerprint:
                        increment_anonymous_extended_usage(f"fp:{req.browser_fingerprint}", count=successful_models)
                    print(f"✓ Incremented anonymous extended usage: +{successful_models} successful models")

            # Calculate processing time
            processing_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)

            # Build metadata
            metadata = {
                "input_length": len(req.input_data),
                "models_requested": len(req.models),
                "models_successful": successful_models,
                "models_failed": failed_models,
                "timestamp": datetime.now().isoformat(),
                "processing_time_ms": processing_time_ms,
                "conversation_message_count": conversation_message_count,
                "is_extended_interaction": is_extended_interaction,
            }

            # Log usage to database in background
            usage_log = UsageLog(
                user_id=current_user.id if current_user else None,
                ip_address=client_ip,
                browser_fingerprint=req.browser_fingerprint,
                models_used=json.dumps(req.models),
                input_length=len(req.input_data),
                models_requested=len(req.models),
                models_successful=successful_models,
                models_failed=failed_models,
                processing_time_ms=processing_time_ms,
                estimated_cost=len(req.models) * 0.0166,
                is_overage=is_overage,
                overage_charge=overage_charge,
            )
            background_tasks.add_task(log_usage_to_db, usage_log, db)

            # Send completion event with metadata
            yield f"data: {json.dumps({'type': 'complete', 'metadata': metadata})}\n\n"

        except Exception as e:
            # Send error event
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering for streaming
        },
    )


def log_usage_to_db(usage_log: UsageLog, db: Session):
    """Background task to log usage to database without blocking the response."""
    try:
        db.add(usage_log)
        db.commit()
    except Exception as e:
        print(f"Failed to log usage to database: {e}")
        db.rollback()


@app.get("/models")
async def get_available_models():
    return {"models": OPENROUTER_MODELS, "models_by_provider": MODELS_BY_PROVIDER}


@app.get("/model-stats")
async def get_model_stats():
    """Get success/failure statistics for all models"""
    stats = {}
    for model_id, data in model_stats.items():
        total_attempts = data["success"] + data["failure"]
        success_rate = (data["success"] / total_attempts * 100) if total_attempts > 0 else 0
        stats[model_id] = {
            "success_count": data["success"],
            "failure_count": data["failure"],
            "total_attempts": total_attempts,
            "success_rate": round(success_rate, 1),
            "last_error": data["last_error"],
            "last_success": data["last_success"],
        }
    return {"model_statistics": stats}


@app.get("/rate-limit-status")
async def get_rate_limit_status(
    request: Request, fingerprint: Optional[str] = None, current_user: Optional[User] = Depends(get_current_user)
):
    """
    Get current rate limit status for the client.

    Returns different information for authenticated vs anonymous users.
    """
    if current_user:
        # Authenticated user - return subscription-based usage
        usage_stats = get_user_usage_stats(current_user)
        return {
            **usage_stats,
            "authenticated": True,
            "email": current_user.email,
            "subscription_status": current_user.subscription_status,
        }
    else:
        # Anonymous user - return IP/fingerprint-based usage
        client_ip = get_client_ip(request)
        usage_stats = get_anonymous_usage_stats(f"ip:{client_ip}")

        result = {**usage_stats, "authenticated": False, "ip_address": client_ip}

        # Include fingerprint stats if provided
        if fingerprint:
            fp_stats = get_anonymous_usage_stats(f"fp:{fingerprint}")
            result["fingerprint_usage"] = fp_stats["daily_usage"]
            result["fingerprint_remaining"] = fp_stats["remaining_usage"]

        return result


@app.post("/dev/reset-rate-limit")
async def reset_rate_limit_dev(
    request: Request,
    fingerprint: Optional[str] = None,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    DEV ONLY: Reset rate limits for the current client.
    This endpoint should be disabled in production!
    """
    # Only allow in development mode
    if os.environ.get("ENVIRONMENT") != "development":
        raise HTTPException(status_code=403, detail="This endpoint is only available in development mode")

    client_ip = get_client_ip(request)

    # Reset authenticated user's usage if logged in
    if current_user:
        current_user.daily_usage_count = 0
        current_user.monthly_overage_count = 0
        current_user.daily_extended_usage = 0  # Reset extended interactions count
        db.commit()

    # Reset IP-based rate limit (use anonymous_rate_limit_storage from rate_limiting.py)
    ip_key = f"ip:{client_ip}"
    if ip_key in anonymous_rate_limit_storage:
        del anonymous_rate_limit_storage[ip_key]

    # Reset IP-based extended usage tracking
    ip_extended_key = f"ip:{client_ip}_extended"
    if ip_extended_key in anonymous_rate_limit_storage:
        del anonymous_rate_limit_storage[ip_extended_key]

    # Reset fingerprint-based rate limit if provided
    if fingerprint:
        fp_key = f"fp:{fingerprint}"
        if fp_key in anonymous_rate_limit_storage:
            del anonymous_rate_limit_storage[fp_key]

        # Reset fingerprint-based extended usage tracking
        fp_extended_key = f"fp:{fingerprint}_extended"
        if fp_extended_key in anonymous_rate_limit_storage:
            del anonymous_rate_limit_storage[fp_extended_key]

    return {"message": "Rate limits reset successfully", "ip_address": client_ip, "fingerprint_reset": fingerprint is not None}
