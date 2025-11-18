"""
Main API router for core application endpoints.

This module contains the main application endpoints like /models, /compare, etc.
that are used by the frontend for the core AI comparison functionality.
"""

from fastapi import APIRouter, Request, Depends, HTTPException, status, BackgroundTasks, Body
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, ConfigDict
from typing import Optional, Dict, Any, Union
from sqlalchemy.orm import Session
from collections import defaultdict
from datetime import datetime
import asyncio
import json
import os

from ..model_runner import (
    OPENROUTER_MODELS,
    MODELS_BY_PROVIDER,
    run_models,
    call_openrouter_streaming,
    clean_model_response,
)
from ..models import (
    User,
    UsageLog,
    AppSettings,
    Conversation,
    ConversationMessage as ConversationMessageModel,
)
from ..database import get_db
from ..dependencies import get_current_user
from ..schemas import ConversationSummary, ConversationDetail
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
model_stats: Dict[str, Dict[str, Any]] = defaultdict(
    lambda: {"success": 0, "failure": 0, "last_error": None, "last_success": None}
)

# Import configuration constants
from ..config import (
    TIER_LIMITS,
    ANONYMOUS_DAILY_LIMIT,
    ANONYMOUS_MODEL_LIMIT,
    MODEL_LIMITS,
    SUBSCRIPTION_CONFIG,
    get_conversation_limit,
    get_daily_limit,
    get_model_limit,
)


# Pydantic models for request/response
class ConversationMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str

    model_config = ConfigDict(
        json_schema_extra={
            "example": {"role": "user", "content": "What is artificial intelligence?"}
        }
    )


class CompareRequest(BaseModel):
    input_data: str
    models: list[str]
    conversation_history: list[ConversationMessage] = []  # Optional conversation context
    browser_fingerprint: Optional[str] = None  # Optional browser fingerprint for rate limiting
    tier: str = "standard"  # standard, extended
    conversation_id: Optional[int] = (
        None  # Optional conversation ID for follow-ups (most reliable matching)
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "input_data": "Explain quantum computing in simple terms",
                "models": ["openai/gpt-4", "anthropic/claude-3-opus", "google/gemini-pro"],
                "conversation_history": [
                    {"role": "user", "content": "What is AI?"},
                    {"role": "assistant", "content": "AI stands for Artificial Intelligence..."},
                ],
                "tier": "standard",
                "conversation_id": 123,
            }
        }
    )


class CompareResponse(BaseModel):
    results: dict[str, str]
    metadata: dict[str, Any]


class ResetRateLimitRequest(BaseModel):
    fingerprint: Optional[str] = None


# Helper functions
# get_conversation_limit_for_tier is now get_conversation_limit from config module

# Import validation functions from config
from ..config import validate_tier_limits


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


def log_usage_to_db(usage_log: UsageLog, db: Session) -> None:
    """Background task to log usage to database without blocking the response."""
    try:
        db.add(usage_log)
        db.commit()
    except Exception as e:
        print(f"Failed to log usage to database: {e}")
        db.rollback()
    finally:
        db.close()


@router.get("/models")
async def get_available_models() -> Dict[str, Any]:
    """
    Get list of available AI models.

    OPTIMIZATION: Uses caching since model list is static data.
    """
    from ..cache import get_cached_models, CACHE_KEY_MODELS

    def get_models():
        return {"models": OPENROUTER_MODELS, "models_by_provider": MODELS_BY_PROVIDER}

    return get_cached_models(get_models)


@router.get("/anonymous-mock-mode-status")
async def get_anonymous_mock_mode_status(db: Session = Depends(get_db)):
    """
    Public endpoint to check if anonymous mock mode is enabled.
    Only returns status in development environment.

    OPTIMIZATION: Uses caching to avoid repeated database queries.
    """
    is_development = os.environ.get("ENVIRONMENT") == "development"

    if not is_development:
        return {"anonymous_mock_mode_enabled": False, "is_development": False}

    # Use cache to avoid repeated database queries
    from ..cache import get_cached_app_settings, CACHE_KEY_APP_SETTINGS

    def get_settings():
        return db.query(AppSettings).first()

    settings = get_cached_app_settings(get_settings)

    # If no settings exist yet, create default ones
    if not settings:
        settings = AppSettings(anonymous_mock_mode_enabled=False)
        db.add(settings)
        db.commit()
        db.refresh(settings)
        # Invalidate cache after creating new settings
        from ..cache import invalidate_app_settings_cache

        invalidate_app_settings_cache()

    return {
        "anonymous_mock_mode_enabled": settings.anonymous_mock_mode_enabled,
        "is_development": True,
    }


