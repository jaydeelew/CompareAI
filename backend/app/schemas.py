"""
Pydantic schemas for request/response validation.

This module defines all data models for API requests and responses.
"""

from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List
from datetime import datetime


# ============================================================================
# User Schemas
# ============================================================================

class UserRegister(BaseModel):
    """Schema for user registration request."""
    email: EmailStr
    password: str = Field(..., min_length=8)
    
    @field_validator('password')
    @classmethod
    def password_strength(cls, v):
        """Validate password meets strength requirements."""
        if not any(char.isdigit() for char in v):
            raise ValueError('Password must contain at least one digit')
        if not any(char.isupper() for char in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(char.islower() for char in v):
            raise ValueError('Password must contain at least one lowercase letter')
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
    subscription_tier: str
    subscription_status: str
    subscription_period: str
    daily_usage_count: int
    monthly_overage_count: int
    created_at: datetime
    
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
    new_password: str = Field(..., min_length=8)
    
    @field_validator('new_password')
    @classmethod
    def password_strength(cls, v):
        """Validate password meets strength requirements."""
        if not any(char.isdigit() for char in v):
            raise ValueError('Password must contain at least one digit')
        if not any(char.isupper() for char in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(char.islower() for char in v):
            raise ValueError('Password must contain at least one lowercase letter')
        return v


# ============================================================================
# Subscription Schemas
# ============================================================================

class SubscriptionUpdate(BaseModel):
    """Schema for updating subscription."""
    tier: str = Field(..., pattern="^(free|starter|pro)$")
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

