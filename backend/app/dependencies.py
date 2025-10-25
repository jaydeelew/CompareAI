"""
FastAPI dependencies for authentication and authorization.

This module provides dependency functions for protecting routes
and checking user permissions.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
from .database import get_db
from .models import User
from .auth import verify_token

# HTTP Bearer token security scheme
security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security), db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Get current authenticated user from JWT token.
    Returns None if not authenticated (for optional authentication).

    Args:
        credentials: HTTP Bearer token credentials
        db: Database session

    Returns:
        User: Current user if authenticated, None otherwise
    """
    if credentials is None:
        return None

    token = credentials.credentials
    payload = verify_token(token, token_type="access")

    if payload is None:
        return None

    user_id_str = payload.get("sub")
    if user_id_str is None:
        return None

    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        return None

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        return None

    if not user.is_active:
        return None

    return user


def get_current_user_required(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security), db: Session = Depends(get_db)
) -> User:
    """
    Get current authenticated user from JWT token (required).
    Raises exception if not authenticated.

    Args:
        credentials: HTTP Bearer token credentials
        db: Database session

    Returns:
        User: Current authenticated user

    Raises:
        HTTPException: If authentication fails
    """
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    token = credentials.credentials
    payload = verify_token(token, token_type="access")

    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")

    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")

    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive")

    return user


def get_current_verified_user(current_user: User = Depends(get_current_user_required)) -> User:
    """
    Get current authenticated user with verified email.

    Returns:
        User: Current authenticated user with verified email

    Raises:
        HTTPException: If user email is not verified
    """
    if not current_user.is_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email verification required")
    return current_user


def check_subscription_tier(required_tier: str):
    """
    Dependency factory to check if user has required subscription tier.

    Args:
        required_tier: Required subscription tier

    Returns:
        Dependency function that validates subscription tier
    """
    tier_hierarchy = {"free": 0, "starter": 1, "starter_plus": 2, "pro": 3, "pro_plus": 4}

    def dependency(current_user: User = Depends(get_current_verified_user)) -> User:
        user_tier_level = tier_hierarchy.get(current_user.subscription_tier, 0)
        required_tier_level = tier_hierarchy.get(required_tier, 0)

        if user_tier_level < required_tier_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This feature requires {required_tier} subscription or higher",
            )
        return current_user

    return dependency


def require_admin_role(required_role: str = "admin"):
    """
    Dependency factory to check if user has required admin role.

    Args:
        required_role: Minimum required role ('moderator', 'admin', 'super_admin')

    Returns:
        Dependency function that validates admin role
    """
    role_hierarchy = {"moderator": 1, "admin": 2, "super_admin": 3}

    def dependency(current_user: User = Depends(get_current_verified_user)) -> User:
        if not current_user.is_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

        user_role_level = role_hierarchy.get(current_user.role, 0)
        required_role_level = role_hierarchy.get(required_role, 0)

        if user_role_level < required_role_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=f"This feature requires {required_role} role or higher"
            )

        return current_user

    return dependency


def get_current_admin_user(current_user: User = Depends(require_admin_role())) -> User:
    """
    Get current authenticated admin user.

    Returns:
        User: Current authenticated admin user
    """
    return current_user
