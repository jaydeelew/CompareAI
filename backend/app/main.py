from fastapi import FastAPI, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Any
from .model_runner import run_models, OPENROUTER_MODELS, MODELS_BY_PROVIDER
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
import asyncio
import os
import json
from collections import defaultdict
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

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
)
from .routers import auth, admin

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
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
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
    ],
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

    # Track start time for processing metrics
    start_time = datetime.now()

    try:
        loop = asyncio.get_running_loop()
        results = await loop.run_in_executor(None, run_models, req.input_data, req.models, req.conversation_history)

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
        db.commit()

    # Reset IP-based rate limit (use anonymous_rate_limit_storage from rate_limiting.py)
    ip_key = f"ip:{client_ip}"
    if ip_key in anonymous_rate_limit_storage:
        del anonymous_rate_limit_storage[ip_key]

    # Reset fingerprint-based rate limit if provided
    if fingerprint:
        fp_key = f"fp:{fingerprint}"
        if fp_key in anonymous_rate_limit_storage:
            del anonymous_rate_limit_storage[fp_key]

    return {"message": "Rate limits reset successfully", "ip_address": client_ip, "fingerprint_reset": fingerprint is not None}
