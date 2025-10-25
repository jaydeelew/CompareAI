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
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

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
from .routers import auth, admin, api

# Import model_stats from api router to share the same storage
from .routers.api import model_stats

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
        "http://localhost:5175",  # Alternative local port
        "http://localhost:3000",  # Alternative local port
        "http://127.0.0.1:5173",  # Alternative localhost
        "http://127.0.0.1:5174",  # Alternative localhost
        "http://127.0.0.1:5175",  # Alternative localhost
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

# Include routers AFTER middleware
app.include_router(auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(api.router, prefix="/api")

# Maximum number of models allowed per request
MAX_MODELS_PER_REQUEST = 9

# Rate limiting configuration
MAX_DAILY_COMPARISONS = 10

# Note: model_stats is now imported from .routers.api to share the same storage


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


def log_usage_to_db(usage_log: UsageLog, db: Session):
    """Background task to log usage to database without blocking the response."""
    try:
        db.add(usage_log)
        db.commit()
    except Exception as e:
        print(f"Failed to log usage to database: {e}")
        db.rollback()