@router.get("/rate-limit-status")
async def get_rate_limit_status(
    request: Request,
    fingerprint: Optional[str] = None,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get current rate limit status for the client.

    Returns different information for authenticated vs anonymous users.
    """
    if current_user:
        # Authenticated user - return subscription-based usage
        # Refresh user data from database to get latest usage counts
        db.refresh(current_user)
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
    req_body: ResetRateLimitRequest,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    DEV ONLY: Reset rate limits, usage counts, and conversation history for the current user.
    For authenticated users: resets database usage and deletes their conversations.
    For anonymous users: resets IP/fingerprint-based rate limits (client clears localStorage).
    This endpoint should be disabled in production!
    """
    # Only allow in development mode
    if os.environ.get("ENVIRONMENT") != "development":
        raise HTTPException(
            status_code=403, detail="This endpoint is only available in development mode"
        )

    client_ip = get_client_ip(request)
    deleted_count = 0

    # For authenticated users: reset usage and delete their conversations
    if current_user:
        # Reset usage counts
        current_user.daily_usage_count = 0
        current_user.monthly_overage_count = 0
        current_user.daily_extended_usage = 0

        # Delete only this user's conversations (messages deleted via cascade)
        deleted_count = (
            db.query(Conversation).filter(Conversation.user_id == current_user.id).delete()
        )
        db.commit()

    # For anonymous users: reset IP-based rate limits
    # (frontend will handle localStorage clearing)
    ip_key = f"ip:{client_ip}"
    if ip_key in anonymous_rate_limit_storage:
        del anonymous_rate_limit_storage[ip_key]

    # Reset IP-based extended usage tracking
    ip_extended_key = f"ip:{client_ip}_extended"
    if ip_extended_key in anonymous_rate_limit_storage:
        del anonymous_rate_limit_storage[ip_extended_key]

    # Reset fingerprint-based rate limit if provided
    fingerprint = req_body.fingerprint
    if fingerprint:
        fp_key = f"fp:{fingerprint}"
        if fp_key in anonymous_rate_limit_storage:
            del anonymous_rate_limit_storage[fp_key]

        # Reset fingerprint-based extended usage tracking
        fp_extended_key = f"fp:{fingerprint}_extended"
        if fp_extended_key in anonymous_rate_limit_storage:
            del anonymous_rate_limit_storage[fp_extended_key]

    return {
        "message": "Rate limits, usage, and conversation history reset successfully",
        "ip_address": client_ip,
        "fingerprint_reset": fingerprint is not None,
        "conversations_deleted": deleted_count,
        "user_type": "authenticated" if current_user else "anonymous",
    }


@router.post("/compare")
async def compare(
    req: CompareRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
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

    # Validate tier is valid
    if req.tier not in TIER_LIMITS:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid tier '{req.tier}'. Valid tiers are: {', '.join(TIER_LIMITS.keys())}",
        )

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
        tier_model_limit = ANONYMOUS_MODEL_LIMIT  # Anonymous users model limit from configuration
        tier_name = "anonymous"

    # Enforce tier-specific model limit
    if len(req.models) > tier_model_limit:
        upgrade_message = ""
        if tier_name == "anonymous":
            free_model_limit = get_model_limit("free")
            upgrade_message = (
                f" Sign up for a free account to compare up to {free_model_limit} models."
            )
        elif tier_name == "free":
            starter_model_limit = get_model_limit("starter")
            pro_model_limit = get_model_limit("pro")
            upgrade_message = f" Upgrade to Starter for {starter_model_limit} models or Pro for {pro_model_limit} models."
        elif tier_name in ["starter", "starter_plus"]:
            pro_model_limit = get_model_limit("pro")
            upgrade_message = f" Upgrade to Pro for {pro_model_limit} models."

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
        # Debug logging for authentication and tier
        print(f"[API] Authenticated user: {current_user.email}, subscription_tier: '{current_user.subscription_tier}', is_active: {current_user.is_active}")
        
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

                print(
                    f"Authenticated user {current_user.email} - Using {models_over_limit} overage model responses (pricing TBD)"
                )
            else:
                # Free tier - no overages allowed
                models_available = max(0, daily_limit - usage_count)
                # Provide more helpful error message based on actual tier
                tier_name = current_user.subscription_tier or "unknown"
                if tier_name.lower() in ["pro_plus", "pro+", "pro +"]:
                    error_msg = f"Daily limit of {daily_limit} model responses reached. You have {models_available} remaining and need {models_needed}. Please contact support if you believe this is an error."
                else:
                    starter_limit = get_daily_limit("starter")
                    pro_limit = get_daily_limit("pro")
                    error_msg = f"Daily limit of {daily_limit} model responses reached. You have {models_available} remaining and need {models_needed}. Upgrade to Starter ({starter_limit}/day) or Pro ({pro_limit}/day) for more capacity and overage options."
                raise HTTPException(
                    status_code=429,
                    detail=error_msg,
                )

        # Don't increment here - wait until we know if requests succeeded
        # Will be incremented below based on successful_models count
        if is_overage:
            print(f"Authenticated user {current_user.email} - Overage requested")
    else:
        # Debug logging for anonymous users
        print(f"[API] Anonymous user - IP: {client_ip}, fingerprint: {req.browser_fingerprint[:20] if req.browser_fingerprint else 'None'}...")
        
        # Anonymous user - check IP/fingerprint limits (model response based)
        ip_allowed, ip_count = check_anonymous_rate_limit(f"ip:{client_ip}")

        fingerprint_allowed = True
        fingerprint_count = 0
        if req.browser_fingerprint:
            fingerprint_allowed, fingerprint_count = check_anonymous_rate_limit(
                f"fp:{req.browser_fingerprint}"
            )

        # Check if user has enough model responses remaining
        if not ip_allowed or (req.browser_fingerprint and not fingerprint_allowed):
            models_available = max(0, ANONYMOUS_DAILY_LIMIT - max(ip_count, fingerprint_count))
            free_tier_limit = get_daily_limit("free")
            raise HTTPException(
                status_code=429,
                detail=f"Daily limit of {ANONYMOUS_DAILY_LIMIT} model responses exceeded. You have {models_available} remaining and need {num_models}. "
                f"Sign up for a free account ({free_tier_limit} model responses/day) to continue.",
            )

        # Check if this request would exceed the limit
        if ip_count + num_models > ANONYMOUS_DAILY_LIMIT or (
            req.browser_fingerprint and fingerprint_count + num_models > ANONYMOUS_DAILY_LIMIT
        ):
            models_available = max(0, ANONYMOUS_DAILY_LIMIT - max(ip_count, fingerprint_count))
            free_tier_limit = get_daily_limit("free")
            raise HTTPException(
                status_code=429,
                detail=f"Daily limit would be exceeded. You have {models_available} model responses remaining and chose {num_models}. "
                f"Sign up for a free account ({free_tier_limit} model responses/day) to continue.",
            )

        # Don't increment here - wait until we know if requests succeeded
        # Will be incremented below based on successful_models count
        print(f"Anonymous user - IP: {client_ip} (checking limits)")
    # --- END HYBRID RATE LIMITING ---

    # --- EXTENDED TIER LIMITING ---
    if req.tier == "extended":
        if current_user:
            # Check Extended tier limit for authenticated users
            extended_allowed, extended_count, extended_limit = check_extended_tier_limit(
                current_user, db
            )

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
            ip_extended_allowed, ip_extended_count = check_anonymous_extended_limit(
                f"ip:{client_ip}"
            )
            fingerprint_extended_allowed = True
            fingerprint_extended_count = 0

            if req.browser_fingerprint:
                fingerprint_extended_allowed, fingerprint_extended_count = (
                    check_anonymous_extended_limit(f"fp:{req.browser_fingerprint}")
                )

            if not ip_extended_allowed or (
                req.browser_fingerprint and not fingerprint_extended_allowed
            ):
                extended_available = max(0, 2 - max(ip_extended_count, fingerprint_extended_count))
                raise HTTPException(
                    status_code=429,
                    detail=f"Daily Extended tier limit of 2 exceeded. You have {extended_available} Extended interactions remaining. "
                    f"Sign up for a free account to get 5 Extended interactions per day.",
                )

            # Don't increment here - wait until we know requests succeeded
            print(
                f"Anonymous user - Extended usage: {max(ip_extended_count, fingerprint_extended_count)}/2 (will increment after success)"
            )
    # --- END EXTENDED TIER LIMITING ---

    # Check if mock mode is enabled for this user
    # IMPORTANT: Authenticated users should NEVER use anonymous mock mode
    is_development = os.environ.get("ENVIRONMENT") == "development"
    use_mock = False

    if current_user:
        # Check if mock mode is enabled for this authenticated user
        # Allow mock mode for admins/super_admins even in production (for testing)
        if current_user.mock_mode_enabled:
            if is_development or current_user.role in ["admin", "super_admin"]:
                use_mock = True
    else:
        # Only check anonymous mock mode if there is NO authenticated user
        # Check if global anonymous mock mode is enabled (development only)
        if is_development:
            from ..cache import get_cached_app_settings

            def get_settings():
                return db.query(AppSettings).first()

            settings = get_cached_app_settings(get_settings)
            if settings and settings.anonymous_mock_mode_enabled:
                use_mock = True

    # Track start time for processing metrics
    start_time = datetime.now()

    try:
        if use_mock:
            # Mock mode: Create fake successful results
            results = {}
            for model_id in req.models:
                results[model_id] = (
                    f"[MOCK MODE] This is a test response for {model_id}. Mock mode is enabled for testing."
                )
        else:
            loop = asyncio.get_running_loop()
            results = await loop.run_in_executor(
                None, run_models, req.input_data, req.models, req.tier, req.conversation_history
            )

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

        # NOW increment usage counts - only for successful models
        # In mock mode, all models are considered successful for counting purposes
        if successful_models > 0:
            # Increment regular usage count
            if current_user:
                increment_user_usage(current_user, db, count=successful_models)
            else:
                increment_anonymous_usage(f"ip:{client_ip}", count=successful_models)
                if req.browser_fingerprint:
                    increment_anonymous_usage(
                        f"fp:{req.browser_fingerprint}", count=successful_models
                    )

            # Increment extended usage - only count 1 per request regardless of model count
            if req.tier == "extended":
                if current_user:
                    increment_extended_usage(current_user, db, count=1)
                else:
                    increment_anonymous_extended_usage(f"ip:{client_ip}", count=1)
                    if req.browser_fingerprint:
                        increment_anonymous_extended_usage(f"fp:{req.browser_fingerprint}", count=1)

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

    # Validate tier is valid
    if req.tier not in TIER_LIMITS:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid tier '{req.tier}'. Valid tiers are: {', '.join(TIER_LIMITS.keys())}",
        )

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
        tier_model_limit = ANONYMOUS_MODEL_LIMIT  # Anonymous users model limit from configuration
        tier_name = "anonymous"

    # Enforce tier-specific model limit
    if len(req.models) > tier_model_limit:
        upgrade_message = ""
        if tier_name == "anonymous":
            free_model_limit = get_model_limit("free")
            upgrade_message = (
                f" Sign up for a free account to compare up to {free_model_limit} models."
            )
        elif tier_name == "free":
            starter_model_limit = get_model_limit("starter")
            pro_model_limit = get_model_limit("pro")
            upgrade_message = f" Upgrade to Starter for {starter_model_limit} models or Pro for {pro_model_limit} models."
        elif tier_name in ["starter", "starter_plus"]:
            pro_model_limit = get_model_limit("pro")
            upgrade_message = f" Upgrade to Pro for {pro_model_limit} models."

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
        # Debug logging for authentication and tier
        print(f"[API] Authenticated user: {current_user.email}, subscription_tier: '{current_user.subscription_tier}', is_active: {current_user.is_active}")
        
        is_allowed, usage_count, daily_limit = check_user_rate_limit(current_user, db)

        if usage_count + num_models > daily_limit:
            models_needed = num_models
            models_over_limit = (usage_count + num_models) - daily_limit

            if is_overage_allowed(current_user.subscription_tier):
                is_overage = True
                overage_charge = 0.0
                current_user.monthly_overage_count += models_over_limit
                print(
                    f"Authenticated user {current_user.email} - Using {models_over_limit} overage model responses"
                )
            else:
                models_available = max(0, daily_limit - usage_count)
                # Provide more helpful error message based on actual tier
                tier_name = current_user.subscription_tier or "unknown"
                if tier_name.lower() in ["pro_plus", "pro+", "pro +"]:
                    error_msg = f"Daily limit of {daily_limit} model responses exceeded. You have {models_available} remaining and need {models_needed}. Please contact support if you believe this is an error."
                else:
                    error_msg = f"Daily limit of {daily_limit} model responses exceeded. You have {models_available} remaining and need {models_needed}. Upgrade to Starter (150/day) or Pro (450/day) for more capacity."
                raise HTTPException(
                    status_code=429,
                    detail=error_msg,
                )

        # Don't increment here - wait until we know if requests succeeded
        print(f"Authenticated user {current_user.email} - Checking limits")
    else:
        # Debug logging for anonymous users
        print(f"[API] Anonymous user - IP: {client_ip}, fingerprint: {req.browser_fingerprint[:20] if req.browser_fingerprint else 'None'}...")
        
        ip_allowed, ip_count = check_anonymous_rate_limit(f"ip:{client_ip}")
        fingerprint_allowed = True
        fingerprint_count = 0
        if req.browser_fingerprint:
            fingerprint_allowed, fingerprint_count = check_anonymous_rate_limit(
                f"fp:{req.browser_fingerprint}"
            )

        if not ip_allowed or (req.browser_fingerprint and not fingerprint_allowed):
            models_available = max(0, ANONYMOUS_DAILY_LIMIT - max(ip_count, fingerprint_count))
            free_tier_limit = get_daily_limit("free")
            raise HTTPException(
                status_code=429,
                detail=f"Daily limit of {ANONYMOUS_DAILY_LIMIT} model responses exceeded. Sign up for a free account ({free_tier_limit} model responses/day) to continue.",
            )

        if ip_count + num_models > ANONYMOUS_DAILY_LIMIT or (
            req.browser_fingerprint and fingerprint_count + num_models > ANONYMOUS_DAILY_LIMIT
        ):
            models_available = max(0, ANONYMOUS_DAILY_LIMIT - max(ip_count, fingerprint_count))
            free_tier_limit = get_daily_limit("free")
            raise HTTPException(
                status_code=429,
                detail=f"Daily limit would be exceeded. You have {models_available} model responses remaining and chose {num_models}. "
                f"Sign up for a free account ({free_tier_limit} model responses/day) to continue.",
            )

        # Don't increment here - wait until we know if requests succeeded
        print(f"Anonymous user - IP: {client_ip} (checking limits)")

    # --- EXTENDED TIER LIMITING (same as regular endpoint) ---
    if req.tier == "extended":
        if current_user:
            extended_allowed, extended_count, extended_limit = check_extended_tier_limit(
                current_user, db
            )
            if not extended_allowed:
                raise HTTPException(
                    status_code=429,
                    detail=f"Daily Extended tier limit of {extended_limit} exceeded.",
                )
            # Don't increment here - wait until we know requests succeeded
            print(
                f"Authenticated user {current_user.email} - Extended usage: {extended_count}/{extended_limit} (will increment after success)"
            )
        else:
            ip_extended_allowed, ip_extended_count = check_anonymous_extended_limit(
                f"ip:{client_ip}"
            )
            fingerprint_extended_allowed = True
            fingerprint_extended_count = 0

            if req.browser_fingerprint:
                fingerprint_extended_allowed, fingerprint_extended_count = (
                    check_anonymous_extended_limit(f"fp:{req.browser_fingerprint}")
                )

            if not ip_extended_allowed or (
                req.browser_fingerprint and not fingerprint_extended_allowed
            ):
                raise HTTPException(
                    status_code=429,
                    detail=f"Daily Extended tier limit of 2 exceeded. Sign up for a free account to get 5 Extended interactions per day.",
                )

            # Don't increment here - wait until we know requests succeeded
            print(
                f"Anonymous user - Extended usage: {max(ip_extended_count, fingerprint_extended_count)}/2 (will increment after success)"
            )

    # Track if this is an extended interaction (long conversation context)
    # Industry best practice 2025: Separately track context-heavy requests
    is_extended_interaction = False
    conversation_message_count = len(req.conversation_history) if req.conversation_history else 0

    # Consider it extended if conversation has more than 6 messages (3 exchanges)
    # Extended mode doubles token limits (5K→15K chars, 4K→8K tokens), equivalent to ~2 messages
    # So 6+ messages is a more reasonable threshold for context-heavy requests
    if conversation_message_count > 6:
        is_extended_interaction = True

    # Track start time for processing metrics
    start_time = datetime.now()

    # Store user ID for use inside generator (avoid session detachment issues)
    # IMPORTANT: Also store whether user exists to prevent anonymous mock mode for authenticated users
    user_id = current_user.id if current_user else None
    has_authenticated_user = current_user is not None

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
        # IMPORTANT: Authenticated users should NEVER use anonymous mock mode
        # Query user fresh from database to avoid stale mock_mode_enabled value
        # The current_user object captured in closure may have stale data
        is_development = os.environ.get("ENVIRONMENT") == "development"
        use_mock = False

        # Only check mock mode if we have an authenticated user
        # If has_authenticated_user is True, we should NEVER check anonymous mock mode
        if has_authenticated_user and user_id:
            # Query user fresh from database to get latest mock_mode_enabled value
            from ..database import SessionLocal
            fresh_db = SessionLocal()
            try:
                fresh_user = fresh_db.query(User).filter(User.id == user_id).first()
                if fresh_user:
                    # Check if mock mode is enabled for this authenticated user
                    # Allow mock mode for admins/super_admins even in production (for testing)
                    if fresh_user.mock_mode_enabled:
                        if is_development or fresh_user.role in ["admin", "super_admin"]:
                            use_mock = True
            finally:
                fresh_db.close()
        elif not has_authenticated_user:
            # Only check anonymous mock mode if there is NO authenticated user
            # Check if global anonymous mock mode is enabled (development only)
            if is_development:
                from ..cache import get_cached_app_settings

                def get_settings():
                    return db.query(AppSettings).first()

                settings = get_cached_app_settings(get_settings)
                if settings and settings.anonymous_mock_mode_enabled:
                    use_mock = True

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
                                req.input_data,
                                model_id,
                                req.tier,
                                req.conversation_history,
                                use_mock,
                            ):
                                content += chunk
                                count += 1

                                # Push chunk to async queue (thread-safe)
                                asyncio.run_coroutine_threadsafe(
                                    chunk_queue.put(
                                        {
                                            "type": "chunk",
                                            "model": model_id,
                                            "content": chunk,
                                            "chunk_count": count,
                                        }
                                    ),
                                    loop,
                                )

                            return content, False  # content, is_error

                        except Exception as e:
                            error_msg = f"Error: {str(e)[:100]}"
                            # Push error as chunk
                            asyncio.run_coroutine_threadsafe(
                                chunk_queue.put(
                                    {"type": "chunk", "model": model_id, "content": error_msg}
                                ),
                                loop,
                            )
                            return error_msg, True  # error_msg, is_error

                    # Run streaming in executor (allows true concurrent execution)
                    full_content, is_error = await loop.run_in_executor(
                        None, process_stream_to_queue
                    )

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
                    await chunk_queue.put(
                        {"type": "chunk", "model": model_id, "content": error_msg}
                    )

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

            # NOW increment usage counts - only for successful models
            # In mock mode, all models are considered successful for counting purposes
            # Create a fresh database session to avoid detachment issues
            from ..database import SessionLocal

            if successful_models > 0:
                # Increment regular usage count
                if user_id:
                    # Create new session and query user fresh
                    increment_db = SessionLocal()
                    try:
                        increment_user_obj = (
                            increment_db.query(User).filter(User.id == user_id).first()
                        )
                        if increment_user_obj:
                            increment_user_usage(
                                increment_user_obj, increment_db, count=successful_models
                            )
                    finally:
                        increment_db.close()
                else:
                    increment_anonymous_usage(f"ip:{client_ip}", count=successful_models)
                    if req.browser_fingerprint:
                        increment_anonymous_usage(
                            f"fp:{req.browser_fingerprint}", count=successful_models
                        )

                # Increment extended usage - only count 1 per request regardless of model count
                if req.tier == "extended":
                    if user_id:
                        # Create new session for extended increment
                        increment_db = SessionLocal()
                        try:
                            increment_user_obj = (
                                increment_db.query(User).filter(User.id == user_id).first()
                            )
                            if increment_user_obj:
                                increment_extended_usage(increment_user_obj, increment_db, count=1)
                        finally:
                            increment_db.close()
                    else:
                        increment_anonymous_extended_usage(f"ip:{client_ip}", count=1)
                        if req.browser_fingerprint:
                            increment_anonymous_extended_usage(
                                f"fp:{req.browser_fingerprint}", count=1
                            )

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
                user_id=user_id,
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
            # Create new session for background task
            log_db = SessionLocal()
            background_tasks.add_task(log_usage_to_db, usage_log, log_db)

            # Save conversation to database for authenticated users
            if user_id and successful_models > 0:

                def save_conversation_to_db():
                    """Save conversation and messages to database."""
                    conv_db = SessionLocal()
                    try:
                        # Determine if this is a follow-up or new conversation
                        is_follow_up = bool(
                            req.conversation_history and len(req.conversation_history) > 0
                        )

                        # Try to find existing conversation if this is a follow-up
                        existing_conversation = None
                        if is_follow_up:
                            # Method 1: If conversation_id is provided, use it directly (most reliable)
                            if req.conversation_id:
                                conversation_by_id = (
                                    conv_db.query(Conversation)
                                    .filter(
                                        Conversation.id == req.conversation_id,
                                        Conversation.user_id == user_id,
                                    )
                                    .first()
                                )
                                if conversation_by_id:
                                    existing_conversation = conversation_by_id

                            # Method 2: If no conversation_id provided, match by models + input_data + timestamp
                            if not existing_conversation:
                                # Extract the original input_data (first user message) from conversation history
                                # This is the initial prompt that started the conversation
                                original_input_data = None
                                first_message_timestamp = None
                                for msg in req.conversation_history:
                                    if msg.role == "user":
                                        original_input_data = msg.content
                                        # Try to get timestamp if available (from message metadata)
                                        # Note: conversation_history doesn't include timestamps by default,
                                        # but we can use this for future enhancement
                                        break

                                # Find conversation with matching models AND original input_data
                                # This ensures follow-ups are added to the correct conversation,
                                # even if multiple conversations use the same models
                                req_models_sorted = sorted(req.models)
                                all_user_conversations = (
                                    conv_db.query(Conversation)
                                    .filter(Conversation.user_id == user_id)
                                    .order_by(Conversation.updated_at.desc())
                                    .all()
                                )

                                for conv in all_user_conversations:
                                    try:
                                        conv_models = (
                                            json.loads(conv.models_used) if conv.models_used else []
                                        )
                                        # Match by models AND original input_data to ensure correct conversation
                                        models_match = sorted(conv_models) == req_models_sorted
                                        input_matches = (
                                            original_input_data
                                            and conv.input_data == original_input_data
                                        )

                                        # Additional safeguard: if timestamps are available in future,
                                        # we could also match by comparing conversation.created_at with
                                        # the timestamp of the first user message

                                        if models_match and input_matches:
                                            existing_conversation = conv
                                            break
                                    except (json.JSONDecodeError, TypeError):
                                        continue

                        # Create or update conversation
                        if existing_conversation:
                            conversation = existing_conversation
                            conversation.updated_at = datetime.now()
                        else:
                            # Create new conversation
                            conversation = Conversation(
                                user_id=user_id,
                                input_data=req.input_data,
                                models_used=json.dumps(req.models),
                            )
                            conv_db.add(conversation)
                            conv_db.flush()  # Get the ID

                        # Save user message (current prompt)
                        # For new conversations, this is the first message
                        # For follow-ups, this is the new user prompt
                        user_msg = ConversationMessageModel(
                            conversation_id=conversation.id,
                            role="user",
                            content=req.input_data,
                            model_id=None,
                        )
                        conv_db.add(user_msg)

                        # Save assistant messages for each successful model
                        messages_saved = 0
                        for model_id, content in results_dict.items():
                            if not content.startswith("Error:"):
                                assistant_msg = ConversationMessageModel(
                                    conversation_id=conversation.id,
                                    role="assistant",
                                    content=content,
                                    model_id=model_id,
                                    success=True,
                                    processing_time_ms=processing_time_ms,
                                )
                                conv_db.add(assistant_msg)
                                messages_saved += 1

                        conv_db.commit()

                        # Enforce tier-based conversation limits
                        # Store exactly display_limit conversations (no longer need +1 since we don't filter in frontend)
                        user_obj = conv_db.query(User).filter(User.id == user_id).first()
                        tier = user_obj.subscription_tier if user_obj else "free"
                        display_limit = get_conversation_limit(tier)
                        storage_limit = display_limit  # Store exactly the display limit

                        # Get all conversations for user
                        all_conversations = (
                            conv_db.query(Conversation)
                            .filter(Conversation.user_id == user_id)
                            .order_by(Conversation.created_at.desc())
                            .all()
                        )

                        # Delete oldest conversations if over storage limit
                        if len(all_conversations) > storage_limit:
                            conversations_to_delete = all_conversations[storage_limit:]
                            deleted_count = len(conversations_to_delete)
                            for conv_to_delete in conversations_to_delete:
                                conv_db.delete(conv_to_delete)
                            conv_db.commit()

                    except Exception as e:
                        import traceback

                        # Log error silently (errors should be handled by proper logging infrastructure)
                        conv_db.rollback()
                    finally:
                        conv_db.close()

                # Save conversation - execute in thread executor to avoid blocking stream
                # Background tasks don't execute reliably with StreamingResponse, so we run it here
                loop = asyncio.get_event_loop()
                loop.run_in_executor(None, save_conversation_to_db)

            # Send completion event with metadata
            yield f"data: {json.dumps({'type': 'complete', 'metadata': metadata})}\n\n"
        except Exception as e:
            # Send error event
            error_msg = f"Error: {str(e)[:200]}"
            print(f"Error in generate_stream: {error_msg}")
            yield f"data: {json.dumps({'type': 'error', 'message': error_msg})}\n\n"

    return StreamingResponse(generate_stream(), media_type="text/event-stream")


