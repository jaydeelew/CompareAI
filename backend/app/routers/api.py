"""
Main API router for core application endpoints.

This module contains the main application endpoints like /models, /compare, etc.
that are used by the frontend for the core AI comparison functionality.
"""

from fastapi import APIRouter, Request, Depends, HTTPException, status, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from collections import defaultdict
from datetime import datetime
import asyncio
import json
import os

from ..model_runner import OPENROUTER_MODELS, MODELS_BY_PROVIDER, run_models, call_openrouter_streaming, clean_model_response
from ..models import User, UsageLog, AppSettings
from ..database import get_db
from ..dependencies import get_current_user
from ..rate_limiting import (
    get_user_usage_stats,
    get_anonymous_usage_stats,
    get_anonymous_extended_usage_stats,
    anonymous_rate_limit_storage,
    check_user_rate_limit,
    increment_user_usage,
    check_anonymous_rate_limit,
    increment_anonymous_usage,
    get_model_limit,
    is_overage_allowed,
    check_extended_tier_limit,
    increment_extended_usage,
    check_anonymous_extended_limit,
    increment_anonymous_extended_usage,
)

router = APIRouter(tags=["API"])

# In-memory storage for model performance tracking
# This is shared with main.py via import
model_stats: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"success": 0, "failure": 0, "last_error": None, "last_success": None})

# Tier configuration
TIER_LIMITS = {
    "brief": {"input_chars": 1000, "output_tokens": 2000},
    "standard": {"input_chars": 5000, "output_tokens": 4000},
    "extended": {"input_chars": 15000, "output_tokens": 8192},
}


# Pydantic models for request/response
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


# Helper functions
def validate_tier_limits(input_data: str, tier: str) -> bool:
    """Validate input length against tier limits"""
    if tier not in TIER_LIMITS:
        return False
    return len(input_data) <= TIER_LIMITS[tier]["input_chars"]


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


def log_usage_to_db(usage_log: UsageLog, db: Session):
    """Background task to log usage to database without blocking the response."""
    try:
        db.add(usage_log)
        db.commit()
    except Exception as e:
        print(f"Failed to log usage to database: {e}")
        db.rollback()


@router.get("/models")
async def get_available_models():
    """Get list of available AI models."""
    return {"models": OPENROUTER_MODELS, "models_by_provider": MODELS_BY_PROVIDER}


