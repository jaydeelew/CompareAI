"""
Hybrid rate limiting for authenticated and anonymous users.

This module provides rate limiting functionality that works with both
authenticated users (subscription-based limits) and anonymous users
(IP/fingerprint-based limits).
"""

from datetime import datetime, date
from typing import Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from .models import User
from collections import defaultdict

# Import configuration constants
from .config import (
    SUBSCRIPTION_CONFIG,
    SUBSCRIPTION_LIMITS,
    MODEL_LIMITS,
    EXTENDED_TIER_LIMITS,
    ANONYMOUS_DAILY_LIMIT,
    ANONYMOUS_MODEL_LIMIT,
    get_model_limit,
    get_daily_limit,
    get_extended_limit,
)

# In-memory storage for anonymous rate limiting
# Structure: { "identifier": { "count": int, "date": str, "first_seen": datetime } }
anonymous_rate_limit_storage: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"count": 0, "date": "", "first_seen": None})


def check_user_rate_limit(user: User, db: Session) -> Tuple[bool, int, int]:
    """
    Check rate limit for authenticated user based on subscription tier.

    Args:
        user: Authenticated user object
        db: Database session

    Returns:
        tuple: (is_allowed, current_count, daily_limit)
    """
    # Reset counter if it's a new day
    today = date.today()
    if user.usage_reset_date != today:
        user.daily_usage_count = 0
        user.usage_reset_date = today
        db.commit()

    # Get daily limit based on subscription tier
    daily_limit = get_daily_limit(user.subscription_tier)

    # Check if user is within limit
    is_allowed = user.daily_usage_count < daily_limit

    return is_allowed, user.daily_usage_count, daily_limit


def increment_user_usage(user: User, db: Session, count: int = 1) -> None:
    """
    Increment authenticated user's daily usage count.

    Args:
        user: Authenticated user object
        db: Database session
        count: Number of model responses to add (default: 1)
    """
    old_count = user.daily_usage_count
    user.daily_usage_count += count
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)  # Refresh to ensure we have the latest state
    print(f"[increment_user_usage] User {user.email}: {old_count} -> {user.daily_usage_count} (added {count})")


def check_anonymous_rate_limit(identifier: str) -> Tuple[bool, int]:
    """
    Check rate limit for anonymous user using IP/fingerprint.

    Args:
        identifier: Unique identifier (e.g., "ip:192.168.1.1" or "fp:xxx")

    Returns:
        tuple: (is_allowed, current_count)
    """
    today = datetime.now().date().isoformat()
    user_data = anonymous_rate_limit_storage[identifier]

    # Reset count if it's a new day
    if user_data["date"] != today:
        user_data["count"] = 0
        user_data["date"] = today
        user_data["first_seen"] = datetime.now()

    current_count = user_data["count"]

    # Anonymous (unregistered) users get 10 model responses per day
    is_allowed = current_count < 10

    return is_allowed, current_count


def increment_anonymous_usage(identifier: str, count: int = 1) -> None:
    """
    Increment usage count for anonymous user.

    Args:
        identifier: Unique identifier (e.g., "ip:192.168.1.1" or "fp:xxx")
        count: Number of model responses to add (default: 1)
    """
    today = datetime.now().date().isoformat()
    user_data = anonymous_rate_limit_storage[identifier]

    if user_data["date"] != today:
        user_data["count"] = count
        user_data["date"] = today
        user_data["first_seen"] = datetime.now()
    else:
        user_data["count"] += count


def get_user_usage_stats(user: User) -> Dict[str, Any]:
    """
    Get usage statistics for authenticated user.

    Args:
        user: Authenticated user object

    Returns:
        dict: Usage statistics including daily usage, limit, remaining, and extended usage
    """
    daily_limit = get_daily_limit(user.subscription_tier)
    remaining = max(0, daily_limit - user.daily_usage_count)
    
    # Get extended tier limits
    extended_limit = get_extended_limit(user.subscription_tier)
    extended_remaining = max(0, extended_limit - user.daily_extended_usage)

    return {
        "daily_usage": user.daily_usage_count,
        "daily_limit": daily_limit,
        "remaining_usage": remaining,
        "daily_extended_usage": user.daily_extended_usage,
        "daily_extended_limit": extended_limit,
        "remaining_extended_usage": extended_remaining,
        "subscription_tier": user.subscription_tier,
        "usage_reset_date": user.usage_reset_date.isoformat(),
    }