@router.get("/conversations", response_model=list[ConversationSummary])
async def get_conversations(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Get list of user's conversations, limited by subscription tier."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    tier = current_user.subscription_tier or "free"
    display_limit = get_conversation_limit(tier)
    # Return exactly display_limit conversations (no longer need +1 since we don't filter in frontend)
    return_limit = display_limit

    # Get all conversations to check if cleanup is needed
    all_conversations = (
        db.query(Conversation)
        .filter(Conversation.user_id == current_user.id)
        .order_by(Conversation.created_at.desc())
        .all()
    )

    # Clean up any conversations beyond the limit (in case deletion left extra conversations)
    if len(all_conversations) > display_limit:
        conversations_to_delete = all_conversations[display_limit:]
        deleted_count = len(conversations_to_delete)
        for conv_to_delete in conversations_to_delete:
            db.delete(conv_to_delete)
        db.commit()

    # Get user's conversations ordered by created_at DESC, limited to display_limit
    conversations = (
        db.query(Conversation)
        .filter(Conversation.user_id == current_user.id)
        .order_by(Conversation.created_at.desc())
        .limit(return_limit)
        .all()
    )

    # OPTIMIZATION: Get message counts in a single query instead of N+1 queries
    # This dramatically improves performance when there are many conversations
    conversation_ids = [conv.id for conv in conversations]
    message_counts = {}
    if conversation_ids:
        # Single query to get all message counts
        from sqlalchemy import func

        count_results = (
            db.query(
                ConversationMessageModel.conversation_id,
                func.count(ConversationMessageModel.id).label("count"),
            )
            .filter(ConversationMessageModel.conversation_id.in_(conversation_ids))
            .group_by(ConversationMessageModel.conversation_id)
            .all()
        )
        message_counts = {conv_id: count for conv_id, count in count_results}

    # Convert to summaries with message counts
    summaries = []
    for conv in conversations:
        # Parse models_used JSON
        try:
            models_used = json.loads(conv.models_used) if conv.models_used else []
        except (json.JSONDecodeError, TypeError):
            models_used = []

        # Get message count from pre-fetched data (default to 0 if not found)
        message_count = message_counts.get(conv.id, 0)

        summaries.append(
            ConversationSummary(
                id=conv.id,
                input_data=conv.input_data,
                models_used=models_used,
                created_at=conv.created_at,
                message_count=message_count,
            )
        )

    return summaries


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Get full conversation with all messages."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Get conversation and verify it belongs to the user
    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
        .first()
    )

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Parse models_used JSON
    try:
        models_used = json.loads(conversation.models_used) if conversation.models_used else []
    except (json.JSONDecodeError, TypeError):
        models_used = []

    # Get all messages ordered by created_at ASC
    messages = (
        db.query(ConversationMessageModel)
        .filter(ConversationMessageModel.conversation_id == conversation.id)
        .order_by(ConversationMessageModel.created_at.asc())
        .all()
    )

    # Convert messages to schema format
    from ..schemas import ConversationMessage as ConversationMessageSchema

    message_schemas = [
        ConversationMessageSchema(
            id=msg.id,
            model_id=msg.model_id,
            role=msg.role,
            content=msg.content,
            success=msg.success,
            processing_time_ms=msg.processing_time_ms,
            created_at=msg.created_at,
        )
        for msg in messages
    ]

    return ConversationDetail(
        id=conversation.id,
        title=conversation.title,
        input_data=conversation.input_data,
        models_used=models_used,
        created_at=conversation.created_at,
        messages=message_schemas,
    )


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_200_OK)
async def delete_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Delete a conversation and all its messages."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Get conversation and verify it belongs to the user
    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
        .first()
    )

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Delete conversation (messages will be deleted via cascade)
    db.delete(conversation)
    db.commit()

    return {"message": "Conversation deleted successfully"}
