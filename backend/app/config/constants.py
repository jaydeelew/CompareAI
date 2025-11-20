"""
Application constants and configuration values.

This module contains all application constants including:
- Subscription tier configurations
- Rate limits
- Performance settings
- Feature flags

All constants should be imported from this module to maintain a single source of truth.
"""

from typing import Dict, Any
from ..types import TierConfigDict, TierLimitsDict


# ============================================================================
# Subscription Tier Configuration
# ============================================================================
# MODEL-BASED PRICING: daily_limit = model responses per day (not comparisons)
# model_limit = max models per comparison (tiered: 3/6/6/9/12)
# overage_allowed = whether tier can purchase additional interactions beyond daily limit
# overage_price = price per additional model response (TBD - pricing not yet finalized)
# extended_overage_price = price per additional extended interaction (TBD - pricing not yet finalized)

SUBSCRIPTION_CONFIG: Dict[str, TierConfigDict] = {
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
        "model_limit": 12,
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

TIER_LIMITS: Dict[str, TierLimitsDict] = {
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