def get_anonymous_usage_stats(identifier: str) -> Dict[str, Any]:
    """
    Get usage statistics for anonymous user.

    Args:
        identifier: Unique identifier

    Returns:
        dict: Usage statistics including daily usage, limit, and remaining
    """
    _, current_count = check_anonymous_rate_limit(identifier)
    daily_limit = ANONYMOUS_DAILY_LIMIT
    remaining = max(0, daily_limit - current_count)

    return {
        "daily_usage": current_count,
        "daily_limit": daily_limit,
        "remaining_usage": remaining,
        "subscription_tier": "anonymous",
        "usage_reset_date": date.today().isoformat(),
    }


def should_send_usage_warning(user: User) -> bool:
    """
    Check if usage warning email should be sent to user.

    Sends warning at 80% usage (16/20 for free, 120/150 for starter, 360/450 for pro).

    Args:
        user: Authenticated user object

    Returns:
        bool: True if warning should be sent
    """
    daily_limit = get_daily_limit(user.subscription_tier)
    warning_threshold = int(daily_limit * 0.8)

    return user.daily_usage_count == warning_threshold


def reset_anonymous_rate_limits() -> None:
    """
    Clear all anonymous rate limit storage.

    WARNING: This is for development/testing only.
    In production, rate limits reset automatically at midnight.
    """
    anonymous_rate_limit_storage.clear()


# get_model_limit is now imported from config module


def is_overage_allowed(tier: str) -> bool:
    """
    Check if overage is allowed for a tier.

    Args:
        tier: Subscription tier name

    Returns:
        bool: True if overage is allowed, False otherwise
    """
    config = SUBSCRIPTION_CONFIG.get(tier, {})
    return config.get("overage_allowed", False)


def get_overage_price(tier: str) -> Optional[float]:
    """
    Get overage price per model response for a tier.

    Args:
        tier: Subscription tier name

    Returns:
        float: Price per overage model response, or None if overages not allowed
    """
    config = SUBSCRIPTION_CONFIG.get(tier, {})
    return config.get("overage_price")


def get_extended_overage_price(tier: str) -> Optional[float]:
    """
    Get extended overage price per extended interaction for a tier.

    Args:
        tier: Subscription tier name

    Returns:
        float: Price per overage extended interaction, or None if overages not allowed
    """
    config = SUBSCRIPTION_CONFIG.get(tier, {})
    return config.get("extended_overage_price")


def get_tier_config(tier: str) -> Dict[str, Any]:
    """
    Get complete configuration for a tier.

    Args:
        tier: Subscription tier name

    Returns:
        dict: Tier configuration
    """
    return SUBSCRIPTION_CONFIG.get(tier, SUBSCRIPTION_CONFIG["free"])


def get_rate_limit_info() -> Dict[str, Any]:
    """
    Get information about all rate limits (for debugging).

    Returns:
        dict: Information about subscription tiers and anonymous limits
    """
    return {
        "subscription_tiers": SUBSCRIPTION_LIMITS,
        "model_limits": MODEL_LIMITS,
        "anonymous_limit": ANONYMOUS_DAILY_LIMIT,
        "anonymous_users_tracked": len(anonymous_rate_limit_storage),
    }


# Extended tier usage tracking
# EXTENDED_TIER_LIMITS is now imported from config module


