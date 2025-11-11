"""
Configuration helper functions.

This module provides utility functions for accessing and working with
configuration values.
"""

from typing import Dict
from .constants import (
    MODEL_LIMITS,
    SUBSCRIPTION_LIMITS,
    EXTENDED_TIER_LIMITS,
    CONVERSATION_LIMITS,
    TIER_LIMITS,
    ANONYMOUS_DAILY_LIMIT,
)


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


def get_tier_max_tokens(tier: str) -> int:
    """
    Get maximum output tokens for a given response tier.
    
    Args:
        tier: Response tier (standard, extended)
        
    Returns:
        Maximum output tokens for the tier
    """
    return TIER_LIMITS.get(tier, TIER_LIMITS["standard"])["output_tokens"]

