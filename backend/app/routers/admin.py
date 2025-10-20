"""
Admin management endpoints for CompareAI.

This module provides comprehensive user management functionality including
user CRUD operations, role management, and audit logging.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_
from typing import List, Optional
from datetime import datetime, timedelta
import json

from ..database import get_db
from ..models import User, AdminActionLog
from ..schemas import (
    AdminUserResponse,
    AdminUserCreate,
    AdminUserUpdate,
    AdminUserListResponse,
    AdminActionLogResponse,
    AdminStatsResponse,
)
from ..dependencies import get_current_admin_user, require_admin_role
from ..auth import get_password_hash
from ..email_service import send_verification_email

router = APIRouter(prefix="/admin", tags=["admin"])


def log_admin_action(
    db: Session,
    admin_user: User,
    action_type: str,
    action_description: str,
    target_user_id: Optional[int] = None,
    details: Optional[dict] = None,
    request: Optional[Request] = None,
):
    """Log admin action for audit trail."""
    log_entry = AdminActionLog(
        admin_user_id=admin_user.id,
        target_user_id=target_user_id,
        action_type=action_type,
        action_description=action_description,
        details=json.dumps(details) if details else None,
        ip_address=request.client.host if request else None,
        user_agent=request.headers.get("user-agent") if request else None,
    )
    db.add(log_entry)
    db.commit()


@router.get("/stats", response_model=AdminStatsResponse)
async def get_admin_stats(current_user: User = Depends(get_current_admin_user), db: Session = Depends(get_db)):
    """Get admin dashboard statistics."""

    # Basic user counts
    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.is_active == True).count()
    verified_users = db.query(User).filter(User.is_verified == True).count()

    # Users by subscription tier
    users_by_tier = {}
    for tier in ["free", "starter", "pro"]:
        count = db.query(User).filter(User.subscription_tier == tier).count()
        users_by_tier[tier] = count

    # Users by role
    users_by_role = {}
    for role in ["user", "moderator", "admin", "super_admin"]:
        count = db.query(User).filter(User.role == role).count()
        users_by_role[role] = count

    # Recent registrations (last 7 days)
    week_ago = datetime.utcnow() - timedelta(days=7)
    recent_registrations = db.query(User).filter(User.created_at >= week_ago).count()

    # Usage stats for today
    today = datetime.utcnow().date()
    total_usage_today = db.query(func.sum(User.daily_usage_count)).filter(User.usage_reset_date == today).scalar() or 0

    # Admin actions today
    admin_actions_today = db.query(AdminActionLog).filter(func.date(AdminActionLog.created_at) == today).count()

    return AdminStatsResponse(
        total_users=total_users,
        active_users=active_users,
        verified_users=verified_users,
        users_by_tier=users_by_tier,
        users_by_role=users_by_role,
        recent_registrations=recent_registrations,
        total_usage_today=total_usage_today,
        admin_actions_today=admin_actions_today,
    )


@router.get("/users", response_model=AdminUserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    tier: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """List users with filtering and pagination."""

    query = db.query(User)

    # Apply filters
    if search:
        query = query.filter(User.email.ilike(f"%{search}%"))

    if role:
        query = query.filter(User.role == role)

    if tier:
        query = query.filter(User.subscription_tier == tier)

    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    # Get total count
    total = query.count()

    # Apply pagination
    offset = (page - 1) * per_page
    users = query.order_by(desc(User.created_at)).offset(offset).limit(per_page).all()

    # Calculate total pages
    total_pages = (total + per_page - 1) // per_page

    return AdminUserListResponse(
        users=[AdminUserResponse.from_orm(user) for user in users],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


@router.get("/users/{user_id}", response_model=AdminUserResponse)
async def get_user(user_id: int, current_user: User = Depends(get_current_admin_user), db: Session = Depends(get_db)):
    """Get specific user details."""

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return AdminUserResponse.from_orm(user)


@router.post("/users", response_model=AdminUserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: AdminUserCreate,
    request: Request,
    current_user: User = Depends(require_admin_role("admin")),
    db: Session = Depends(get_db),
):
    """Create a new user."""

    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create user
    user = User(
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        role=user_data.role,
        is_admin=user_data.role in ["moderator", "admin", "super_admin"],
        subscription_tier=user_data.subscription_tier,
        subscription_period=user_data.subscription_period,
        is_active=user_data.is_active,
        is_verified=user_data.is_verified,
        subscription_status="active" if user_data.subscription_tier != "free" else "active",
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    # Log admin action
    log_admin_action(
        db=db,
        admin_user=current_user,
        action_type="user_create",
        action_description=f"Created user {user.email}",
        target_user_id=user.id,
        details={
            "email": user.email,
            "role": user.role,
            "subscription_tier": user.subscription_tier,
            "is_active": user.is_active,
            "is_verified": user.is_verified,
        },
        request=request,
    )

    return AdminUserResponse.from_orm(user)


@router.put("/users/{user_id}", response_model=AdminUserResponse)
async def update_user(
    user_id: int,
    user_data: AdminUserUpdate,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Update user details."""

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent self-demotion
    if user_id == current_user.id and user_data.role and user_data.role != current_user.role:
        raise HTTPException(status_code=400, detail="Cannot modify your own role")

    # Store original values for logging
    original_values = {
        "email": user.email,
        "role": user.role,
        "subscription_tier": user.subscription_tier,
        "subscription_status": user.subscription_status,
        "subscription_period": user.subscription_period,
        "is_active": user.is_active,
        "is_verified": user.is_verified,
        "daily_usage_count": user.daily_usage_count,
        "monthly_overage_count": user.monthly_overage_count,
    }

    # Update fields
    update_data = user_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(user, field):
            setattr(user, field, value)

    # Update admin status based on role
    if user_data.role:
        user.is_admin = user_data.role in ["moderator", "admin", "super_admin"]

    db.commit()
    db.refresh(user)

    # Log admin action
    changes = {k: v for k, v in update_data.items() if original_values.get(k) != v}
    log_admin_action(
        db=db,
        admin_user=current_user,
        action_type="user_update",
        action_description=f"Updated user {user.email}",
        target_user_id=user.id,
        details={"original_values": original_values, "changes": changes},
        request=request,
    )

    return AdminUserResponse.from_orm(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int, request: Request, current_user: User = Depends(require_admin_role("super_admin")), db: Session = Depends(get_db)
):
    """Delete a user (super admin only)."""

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent self-deletion
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    # Prevent deletion of other super admins
    if user.role == "super_admin" and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Cannot delete super admin accounts")

    # Log admin action before deletion
    log_admin_action(
        db=db,
        admin_user=current_user,
        action_type="user_delete",
        action_description=f"Deleted user {user.email}",
        target_user_id=user.id,
        details={
            "email": user.email,
            "role": user.role,
            "subscription_tier": user.subscription_tier,
            "created_at": user.created_at.isoformat(),
        },
        request=request,
    )

    db.delete(user)
    db.commit()