def check_extended_tier_limit(user: User, db: Session) -> Tuple[bool, int, int]:
    """
    Check Extended tier limit for authenticated user.

    Args:
        user: Authenticated user object
        db: Database session

    Returns:
        tuple: (is_allowed, current_count, daily_limit)
    """
    # Reset counter if it's a new day
    today = date.today()
    if user.extended_usage_reset_date != today:
        user.daily_extended_usage = 0
        user.extended_usage_reset_date = today
        db.commit()

    # Get daily limit based on subscription tier
    daily_limit = get_extended_limit(user.subscription_tier)

    # Check if user is within limit
    is_allowed = user.daily_extended_usage < daily_limit

    return is_allowed, user.daily_extended_usage, daily_limit


def increment_extended_usage(user: User, db: Session, count: int = 1) -> None:
    """
    Increment authenticated user's daily Extended usage count.

    Args:
        user: Authenticated user object
        db: Database session
        count: Number of Extended responses to add (default: 1)
    """
    old_count = user.daily_extended_usage
    user.daily_extended_usage += count
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)  # Refresh to ensure we have the latest state
    print(f"[increment_extended_usage] User {user.email}: {old_count} -> {user.daily_extended_usage} (added {count})")


def check_anonymous_extended_limit(identifier: str) -> Tuple[bool, int]:
    """
    Check Extended tier limit for anonymous user.

    Args:
        identifier: IP or fingerprint identifier

    Returns:
        tuple: (is_allowed, current_count)
    """
    today = date.today().isoformat()
    storage_key = f"{identifier}_extended"

    # Reset if new day
    if anonymous_rate_limit_storage[storage_key]["date"] != today:
        anonymous_rate_limit_storage[storage_key] = {"count": 0, "date": today, "first_seen": datetime.now()}

    current_count = anonymous_rate_limit_storage[storage_key]["count"]
    daily_limit = EXTENDED_TIER_LIMITS["anonymous"]

    is_allowed = current_count < daily_limit

    return is_allowed, current_count


def increment_anonymous_extended_usage(identifier: str, count: int = 1) -> None:
    """
    Increment anonymous user's Extended usage count.

    Args:
        identifier: IP or fingerprint identifier
        count: Number of Extended responses to add (default: 1)
    """
    today = date.today().isoformat()
    storage_key = f"{identifier}_extended"

    if storage_key not in anonymous_rate_limit_storage:
        anonymous_rate_limit_storage[storage_key] = {"count": 0, "date": today, "first_seen": datetime.now()}

    anonymous_rate_limit_storage[storage_key]["count"] += count


def decrement_extended_usage(user: User, db: Session, count: int = 1) -> None:
    """
    Decrement authenticated user's daily Extended usage count.
    Used when requests fail and should not count against limit.

    Args:
        user: Authenticated user object
        db: Database session
        count: Number of Extended responses to remove (default: 1)
    """
    user.daily_extended_usage = max(0, user.daily_extended_usage - count)
    user.updated_at = datetime.utcnow()
    db.commit()


def decrement_anonymous_extended_usage(identifier: str, count: int = 1) -> None:
    """
    Decrement anonymous user's Extended usage count.
    Used when requests fail and should not count against limit.

    Args:
        identifier: IP or fingerprint identifier
        count: Number of Extended responses to remove (default: 1)
    """
    storage_key = f"{identifier}_extended"

    if storage_key in anonymous_rate_limit_storage:
        anonymous_rate_limit_storage[storage_key]["count"] = max(0, anonymous_rate_limit_storage[storage_key]["count"] - count)


def get_anonymous_extended_usage_stats(identifier: str) -> Dict[str, Any]:
    """
    Get Extended tier usage statistics for anonymous user.

    Args:
        identifier: IP or fingerprint identifier

    Returns:
        dict: Extended usage statistics including daily usage, limit, and remaining
    """
    _, current_count = check_anonymous_extended_limit(identifier)
    daily_limit = EXTENDED_TIER_LIMITS["anonymous"]
    remaining = max(0, daily_limit - current_count)

    return {
        "daily_extended_usage": current_count,
        "daily_extended_limit": daily_limit,
        "remaining_extended_usage": remaining,
        "subscription_tier": "anonymous",
        "usage_reset_date": date.today().isoformat(),
    }
