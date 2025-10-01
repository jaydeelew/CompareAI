from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from typing import Any
from app.model_runner import run_models, OPENROUTER_MODELS, MODELS_BY_PROVIDER
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
import asyncio
import os
import json
from collections import defaultdict
from typing import Dict, Any, Optional

print(f"Starting in {os.environ.get('ENVIRONMENT', 'production')} mode")

app = FastAPI(title="CompareAI API", version="1.0.0")

# Maximum number of models allowed per request
MAX_MODELS_PER_REQUEST = 12

# Rate limiting configuration
MAX_DAILY_COMPARISONS = 10

# In-memory storage for model performance tracking
model_stats: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"success": 0, "failure": 0, "last_error": None, "last_success": None})

# In-memory storage for rate limiting (IP address and browser fingerprint)
# Structure: { "identifier": { "count": int, "date": str, "first_seen": datetime } }
rate_limit_storage: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"count": 0, "date": "", "first_seen": None})

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://54.163.207.252",  # Your frontend URL
        "http://compareintel.com",  # Your frontend domain
        "http://localhost:5173",  # For local development
        "http://localhost:3000",  # Alternative local port
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
async def compare(req: CompareRequest, request: Request) -> CompareResponse:
    if not req.input_data.strip():
        raise HTTPException(status_code=400, detail="Input data cannot be empty")

    if not req.models:
        raise HTTPException(status_code=400, detail="At least one model must be selected")

    # Enforce model limit
    if len(req.models) > MAX_MODELS_PER_REQUEST:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_MODELS_PER_REQUEST} models allowed per request. You selected {len(req.models)} models.",
        )
    
    # --- RATE LIMITING ENFORCEMENT ---
    # Get client identifiers (IP + optional fingerprint)
    client_ip = get_client_ip(request)
    
    # Check rate limit for IP address (primary check)
    ip_allowed, ip_count = check_rate_limit(f"ip:{client_ip}")
    
    # Check rate limit for browser fingerprint (secondary check, if provided)
    fingerprint_allowed = True
    fingerprint_count = 0
    if req.browser_fingerprint:
        fingerprint_allowed, fingerprint_count = check_rate_limit(f"fp:{req.browser_fingerprint}")
    
    # Deny if EITHER identifier has exceeded the limit
    if not ip_allowed or not fingerprint_allowed:
        max_count = max(ip_count, fingerprint_count)
        raise HTTPException(
            status_code=429,  # 429 Too Many Requests
            detail=f"Daily limit of {MAX_DAILY_COMPARISONS} comparisons exceeded. You've used {max_count} today. Resets at midnight UTC."
        )
    
    # Increment usage counters for both identifiers
    increment_usage(f"ip:{client_ip}")
    if req.browser_fingerprint:
        increment_usage(f"fp:{req.browser_fingerprint}")
    
    print(f"Rate limit check passed - IP: {client_ip} ({ip_count + 1}/{MAX_DAILY_COMPARISONS}), Fingerprint: {req.browser_fingerprint[:20] if req.browser_fingerprint else 'None'} ({fingerprint_count + 1 if req.browser_fingerprint else 0}/{MAX_DAILY_COMPARISONS})")
    # --- END RATE LIMITING ---

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

        # Add metadata
        metadata = {
            "input_length": len(req.input_data),
            "models_requested": len(req.models),
            "models_successful": successful_models,
            "models_failed": failed_models,
            "timestamp": datetime.now().isoformat(),
        }

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
async def get_rate_limit_status(request: Request, fingerprint: Optional[str] = None):
    """Get current rate limit status for the client"""
    client_ip = get_client_ip(request)
    
    # Check IP-based usage
    ip_allowed, ip_count = check_rate_limit(f"ip:{client_ip}")
    
    result = {
        "ip_address": client_ip,
        "ip_usage_count": ip_count,
        "max_daily_limit": MAX_DAILY_COMPARISONS,
        "remaining": max(0, MAX_DAILY_COMPARISONS - ip_count),
        "is_limited": not ip_allowed,
    }
    
    # Check fingerprint-based usage if provided
    if fingerprint:
        fp_allowed, fp_count = check_rate_limit(f"fp:{fingerprint}")
        result["fingerprint_usage_count"] = fp_count
        result["fingerprint_remaining"] = max(0, MAX_DAILY_COMPARISONS - fp_count)
        result["fingerprint_limited"] = not fp_allowed
    
    return result
