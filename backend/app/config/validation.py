"""
Configuration validation functions.

This module provides validation functions to ensure configuration consistency
and required settings are present on startup.
"""

from typing import Dict, Any
from .settings import settings
from .constants import (
    MODEL_LIMITS,
    ANONYMOUS_MODEL_LIMIT,
    EXTENDED_TIER_LIMITS,
)


# ============================================================================
# Configuration Validation
# ============================================================================

def validate_config() -> None:
    """
    Validate configuration on startup.
    
    Raises ValueError if required configuration is missing or invalid.
    
    This function checks:
    - Required environment variables are set
    - Configuration consistency (tier limits, etc.)
    - Configuration values are within expected ranges
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
    
    # Validate performance settings
    if settings.max_concurrent_requests < 1:
        raise ValueError("max_concurrent_requests must be at least 1")
    
    if settings.individual_model_timeout < 1:
        raise ValueError("individual_model_timeout must be at least 1 second")
    
    if settings.batch_size < 1:
        raise ValueError("batch_size must be at least 1")


def validate_tier_limits(input_data: str, tier: str) -> bool:
    """
    Validate input length against tier limits.
    
    Args:
        input_data: Input text to validate
        tier: Response tier (brief, standard, extended)
        
    Returns:
        True if input is within limits, False otherwise
    """
    from .constants import TIER_LIMITS
    
    if tier not in TIER_LIMITS:
        return False
    return len(input_data) <= TIER_LIMITS[tier]["input_chars"]