@router.get("/anonymous-mock-mode-status")
async def get_anonymous_mock_mode_status(db: Session = Depends(get_db)):
    """
    Public endpoint to check if anonymous mock mode is enabled.
    Only returns status in development environment.
    """
    is_development = os.environ.get("ENVIRONMENT") == "development"
    
    if not is_development:
        return {"anonymous_mock_mode_enabled": False, "is_development": False}
    
    settings = db.query(AppSettings).first()
    
    # If no settings exist yet, create default ones
    if not settings:
        settings = AppSettings(
            anonymous_mock_mode_enabled=False
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    return {
        "anonymous_mock_mode_enabled": settings.anonymous_mock_mode_enabled,
        "is_development": True
    }


@router.get("/rate-limit-status")
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
        extended_stats = get_anonymous_extended_usage_stats(f"ip:{client_ip}")

        result = {**usage_stats, "authenticated": False, "ip_address": client_ip}
        result.update(extended_stats)

        # Include fingerprint stats if provided
        if fingerprint:
            fp_stats = get_anonymous_usage_stats(f"fp:{fingerprint}")
            result["fingerprint_usage"] = fp_stats["daily_usage"]
            result["fingerprint_remaining"] = fp_stats["remaining_usage"]

            # Include extended fingerprint stats
            fp_extended_stats = get_anonymous_extended_usage_stats(f"fp:{fingerprint}")
            result["fingerprint_extended_usage"] = fp_extended_stats["daily_extended_usage"]
            result["fingerprint_extended_remaining"] = fp_extended_stats["remaining_extended_usage"]

        return result


@router.get("/model-stats")
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


@router.post("/dev/reset-rate-limit")
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


@router.post("/compare")
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
            print(
                f"Authenticated user {current_user.email} - Extended usage: {extended_count}/{extended_limit} (will increment after success)"
            )
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
            print(
                f"Anonymous user - Extended usage: {max(ip_extended_count, fingerprint_extended_count)}/2 (will increment after success)"
            )
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


@router.post("/compare-stream")
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
            print(
                f"Authenticated user {current_user.email} - Extended usage: {extended_count}/{extended_limit} (will increment after success)"
            )
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
            print(
                f"Anonymous user - Extended usage: {max(ip_extended_count, fingerprint_extended_count)}/2 (will increment after success)"
            )

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
        Streams responses from all requested models concurrently for maximum performance.

        Modern async/await pattern (2025 best practices):
        - Concurrent execution via asyncio.create_task
        - Queue-based chunk collection with asyncio.Queue
        - Graceful error handling per model
        - Non-blocking I/O throughout
        """
        successful_models = 0
        failed_models = 0
        results_dict = {}

        # Check if mock mode is enabled for this user
        is_development = os.environ.get("ENVIRONMENT") == "development"
        use_mock = False
        
        if current_user:
            # Check if mock mode is enabled for this authenticated user
            if current_user.mock_mode_enabled:
                if is_development or current_user.role in ["admin", "super_admin"]:
                    use_mock = True
            if use_mock:
                print(f"🎭 Mock mode active for user {current_user.email} (dev_mode: {is_development})")
        else:
            # Check if global anonymous mock mode is enabled (development only)
            is_development = os.environ.get("ENVIRONMENT") == "development"
            if is_development:
                settings = db.query(AppSettings).first()
                if settings and settings.anonymous_mock_mode_enabled:
                    use_mock = True
                    print(f"🎭 Anonymous mock mode active (global setting)")

        try:
            # Send all start events at once (concurrent processing begins simultaneously)
            for model_id in req.models:
                yield f"data: {json.dumps({'model': model_id, 'type': 'start'})}\n\n"

            # Create queue for chunk collection from all models
            chunk_queue = asyncio.Queue()

            async def stream_single_model(model_id: str):
                """
                Stream a single model's response asynchronously.
                Runs in parallel with other models for optimal performance.
                Uses asyncio-friendly approach with thread-safe queue communication.
                """
                model_content = ""
                chunk_count = 0

                try:
                    # Run synchronous streaming in a thread, push chunks to queue as they arrive
                    loop = asyncio.get_event_loop()

                    def process_stream_to_queue():
                        """
                        Process streaming response in thread pool.
                        Push chunks to async queue in real-time for true streaming.
                        """
                        content = ""
                        count = 0
                        try:
                            for chunk in call_openrouter_streaming(
                                req.input_data, model_id, req.tier, req.conversation_history, use_mock
                            ):
                                content += chunk
                                count += 1

                                # Push chunk to async queue (thread-safe)
                                asyncio.run_coroutine_threadsafe(
                                    chunk_queue.put({"type": "chunk", "model": model_id, "content": chunk, "chunk_count": count}),
                                    loop,
                                )

                                # Log progress every 10 chunks
                                if count % 10 == 0:
                                    print(f"📤 Streaming chunk {count} for {model_id}")

                            return content, False  # content, is_error

                        except Exception as e:
                            error_msg = f"Error: {str(e)[:100]}"
                            # Push error as chunk
                            asyncio.run_coroutine_threadsafe(
                                chunk_queue.put({"type": "chunk", "model": model_id, "content": error_msg}), loop
                            )
                            return error_msg, True  # error_msg, is_error

                    # Run streaming in executor (allows true concurrent execution)
                    full_content, is_error = await loop.run_in_executor(None, process_stream_to_queue)

                    # Clean the final accumulated content (unless it's an error)
                    if not is_error:
                        model_content = clean_model_response(full_content)
                    else:
                        model_content = full_content

                    # Final check if response is an error
                    is_error = is_error or model_content.startswith("Error:")

                    return {"model": model_id, "content": model_content, "error": is_error}

                except Exception as e:
                    # Handle model-specific errors gracefully
                    error_msg = f"Error: {str(e)[:100]}"

                    # Put error in queue as chunk
                    await chunk_queue.put({"type": "chunk", "model": model_id, "content": error_msg})

                    return {"model": model_id, "content": error_msg, "error": True}

            # Create tasks for all models to run concurrently
            tasks = [asyncio.create_task(stream_single_model(model_id)) for model_id in req.models]

            # Process chunks and completed tasks concurrently
            pending_tasks = set(tasks)

            while pending_tasks or not chunk_queue.empty():
                # Wait for either a chunk or a task completion
                done_tasks = set()

                # Check for completed tasks without blocking
                for task in list(pending_tasks):
                    if task.done():
                        done_tasks.add(task)
                        pending_tasks.remove(task)

                # Process completed tasks
                for task in done_tasks:
                    result = await task
                    model_id = result["model"]

                    # Update statistics
                    if result["error"]:
                        failed_models += 1
                        model_stats[model_id]["failure"] += 1
                        model_stats[model_id]["last_error"] = datetime.now().isoformat()
                    else:
                        successful_models += 1
                        model_stats[model_id]["success"] += 1
                        model_stats[model_id]["last_success"] = datetime.now().isoformat()

                    results_dict[model_id] = result["content"]

                    # Send done event for this model
                    yield f"data: {json.dumps({'model': model_id, 'type': 'done', 'error': result['error']})}\n\n"

                # Process available chunks from queue
                while not chunk_queue.empty():
                    try:
                        chunk_data = await asyncio.wait_for(chunk_queue.get(), timeout=0.001)

                        if chunk_data["type"] == "chunk":
                            # Don't clean chunks during streaming - preserves whitespace
                            yield f"data: {json.dumps({'model': chunk_data['model'], 'type': 'chunk', 'content': chunk_data['content']})}\n\n"
                    except asyncio.TimeoutError:
                        break

                # Small yield to prevent tight loop and allow other operations
                if pending_tasks:
                    await asyncio.sleep(0.01)  # 10ms yield

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