@router.post("/users/{user_id}/reset-password", status_code=status.HTTP_200_OK)
async def reset_user_password(
    user_id: int,
    new_password: str,
    request: Request,
    current_user: User = Depends(require_admin_role("admin")),
    db: Session = Depends(get_db),
):
    """Reset user password."""

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Validate password strength
    if len(new_password) < 12:
        raise HTTPException(status_code=400, detail="Password must be at least 12 characters long")

    # Update password
    user.password_hash = get_password_hash(new_password)
    db.commit()

    # Log admin action
    log_admin_action(
        db=db,
        admin_user=current_user,
        action_type="password_reset",
        action_description=f"Reset password for user {user.email}",
        target_user_id=user.id,
        request=request,
    )

    return {"message": "Password reset successfully"}


@router.post("/users/{user_id}/send-verification", status_code=status.HTTP_200_OK)
async def send_user_verification(
    user_id: int, request: Request, current_user: User = Depends(get_current_admin_user), db: Session = Depends(get_db)
):
    """Send verification email to user."""

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.is_verified:
        raise HTTPException(status_code=400, detail="User is already verified")

    # Generate new verification token
    from ..auth import generate_verification_token

    user.verification_token = generate_verification_token()
    user.verification_token_expires = datetime.utcnow() + timedelta(hours=24)
    db.commit()

    # Send verification email
    try:
        await send_verification_email(user.email, user.verification_token)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send verification email: {str(e)}")

    # Log admin action
    log_admin_action(
        db=db,
        admin_user=current_user,
        action_type="send_verification",
        action_description=f"Sent verification email to user {user.email}",
        target_user_id=user.id,
        request=request,
    )

    return {"message": "Verification email sent successfully"}


@router.get("/action-logs", response_model=List[AdminActionLogResponse])
async def get_action_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    action_type: Optional[str] = Query(None),
    admin_user_id: Optional[int] = Query(None),
    target_user_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Get admin action logs."""

    query = db.query(AdminActionLog)

    # Apply filters
    if action_type:
        query = query.filter(AdminActionLog.action_type == action_type)

    if admin_user_id:
        query = query.filter(AdminActionLog.admin_user_id == admin_user_id)

    if target_user_id:
        query = query.filter(AdminActionLog.target_user_id == target_user_id)

    # Apply pagination
    offset = (page - 1) * per_page
    logs = query.order_by(desc(AdminActionLog.created_at)).offset(offset).limit(per_page).all()

    return [AdminActionLogResponse.from_orm(log) for log in logs]


@router.post("/users/{user_id}/toggle-active", response_model=AdminUserResponse)
async def toggle_user_active(
    user_id: int, request: Request, current_user: User = Depends(get_current_admin_user), db: Session = Depends(get_db)
):
    """Toggle user active status."""

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent self-deactivation
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot modify your own active status")

    # Toggle active status
    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)

    # Log admin action
    log_admin_action(
        db=db,
        admin_user=current_user,
        action_type="toggle_active",
        action_description=f"{'Activated' if user.is_active else 'Deactivated'} user {user.email}",
        target_user_id=user.id,
        details={"is_active": user.is_active},
        request=request,
    )

    return AdminUserResponse.from_orm(user)


@router.post("/users/{user_id}/reset-usage", response_model=AdminUserResponse)
async def reset_user_usage(
    user_id: int, request: Request, current_user: User = Depends(get_current_admin_user), db: Session = Depends(get_db)
):
    """Reset user's daily usage count to zero."""

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Store previous usage count for logging
    previous_usage = user.daily_usage_count

    # Reset daily usage count to 0
    user.daily_usage_count = 0
    db.commit()
    db.refresh(user)

    # Log admin action
    log_admin_action(
        db=db,
        admin_user=current_user,
        action_type="reset_usage",
        action_description=f"Reset daily usage for user {user.email}",
        target_user_id=user.id,
        details={"previous_usage": previous_usage, "new_usage": 0},
        request=request,
    )

    return AdminUserResponse.from_orm(user)
