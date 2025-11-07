"""
Centralized configuration for CompareAI backend.

This module consolidates all configuration constants to avoid duplication
and provides a single source of truth for application settings.

All configuration constants should be imported from this module.
"""

from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Dict, Any, Optional
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
# Handle both running from project root and backend directory
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)
else:
    # Fallback to parent directory
    load_dotenv(Path(__file__).parent.parent.parent / ".env")


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    
    Uses Pydantic Settings v2 for type validation and environment variable loading.
    """
    
    # Database
    # Default path is now in backend/data/ directory for clean project structure
    database_url: str = "sqlite:///./data/compareintel.db"
    
    # Security
    secret_key: str
    
    # API Keys
    openrouter_api_key: str
    
    # Email (Optional)
    mail_username: Optional[str] = None
    mail_password: Optional[str] = None
    mail_from: Optional[str] = None
    mail_server: Optional[str] = None
    mail_port: Optional[int] = None
    
    @field_validator('mail_port', mode='before')
    @classmethod
    def parse_mail_port(cls, v):
        """Convert empty strings to None for mail_port."""
        if v == '' or v is None:
            return None
        return v
    
    # Frontend
    frontend_url: str = "http://localhost:5173"
    
    # Environment
    environment: str = "development"
    
    # Performance Configuration
    max_concurrent_requests: int = 9
    individual_model_timeout: int = 120
    batch_size: int = 9
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"


# Create settings instance
settings = Settings()


# ============================================================================
# Subscription Tier Configuration
# ============================================================================
# MODEL-BASED PRICING: daily_limit = model responses per day (not comparisons)
# model_limit = max models per comparison (tiered: 3/6/6/9/9)
# overage_allowed = whether tier can purchase additional interactions beyond daily limit
# overage_price = price per additional model response (TBD - pricing not yet finalized)
# extended_overage_price = price per additional extended interaction (TBD - pricing not yet finalized)

SUBSCRIPTION_CONFIG: Dict[str, Dict[str, Any]] = {
    "free": {
        "daily_limit": 20,
        "model_limit": 3,
        "overage_allowed": False,
        "overage_price": None,
        "extended_overage_price": None,
    },  # Free registered users
    "starter": {
        "daily_limit": 50,
        "model_limit": 6,
        "overage_allowed": True,
        "overage_price": None,
        "extended_overage_price": None,
    },  # Pricing TBD
    "starter_plus": {
        "daily_limit": 100,
        "model_limit": 6,
        "overage_allowed": True,
        "overage_price": None,
        "extended_overage_price": None,
    },  # Pricing TBD
    "pro": {
        "daily_limit": 200,
        "model_limit": 9,
        "overage_allowed": True,
        "overage_price": None,
        "extended_overage_price": None,
    },  # Pricing TBD
    "pro_plus": {
        "daily_limit": 400,
        "model_limit": 9,
        "overage_allowed": True,
        "overage_price": None,
        "extended_overage_price": None,
    },  # Pricing TBD
}

# Backwards compatibility - extract limits
SUBSCRIPTION_LIMITS: Dict[str, int] = {
    tier: config["daily_limit"] for tier, config in SUBSCRIPTION_CONFIG.items()
}

MODEL_LIMITS: Dict[str, int] = {
    tier: config["model_limit"] for tier, config in SUBSCRIPTION_CONFIG.items()
}


# ============================================================================
# Extended Tier Daily Limits
# ============================================================================
# Maximum number of times Extended mode can be used per day per subscription tier
# Extended mode is only triggered when the user explicitly clicks the Extended mode button

EXTENDED_TIER_LIMITS: Dict[str, int] = {
    "anonymous": 2,
    "free": 5,
    "starter": 10,
    "starter_plus": 20,
    "pro": 40,
    "pro_plus": 80,
}


# ============================================================================
# Tier Limits for Input/Output
# ============================================================================
# Input/output character and token limits for each response tier

TIER_LIMITS: Dict[str, Dict[str, int]] = {
    "brief": {"input_chars": 1000, "output_tokens": 2000},
    "standard": {"input_chars": 5000, "output_tokens": 4000},
    "extended": {"input_chars": 15000, "output_tokens": 8192},
}


# ============================================================================
# Anonymous User Limits
# ============================================================================
# Limits for unregistered (anonymous) users

ANONYMOUS_DAILY_LIMIT: int = 10  # Model responses per day for anonymous users
ANONYMOUS_MODEL_LIMIT: int = 3  # Maximum models per comparison for anonymous users
ANONYMOUS_EXTENDED_LIMIT: int = EXTENDED_TIER_LIMITS["anonymous"]  # Extended tier limit (2)


# ============================================================================
# Conversation History Limits
# ============================================================================
# Maximum number of conversations stored per subscription tier
# Each conversation (with or without follow-ups) counts as 1 conversation

CONVERSATION_LIMITS: Dict[str, int] = {
    "anonymous": 2,
    "free": 3,
    "starter": 10,
    "starter_plus": 20,
    "pro": 40,
    "pro_plus": 80,
}


# ============================================================================
# Helper Functions
# ============================================================================

def get_model_limit(tier: str) -> int:
    """
    Get maximum models per comparison for a given subscription tier.
    
    Args:
        tier: Subscription tier name
        
    Returns:
        Maximum number of models allowed per comparison
    """
    return MODEL_LIMITS.get(tier, 3)  # Default to free tier limit


def get_daily_limit(tier: str) -> int:
    """
    Get daily model response limit for a given subscription tier.
    
    Args:
        tier: Subscription tier name
        
    Returns:
        Daily limit for model responses
    """
    return SUBSCRIPTION_LIMITS.get(tier, ANONYMOUS_DAILY_LIMIT)


def get_extended_limit(tier: str) -> int:
    """
    Get Extended tier daily limit for a given subscription tier.
    
    Args:
        tier: Subscription tier name
        
    Returns:
        Daily Extended tier limit
    """
    return EXTENDED_TIER_LIMITS.get(tier, EXTENDED_TIER_LIMITS["anonymous"])


def get_conversation_limit(tier: str) -> int:
    """
    Get conversation history limit for a given subscription tier.
    
    Args:
        tier: Subscription tier name
        
    Returns:
        Maximum number of conversations stored (each conversation counts as 1)
    """
    return CONVERSATION_LIMITS.get(tier, 2)  # Default to anonymous limit


def validate_tier_limits(input_data: str, tier: str) -> bool:
    """
    Validate input length against tier limits.
    
    Args:
        input_data: Input text to validate
        tier: Response tier (brief, standard, extended)
        
    Returns:
        True if input is within limits, False otherwise
    """
    if tier not in TIER_LIMITS:
        return False
    return len(input_data) <= TIER_LIMITS[tier]["input_chars"]


def get_tier_max_tokens(tier: str) -> int:
    """
    Get maximum output tokens for a given response tier.
    
    Args:
        tier: Response tier (brief, standard, extended)
        
    Returns:
        Maximum output tokens for the tier
    """
    return TIER_LIMITS.get(tier, TIER_LIMITS["standard"])["output_tokens"]


# ============================================================================
# Performance Configuration
# ============================================================================
# Model runner performance settings are configured in the Settings class above
# (max_concurrent_requests, individual_model_timeout, batch_size)
# These can be overridden via environment variables.
# 
# Configuration optimized for 9-model limit (Pro tier maximum).
# For slower connections, you may want to reduce max_concurrent_requests to 6-8
# and increase individual_model_timeout to 60-90 seconds via environment variables.


# ============================================================================
# Configuration Validation
# ============================================================================

def validate_config() -> None:
    """
    Validate configuration on startup.
    Raises ValueError if required configuration is missing or invalid.
    """
    if not settings.secret_key:
        raise ValueError(
            "SECRET_KEY environment variable is not set. "
            'Generate one with: python -c "import secrets; print(secrets.token_urlsafe(32))"'
        )
    
    if not settings.openrouter_api_key:
        raise ValueError(
            "OPENROUTER_API_KEY environment variable is not set. "
            "Get your key from: https://openrouter.ai/keys"
        )
    
    # Validate tier limits consistency
    if ANONYMOUS_MODEL_LIMIT not in MODEL_LIMITS.values():
        raise ValueError(
            f"ANONYMOUS_MODEL_LIMIT ({ANONYMOUS_MODEL_LIMIT}) must match a value in MODEL_LIMITS"
        )
    
    # Validate extended limits
    if "anonymous" not in EXTENDED_TIER_LIMITS:
        raise ValueError("EXTENDED_TIER_LIMITS must include 'anonymous' tier")


# Run validation on import (optional - can be disabled for testing)
if os.getenv("SKIP_CONFIG_VALIDATION", "false").lower() != "true":
    try:
        validate_config()
    except ValueError as e:
        # Only raise in production or if explicitly configured
        if settings.environment == "production":
            raise
        # In development, just warn
        import warnings
        warnings.warn(f"Configuration validation warning: {e}", UserWarning)

