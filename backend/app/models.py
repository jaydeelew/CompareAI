"""
SQLAlchemy models for CompareAI authentication and user management.

This module defines all database models including users, preferences,
conversations, and usage tracking.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, Text, ForeignKey, DECIMAL
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class User(Base):
    """User account model with subscription and authentication details."""

    __tablename__ = "users"

    # Primary key
    id = Column(Integer, primary_key=True, index=True)

    # Authentication
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)

    # Email verification
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    verification_token = Column(String(255), index=True)
    verification_token_expires = Column(DateTime)

    # Password reset
    reset_token = Column(String(255), index=True)
    reset_token_expires = Column(DateTime)

    # Subscription details
    subscription_tier = Column(String(50), default="free")  # 'free', 'starter', 'starter_plus', 'pro', 'pro_plus'
    subscription_status = Column(String(50), default="active")  # 'active', 'cancelled', 'expired'
    subscription_period = Column(String(20), default="monthly")  # 'monthly', 'yearly'
    subscription_start_date = Column(DateTime)
    subscription_end_date = Column(DateTime)

    # Admin roles and permissions
    role = Column(String(50), default="user")  # 'user', 'moderator', 'admin', 'super_admin'
    is_admin = Column(Boolean, default=False)
    admin_permissions = Column(Text)  # JSON string of specific permissions

    # Testing features (admin/super_admin only)
    mock_mode_enabled = Column(Boolean, default=False)  # Use mock responses instead of real API calls

    # Payment integration
    stripe_customer_id = Column(String(255), index=True)

    # Usage tracking (MODEL-BASED: counts individual model responses, not comparisons)
    daily_usage_count = Column(Integer, default=0)  # Number of model responses used today
    usage_reset_date = Column(Date, default=func.current_date())
    monthly_overage_count = Column(Integer, default=0)  # Track overage model responses for billing
    overage_reset_date = Column(Date, default=func.current_date())  # Reset monthly

    # Extended tier usage tracking
    daily_extended_usage = Column(Integer, default=0)  # Number of Extended tier responses used today
    extended_usage_reset_date = Column(Date, default=func.current_date())

    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    preferences = relationship("UserPreference", back_populates="user", cascade="all, delete-orphan", uselist=False)
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")
    usage_logs = relationship("UsageLog", back_populates="user")
    subscription_history = relationship("SubscriptionHistory", back_populates="user", cascade="all, delete-orphan")
    payment_transactions = relationship("PaymentTransaction", back_populates="user", cascade="all, delete-orphan")


class UserPreference(Base):
    """User preferences and settings."""

    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)

    # Preferences stored as JSON strings
    preferred_models = Column(Text)  # JSON array of model IDs
    theme = Column(String(50), default="light")  # 'light', 'dark'

    # Notification settings
    email_notifications = Column(Boolean, default=True)
    usage_alerts = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="preferences")


class Conversation(Base):
    """Conversation/comparison history for users."""

    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Conversation details
    title = Column(String(255))  # Optional user-defined title
    input_data = Column(Text, nullable=False)  # The prompt/input
    models_used = Column(Text, nullable=False)  # JSON array of model IDs

    # Timestamps
    created_at = Column(DateTime, default=func.now(), index=True)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="conversations")
    messages = relationship("ConversationMessage", back_populates="conversation", cascade="all, delete-orphan")


class ConversationMessage(Base):
    """Individual messages within a conversation (for follow-ups)."""

    __tablename__ = "conversation_messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)

    # Message details
    model_id = Column(String(255))  # Which model generated this response (null for user messages)
    role = Column(String(20), nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)

    # Metadata
    success = Column(Boolean, default=True)
    processing_time_ms = Column(Integer)

    # Timestamp
    created_at = Column(DateTime, default=func.now())

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")


class UsageLog(Base):
    """Detailed usage tracking for analytics and cost analysis."""

    __tablename__ = "usage_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)  # NULL for anonymous users

    # Request details
    ip_address = Column(String(45))  # IPv4 or IPv6
    browser_fingerprint = Column(String(64))  # SHA-256 hash of browser fingerprint

    # Comparison details (MODEL-BASED: each model counts as one response)
    models_used = Column(Text)  # JSON array of model IDs
    input_length = Column(Integer)
    models_requested = Column(Integer)  # Number of model responses in this comparison
    models_successful = Column(Integer)
    models_failed = Column(Integer)
    processing_time_ms = Column(Integer)

    # Cost tracking (MODEL-BASED)
    estimated_cost = Column(DECIMAL(10, 4))  # Estimated cost in USD
    is_overage = Column(Boolean, default=False)  # Whether this included overage model responses
    overage_charge = Column(DECIMAL(10, 4), default=0)  # Charge for overage model responses (if applicable)

    # Timestamp
    created_at = Column(DateTime, default=func.now(), index=True)

    # Relationships
    user = relationship("User", back_populates="usage_logs")


class SubscriptionHistory(Base):
    """Track subscription changes (upgrades, downgrades, renewals)."""

    __tablename__ = "subscription_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Subscription change details
    previous_tier = Column(String(50))  # Previous tier (null for initial subscription)
    new_tier = Column(String(50), nullable=False)
    period = Column(String(20))  # 'monthly' or 'yearly'

    # Payment details
    amount_paid = Column(DECIMAL(10, 2))
    stripe_payment_id = Column(String(255))

    # Reason for change
    reason = Column(String(100))  # 'upgrade', 'downgrade', 'renewal', 'cancellation', 'initial'

    # Timestamp
    created_at = Column(DateTime, default=func.now(), index=True)

    # Relationships
    user = relationship("User", back_populates="subscription_history")


class PaymentTransaction(Base):
    """Track all payment transactions for audit and support."""

    __tablename__ = "payment_transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Stripe details
    stripe_payment_intent_id = Column(String(255), index=True)

    # Transaction details
    amount = Column(DECIMAL(10, 2), nullable=False)
    currency = Column(String(3), default="USD")
    status = Column(String(50))  # 'pending', 'succeeded', 'failed', 'refunded'
    description = Column(Text)

    # Timestamp
    created_at = Column(DateTime, default=func.now())

    # Relationships
    user = relationship("User", back_populates="payment_transactions")


class AdminActionLog(Base):
    """Audit log for all admin actions."""

    __tablename__ = "admin_action_logs"

    id = Column(Integer, primary_key=True, index=True)
    admin_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    target_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    # Action details
    action_type = Column(String(100), nullable=False)  # 'user_create', 'user_update', 'user_delete', etc.
    action_description = Column(Text, nullable=False)
    details = Column(Text)  # JSON string with action-specific data
    ip_address = Column(String(45))  # IPv4 or IPv6
    user_agent = Column(Text)

    # Timestamp
    created_at = Column(DateTime, default=func.now(), index=True)

    # Relationships
    admin_user = relationship("User", foreign_keys=[admin_user_id], backref="admin_actions_performed")
    target_user = relationship("User", foreign_keys=[target_user_id], backref="admin_actions_received")


class AppSettings(Base):
    """Global application settings managed by admins."""

    __tablename__ = "app_settings"

    # Single row table - only one settings row should exist
    id = Column(Integer, primary_key=True, default=1)

    # Mock mode settings
    anonymous_mock_mode_enabled = Column(Boolean, default=False)  # Enable mock mode for all anonymous users

    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
