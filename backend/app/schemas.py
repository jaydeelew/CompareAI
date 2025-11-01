"""
Pydantic schemas for request/response validation.

This module defines all data models for API requests and responses.
"""

from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List, Dict
from datetime import datetime, date


# ============================================================================
# User Schemas
# ============================================================================


class UserRegister(BaseModel):
    """Schema for user registration request."""

    email: EmailStr
    password: str = Field(..., min_length=12)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        """Validate password meets strength requirements."""
        if not any(char.isdigit() for char in v):
            raise ValueError("Password must contain at least one digit")
        if not any(char.isupper() for char in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(char.islower() for char in v):
            raise ValueError("Password must contain at least one lowercase letter")
        # Check for special character
        special_chars = "!@#$%^&*()_+-=[]{};':\"\\|,.<>/?"
        if not any(char in special_chars for char in v):
            raise ValueError("Password must contain at least one special character (!@#$%^&*()_+-=[]{};':\"|,.<>/?)")
        return v


class UserLogin(BaseModel):
    """Schema for user login request."""

    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """Schema for user data response."""

    id: int
    email: str
    is_verified: bool
    is_active: bool
    role: str
    is_admin: bool
    subscription_tier: str
    subscription_status: str
    subscription_period: str
    daily_usage_count: int
    monthly_overage_count: int
    mock_mode_enabled: Optional[bool] = False  # Testing feature for admins
    created_at: datetime
    updated_at: Optional[datetime] = None
    usage_reset_date: Optional[date] = None
    extended_usage_reset_date: Optional[date] = None
    daily_extended_usage: int = 0

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    """Schema for authentication token response."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshTokenRequest(BaseModel):
    """Schema for token refresh request."""

    refresh_token: str


# ============================================================================
# Email Verification Schemas
# ============================================================================


class EmailVerification(BaseModel):
    """Schema for email verification request."""

    token: str


class ResendVerificationRequest(BaseModel):
    """Schema for resending verification email."""

    email: EmailStr


# ============================================================================
# Password Reset Schemas
# ============================================================================


class PasswordResetRequest(BaseModel):
    """Schema for password reset request."""

    email: EmailStr


class PasswordReset(BaseModel):
    """Schema for completing password reset."""

    token: str
    new_password: str = Field(..., min_length=12)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v):
        """Validate password meets strength requirements."""
        if not any(char.isdigit() for char in v):
            raise ValueError("Password must contain at least one digit")
        if not any(char.isupper() for char in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(char.islower() for char in v):
            raise ValueError("Password must contain at least one lowercase letter")
        # Check for special character
        special_chars = "!@#$%^&*()_+-=[]{};':\"\\|,.<>/?"
        if not any(char in special_chars for char in v):
            raise ValueError("Password must contain at least one special character (!@#$%^&*()_+-=[]{};':\"|,.<>/?)")
        return v


# ============================================================================
# Subscription Schemas
# ============================================================================


class SubscriptionUpdate(BaseModel):
    """Schema for updating subscription."""

    tier: str = Field(..., pattern="^(free|starter|starter_plus|pro|pro_plus)$")
    period: str = Field(..., pattern="^(monthly|yearly)$")


class SubscriptionInfo(BaseModel):
    """Schema for subscription information response."""

    tier: str
    status: str
    period: str
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    daily_limit: int
    daily_usage: int
    remaining_usage: int


# ============================================================================
# Usage Schemas
# ============================================================================


class UsageStats(BaseModel):
    """Schema for user usage statistics."""

    daily_usage: int
    daily_limit: int
    remaining_usage: int
    subscription_tier: str
    usage_reset_date: str


class UsageHistory(BaseModel):
    """Schema for usage history item."""

    id: int
    models_used: List[str]
    input_length: int
    models_successful: int
    models_failed: int
    processing_time_ms: int
    estimated_cost: float
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# User Preferences Schemas
# ============================================================================


class UserPreferencesUpdate(BaseModel):
    """Schema for updating user preferences."""

    preferred_models: Optional[List[str]] = None
    theme: Optional[str] = Field(None, pattern="^(light|dark)$")
    email_notifications: Optional[bool] = None
    usage_alerts: Optional[bool] = None


class UserPreferencesResponse(BaseModel):
    """Schema for user preferences response."""

    preferred_models: Optional[List[str]]
    theme: str
    email_notifications: bool
    usage_alerts: bool

    class Config:
        from_attributes = True


# ============================================================================
# Conversation Schemas
# ============================================================================


class ConversationListItem(BaseModel):
    """Schema for conversation list item."""

    id: int
    title: Optional[str]
    input_data: str
    models_used: List[str]
    created_at: datetime
    message_count: int

    class Config:
        from_attributes = True


class ConversationMessage(BaseModel):
    """Schema for a single conversation message."""

    id: int
    model_id: Optional[str]
    role: str
    content: str
    success: bool
    processing_time_ms: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationSummary(BaseModel):
    """Schema for conversation list summary."""

    id: int
    input_data: str
    models_used: List[str]
    created_at: datetime
    message_count: int

    class Config:
        from_attributes = True


class ConversationDetail(BaseModel):
    """Schema for detailed conversation with messages."""

    id: int
    title: Optional[str]
    input_data: str
    models_used: List[str]
    created_at: datetime
    messages: List[ConversationMessage]

    class Config:
        from_attributes = True


# ============================================================================
# Admin Management Schemas
# ============================================================================


class AdminUserResponse(BaseModel):
    """Schema for admin user data response."""

    id: int
    email: str
    is_verified: bool
    is_active: bool
    role: str
    is_admin: bool
    subscription_tier: str
    subscription_status: str
    subscription_period: str
    daily_usage_count: int
    monthly_overage_count: int
    daily_extended_usage: int = 0  # Extended tier usage tracking
    mock_mode_enabled: Optional[bool] = False  # Testing feature for admins
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AdminUserCreate(BaseModel):
    """Schema for creating a user via admin panel."""

    email: EmailStr
    password: str = Field(..., min_length=12)
    role: str = Field(default="user", pattern="^(user|moderator|admin|super_admin)$")
    subscription_tier: str = Field(default="free", pattern="^(free|starter|starter_plus|pro|pro_plus)$")
    subscription_period: str = Field(default="monthly", pattern="^(monthly|yearly)$")
    is_active: bool = Field(default=True)
    is_verified: bool = Field(default=False)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 12:
            raise ValueError("Password must be at least 12 characters long")
        if not any(char.isdigit() for char in v):
            raise ValueError("Password must contain at least one digit")
        if not any(char.isupper() for char in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(char.islower() for char in v):
            raise ValueError("Password must contain at least one lowercase letter")
        special_chars = "!@#$%^&*()_+-=[]{};':\"\\|,.<>/?"
        if not any(char in special_chars for char in v):
            raise ValueError("Password must contain at least one special character (!@#$%^&*()_+-=[]{};':\"\\|,.<>/?)")
        return v


class AdminUserUpdate(BaseModel):
    """Schema for updating a user via admin panel."""

    email: Optional[EmailStr] = None
    role: Optional[str] = Field(None, pattern="^(user|moderator|admin|super_admin)$")
    subscription_tier: Optional[str] = Field(None, pattern="^(free|starter|starter_plus|pro|pro_plus)$")
    subscription_status: Optional[str] = Field(None, pattern="^(active|cancelled|expired)$")
    subscription_period: Optional[str] = Field(None, pattern="^(monthly|yearly)$")
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None
    daily_usage_count: Optional[int] = Field(None, ge=0)
    monthly_overage_count: Optional[int] = Field(None, ge=0)


class AdminUserListResponse(BaseModel):
    """Schema for paginated user list response."""

    users: List[AdminUserResponse]
    total: int
    page: int
    per_page: int
    total_pages: int


class AdminActionLogResponse(BaseModel):
    """Schema for admin action log response."""

    id: int
    admin_user_id: int
    admin_user_email: Optional[str] = None
    target_user_id: Optional[int] = None
    target_user_email: Optional[str] = None
    action_type: str
    action_description: str
    details: Optional[str]
    ip_address: Optional[str]
    user_agent: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class AdminStatsResponse(BaseModel):
    """Schema for admin dashboard stats."""

    total_users: int
    active_users: int
    verified_users: int
    users_by_tier: Dict[str, int]
    users_by_role: Dict[str, int]
    recent_registrations: int  # Last 7 days
    total_usage_today: int
    admin_actions_today: int
