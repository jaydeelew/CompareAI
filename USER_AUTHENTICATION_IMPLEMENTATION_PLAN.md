# User Authentication & Subscription System Implementation Plan

## Overview
This document outlines the complete implementation plan for adding user registration, authentication, and subscription tiers to CompareAI. This transforms the platform from an IP-based rate-limited service to a full freemium model with user accounts.

---

## Table of Contents
1. [Subscription Tiers & Pricing](#subscription-tiers--pricing)
2. [Technology Stack](#technology-stack)
3. [Database Schema](#database-schema)
4. [Backend Implementation](#backend-implementation)
5. [Frontend Implementation](#frontend-implementation)
6. [Email Service Integration](#email-service-integration)
7. [Payment Integration](#payment-integration)
8. [Migration Strategy](#migration-strategy)
9. [Security Considerations](#security-considerations)
10. [Implementation Timeline](#implementation-timeline)

---

## Subscription Tiers & Pricing

### Final Pricing Structure

```python
SUBSCRIPTION_TIERS = {
    "free": {
        "daily_limit": 10,
        "monthly_price": 0,
        "yearly_price": 0,
        "monthly_cost": 24.00,  # Break-even cost at max usage
        "features": [
            "All models access",
            "Standard support"
        ]
    },
    "starter": {
        "daily_limit": 25,
        "monthly_price": 14.99,
        "yearly_price": 149.99,  # ~17% discount (2 months free)
        "monthly_cost": 75.00,  # Max cost at 25/day × 6 models
        "features": [
            "All models access",
            "Email support",
            "Usage analytics",
            "Export conversations",
            "Conversation history (1 month)"
        ]
    },
    "pro": {
        "daily_limit": 50,
        "monthly_price": 29.99,
        "yearly_price": 299.99,  # ~17% discount (2 months free)
        "monthly_cost": 120.00,  # Max cost at 50/day
        "features": [
            "All Starter features", 
            "Priority processing", 
            "Advanced usage analytics",
            "Custom model preferences",
            "Conversation history (3 months)"
        ]
    },
}

# Overage Pricing (NEW)
- **Starter**: $0.20 per comparison beyond daily limit
- **Pro**: $0.25 per comparison beyond daily limit
- **Free**: No overages allowed (must upgrade)
```

### Cost Analysis
- **Average comparison cost**: ~$0.0166 per model (based on OpenRouter 2025 pricing)
- **Free tier**: Acceptable as customer acquisition cost (~$15/month max at 3 models)
- **Starter tier**: Profitable at realistic usage (40% = +$2.99/month)
- **Pro tier**: Profitable at light usage (30% = +$7.49/month)
- **Overage pricing**: 68-100% profit margin on all overages

---

## Technology Stack

### Backend Technologies
- **FastAPI**: Existing framework (continue using)
- **PostgreSQL**: Primary database (upgrade from SQLite)
- **SQLAlchemy**: ORM for database operations
- **Alembic**: Database migrations
- **python-jose**: JWT token generation and validation
- **passlib[bcrypt]**: Password hashing
- **fastapi-mail**: Email service integration
- **stripe**: Payment processing (future)
- **redis** (optional): Session management and caching

### Frontend Technologies
- **React 18**: Existing framework (continue using)
- **TypeScript**: Existing (continue using)
- **React Context API**: Authentication state management
- **React Router**: Protected routes (to be added)
- **Axios** or **Fetch API**: HTTP requests (currently using Fetch)
- **react-query** (optional): API state management

### Infrastructure
- **Docker**: Container orchestration (existing)
- **Nginx**: Reverse proxy (existing)
- **Let's Encrypt**: SSL certificates (existing)
- **AWS EC2**: Hosting (existing)

### Email Services (Choose One)
- **SendGrid** (recommended): Reliable, generous free tier
- **AWS SES**: Cost-effective for high volume
- **Resend**: Modern, developer-friendly
- **Mailgun**: Good documentation

---

## Database Schema

### PostgreSQL Database Design

```sql
-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    verification_token VARCHAR(255),
    verification_token_expires TIMESTAMP,
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP,
    subscription_tier VARCHAR(50) DEFAULT 'free',
    subscription_status VARCHAR(50) DEFAULT 'active',
    subscription_period VARCHAR(20) DEFAULT 'monthly',
    subscription_start_date TIMESTAMP,
    subscription_end_date TIMESTAMP,
    stripe_customer_id VARCHAR(255),
    daily_usage_count INTEGER DEFAULT 0,
    usage_reset_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_verification_token ON users(verification_token);
CREATE INDEX idx_users_reset_token ON users(reset_token);
CREATE INDEX idx_users_stripe_customer ON users(stripe_customer_id);

-- User preferences table
CREATE TABLE user_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    preferred_models TEXT,  -- JSON array of model IDs
    theme VARCHAR(50) DEFAULT 'light',
    email_notifications BOOLEAN DEFAULT TRUE,
    usage_alerts BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Conversation history table
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title VARCHAR(255),
    input_data TEXT NOT NULL,
    models_used TEXT NOT NULL,  -- JSON array of model IDs
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Conversation messages table
CREATE TABLE conversation_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL,
    model_id VARCHAR(255),
    role VARCHAR(20) NOT NULL,  -- 'user' or 'assistant'
    content TEXT NOT NULL,
    success BOOLEAN DEFAULT TRUE,
    processing_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Indexes for conversation queries
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX idx_conversation_messages_conversation_id ON conversation_messages(conversation_id);

-- Usage logs table (for analytics and cost tracking)
CREATE TABLE usage_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    ip_address VARCHAR(45),
    browser_fingerprint VARCHAR(500),
    models_used TEXT,  -- JSON array
    input_length INTEGER,
    models_requested INTEGER,
    models_successful INTEGER,
    models_failed INTEGER,
    processing_time_ms INTEGER,
    estimated_cost DECIMAL(10,4),  -- Track per-comparison costs
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for analytics
CREATE INDEX idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX idx_usage_logs_created_at ON usage_logs(created_at DESC);

-- Subscription history table (for tracking upgrades/downgrades)
CREATE TABLE subscription_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    previous_tier VARCHAR(50),
    new_tier VARCHAR(50) NOT NULL,
    period VARCHAR(20),  -- 'monthly' or 'yearly'
    amount_paid DECIMAL(10,2),
    stripe_payment_id VARCHAR(255),
    reason VARCHAR(100),  -- 'upgrade', 'downgrade', 'renewal', 'cancellation'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for subscription tracking
CREATE INDEX idx_subscription_history_user_id ON subscription_history(user_id);
CREATE INDEX idx_subscription_history_created_at ON subscription_history(created_at DESC);

-- Payment transactions table
CREATE TABLE payment_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    stripe_payment_intent_id VARCHAR(255),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(50),  -- 'pending', 'succeeded', 'failed', 'refunded'
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for payment tracking
CREATE INDEX idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX idx_payment_transactions_stripe_id ON payment_transactions(stripe_payment_intent_id);
```

---

## Backend Implementation

### Phase 1: Database Setup & Models

#### 1.1 Install Dependencies
```bash
# Add to backend/requirements.txt
sqlalchemy>=2.0.0
alembic>=1.12.0
psycopg2-binary>=2.9.9
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
python-multipart>=0.0.6
fastapi-mail>=1.4.0
pydantic[email]>=2.0.0
stripe>=7.0.0
```

#### 1.2 Database Configuration
```python
# backend/app/database.py
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Database URL from environment variable
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://compareai:password@localhost:5432/compareai"
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """Dependency for getting database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

#### 1.3 SQLAlchemy Models
```python
# backend/app/models.py
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, Text, ForeignKey, DECIMAL
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    verification_token = Column(String(255), index=True)
    verification_token_expires = Column(DateTime)
    reset_token = Column(String(255), index=True)
    reset_token_expires = Column(DateTime)
    subscription_tier = Column(String(50), default='free')
    subscription_status = Column(String(50), default='active')
    subscription_period = Column(String(20), default='monthly')
    subscription_start_date = Column(DateTime)
    subscription_end_date = Column(DateTime)
    stripe_customer_id = Column(String(255), index=True)
    daily_usage_count = Column(Integer, default=0)
    usage_reset_date = Column(Date, default=func.current_date())
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    preferences = relationship("UserPreference", back_populates="user", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")
    usage_logs = relationship("UsageLog", back_populates="user")

class UserPreference(Base):
    __tablename__ = "user_preferences"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    preferred_models = Column(Text)  # JSON string
    theme = Column(String(50), default='light')
    email_notifications = Column(Boolean, default=True)
    usage_alerts = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    user = relationship("User", back_populates="preferences")

class Conversation(Base):
    __tablename__ = "conversations"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255))
    input_data = Column(Text, nullable=False)
    models_used = Column(Text, nullable=False)  # JSON string
    created_at = Column(DateTime, default=func.now(), index=True)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    user = relationship("User", back_populates="conversations")
    messages = relationship("ConversationMessage", back_populates="conversation", cascade="all, delete-orphan")

class ConversationMessage(Base):
    __tablename__ = "conversation_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    model_id = Column(String(255))
    role = Column(String(20), nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    success = Column(Boolean, default=True)
    processing_time_ms = Column(Integer)
    created_at = Column(DateTime, default=func.now())
    
    conversation = relationship("Conversation", back_populates="messages")

class UsageLog(Base):
    __tablename__ = "usage_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), index=True)
    ip_address = Column(String(45))
    browser_fingerprint = Column(String(500))
    models_used = Column(Text)  # JSON string
    input_length = Column(Integer)
    models_requested = Column(Integer)
    models_successful = Column(Integer)
    models_failed = Column(Integer)
    processing_time_ms = Column(Integer)
    estimated_cost = Column(DECIMAL(10, 4))
    created_at = Column(DateTime, default=func.now(), index=True)
    
    user = relationship("User", back_populates="usage_logs")

class SubscriptionHistory(Base):
    __tablename__ = "subscription_history"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    previous_tier = Column(String(50))
    new_tier = Column(String(50), nullable=False)
    period = Column(String(20))
    amount_paid = Column(DECIMAL(10, 2))
    stripe_payment_id = Column(String(255))
    reason = Column(String(100))
    created_at = Column(DateTime, default=func.now(), index=True)

class PaymentTransaction(Base):
    __tablename__ = "payment_transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    stripe_payment_intent_id = Column(String(255), index=True)
    amount = Column(DECIMAL(10, 2), nullable=False)
    currency = Column(String(3), default='USD')
    status = Column(String(50))
    description = Column(Text)
    created_at = Column(DateTime, default=func.now())
```

### Phase 2: Authentication Logic

#### 2.1 Password Hashing & JWT Utilities
```python
# backend/app/auth.py
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional
import os
import secrets

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
SECRET_KEY = os.getenv("SECRET_KEY", secrets.token_urlsafe(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict) -> str:
    """Create JWT refresh token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> Optional[dict]:
    """Verify and decode JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

def generate_verification_token() -> str:
    """Generate a random verification token"""
    return secrets.token_urlsafe(32)
```

#### 2.2 Authentication Dependencies
```python
# backend/app/dependencies.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.auth import verify_token

security = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Get current authenticated user from JWT token"""
    token = credentials.credentials
    payload = verify_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    user_id: int = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    return user

def get_current_verified_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Require user to have verified email"""
    if not current_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email verification required"
        )
    return current_user

def check_subscription_tier(required_tier: str):
    """Decorator to check if user has required subscription tier"""
    tier_hierarchy = {"free": 0, "starter": 1, "pro": 2}
    
    def dependency(current_user: User = Depends(get_current_verified_user)) -> User:
        user_tier_level = tier_hierarchy.get(current_user.subscription_tier, 0)
        required_tier_level = tier_hierarchy.get(required_tier, 0)
        
        if user_tier_level < required_tier_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This feature requires {required_tier} subscription or higher"
            )
        return current_user
    
    return dependency
```

### Phase 3: Authentication Endpoints

#### 3.1 Pydantic Schemas
```python
# backend/app/schemas.py
from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List
from datetime import datetime

# User schemas
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    
    @validator('password')
    def password_strength(cls, v):
        if not any(char.isdigit() for char in v):
            raise ValueError('Password must contain at least one digit')
        if not any(char.isupper() for char in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(char.islower() for char in v):
            raise ValueError('Password must contain at least one lowercase letter')
        return v

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    is_verified: bool
    subscription_tier: str
    subscription_status: str
    daily_usage_count: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class EmailVerification(BaseModel):
    token: str

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordReset(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)

class SubscriptionUpdate(BaseModel):
    tier: str
    period: str = Field(..., pattern="^(monthly|yearly)$")

# Usage schemas
class UsageStats(BaseModel):
    daily_usage: int
    daily_limit: int
    subscription_tier: str
    usage_reset_date: str
```

#### 3.2 Authentication Router
```python
# backend/app/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.database import get_db
from app.models import User, UserPreference
from app.schemas import (
    UserRegister, UserLogin, UserResponse, TokenResponse,
    EmailVerification, PasswordResetRequest, PasswordReset
)
from app.auth import (
    verify_password, get_password_hash, create_access_token,
    create_refresh_token, generate_verification_token
)
from app.dependencies import get_current_user, get_current_verified_user
from app.email_service import send_verification_email, send_password_reset_email

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserRegister,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Register a new user"""
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    verification_token = generate_verification_token()
    new_user = User(
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        verification_token=verification_token,
        verification_token_expires=datetime.utcnow() + timedelta(hours=24)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Create default user preferences
    preferences = UserPreference(user_id=new_user.id)
    db.add(preferences)
    db.commit()
    
    # Send verification email
    background_tasks.add_task(
        send_verification_email,
        email=new_user.email,
        token=verification_token
    )
    
    return new_user

@router.post("/login", response_model=TokenResponse)
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """Login user and return JWT tokens"""
    user = db.query(User).filter(User.email == user_data.email).first()
    
    if not user or not verify_password(user_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive"
        )
    
    # Create tokens
    access_token = create_access_token(data={"sub": user.id})
    refresh_token = create_refresh_token(data={"sub": user.id})
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

@router.post("/verify-email")
async def verify_email(
    verification: EmailVerification,
    db: Session = Depends(get_db)
):
    """Verify user email with token"""
    user = db.query(User).filter(
        User.verification_token == verification.token,
        User.verification_token_expires > datetime.utcnow()
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token"
        )
    
    user.is_verified = True
    user.verification_token = None
    user.verification_token_expires = None
    db.commit()
    
    return {"message": "Email verified successfully"}

@router.post("/resend-verification")
async def resend_verification(
    email: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Resend verification email"""
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        # Don't reveal if email exists
        return {"message": "If the email exists, a verification link has been sent"}
    
    if user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already verified"
        )
    
    # Generate new token
    verification_token = generate_verification_token()
    user.verification_token = verification_token
    user.verification_token_expires = datetime.utcnow() + timedelta(hours=24)
    db.commit()
    
    # Send email
    background_tasks.add_task(
        send_verification_email,
        email=user.email,
        token=verification_token
    )
    
    return {"message": "Verification email sent"}

@router.post("/forgot-password")
async def forgot_password(
    request: PasswordResetRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Request password reset"""
    user = db.query(User).filter(User.email == request.email).first()
    
    if not user:
        # Don't reveal if email exists
        return {"message": "If the email exists, a reset link has been sent"}
    
    # Generate reset token
    reset_token = generate_verification_token()
    user.reset_token = reset_token
    user.reset_token_expires = datetime.utcnow() + timedelta(hours=1)
    db.commit()
    
    # Send email
    background_tasks.add_task(
        send_password_reset_email,
        email=user.email,
        token=reset_token
    )
    
    return {"message": "Password reset email sent"}

@router.post("/reset-password")
async def reset_password(
    reset: PasswordReset,
    db: Session = Depends(get_db)
):
    """Reset password with token"""
    user = db.query(User).filter(
        User.reset_token == reset.token,
        User.reset_token_expires > datetime.utcnow()
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    user.password_hash = get_password_hash(reset.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    db.commit()
    
    return {"message": "Password reset successfully"}

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Get current user information"""
    return current_user

@router.delete("/delete-account")
async def delete_account(
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db)
):
    """Delete user account"""
    db.delete(current_user)
    db.commit()
    return {"message": "Account deleted successfully"}
```

### Phase 4: Rate Limiting with User Authentication

#### 4.1 Hybrid Rate Limiting
```python
# backend/app/rate_limiting.py
from datetime import datetime, date
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from app.models import User

# Subscription tier limits
SUBSCRIPTION_LIMITS = {
    "free": 10,
    "starter": 25,
    "pro": 50,
}

def check_user_rate_limit(user: User, db: Session) -> Tuple[bool, int, int]:
    """
    Check rate limit for authenticated user.
    Returns: (is_allowed, current_count, daily_limit)
    """
    # Reset counter if it's a new day
    today = date.today()
    if user.usage_reset_date != today:
        user.daily_usage_count = 0
        user.usage_reset_date = today
        db.commit()
    
    daily_limit = SUBSCRIPTION_LIMITS.get(user.subscription_tier, 10)
    is_allowed = user.daily_usage_count < daily_limit
    
    return is_allowed, user.daily_usage_count, daily_limit

def increment_user_usage(user: User, db: Session):
    """Increment user's daily usage count"""
    user.daily_usage_count += 1
    user.updated_at = datetime.utcnow()
    db.commit()

def check_anonymous_rate_limit(identifier: str, rate_limit_storage: dict) -> Tuple[bool, int]:
    """
    Check rate limit for anonymous user (existing IP/fingerprint logic).
    Returns: (is_allowed, current_count)
    """
    today = datetime.now().date().isoformat()
    user_data = rate_limit_storage[identifier]
    
    # Reset count if it's a new day
    if user_data["date"] != today:
        user_data["count"] = 0
        user_data["date"] = today
        user_data["first_seen"] = datetime.now()
    
    current_count = user_data["count"]
    is_allowed = current_count < 10  # Anonymous users get 10/day
    
    return is_allowed, current_count

def increment_anonymous_usage(identifier: str, rate_limit_storage: dict):
    """Increment usage count for anonymous user"""
    today = datetime.now().date().isoformat()
    user_data = rate_limit_storage[identifier]
    
    if user_data["date"] != today:
        user_data["count"] = 1
        user_data["date"] = today
        user_data["first_seen"] = datetime.now()
    else:
        user_data["count"] += 1
```

#### 4.2 Updated Compare Endpoint
```python
# Update backend/app/main.py /compare endpoint
from app.dependencies import get_current_user
from app.rate_limiting import (
    check_user_rate_limit, increment_user_usage,
    check_anonymous_rate_limit, increment_anonymous_usage
)

@app.post("/compare")
async def compare(
    req: CompareRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)  # Optional auth
) -> CompareResponse:
    """Compare models - supports both authenticated and anonymous users"""
    
    if not req.input_data.strip():
        raise HTTPException(status_code=400, detail="Input data cannot be empty")

    if not req.models:
        raise HTTPException(status_code=400, detail="At least one model must be selected")

    # Enforce model limit
    if len(req.models) > MAX_MODELS_PER_REQUEST:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_MODELS_PER_REQUEST} models allowed per request."
        )
    
    # --- HYBRID RATE LIMITING ---
    if current_user:
        # Authenticated user - check subscription tier limits
        is_allowed, usage_count, daily_limit = check_user_rate_limit(current_user, db)
        if not is_allowed:
            raise HTTPException(
                status_code=429,
                detail=f"Daily limit of {daily_limit} comparisons exceeded. Upgrade your subscription for more."
            )
        # Increment usage
        increment_user_usage(current_user, db)
    else:
        # Anonymous user - check IP/fingerprint limits
        client_ip = get_client_ip(request)
        ip_allowed, ip_count = check_anonymous_rate_limit(f"ip:{client_ip}", rate_limit_storage)
        
        fingerprint_allowed = True
        if req.browser_fingerprint:
            fingerprint_allowed, _ = check_anonymous_rate_limit(
                f"fp:{req.browser_fingerprint}",
                rate_limit_storage
            )
        
        if not ip_allowed or not fingerprint_allowed:
            raise HTTPException(
                status_code=429,
                detail="Daily limit of 10 comparisons exceeded. Register for a free account to continue."
            )
        
        # Increment anonymous usage
        increment_anonymous_usage(f"ip:{client_ip}", rate_limit_storage)
        if req.browser_fingerprint:
            increment_anonymous_usage(f"fp:{req.browser_fingerprint}", rate_limit_storage)
    
    # --- END RATE LIMITING ---
    
    # Rest of comparison logic remains the same...
    try:
        loop = asyncio.get_running_loop()
        results = await loop.run_in_executor(None, run_models, req.input_data, req.models, req.conversation_history)
        
        # ... existing comparison logic ...
        
        # Log usage (for both authenticated and anonymous users)
        usage_log = UsageLog(
            user_id=current_user.id if current_user else None,
            ip_address=get_client_ip(request),
            browser_fingerprint=req.browser_fingerprint,
            models_used=json.dumps(req.models),
            input_length=len(req.input_data),
            models_requested=len(req.models),
            models_successful=successful_models,
            models_failed=failed_models,
            processing_time_ms=int(processing_time),
            estimated_cost=len(req.models) * 0.08  # Estimate cost
        )
        db.add(usage_log)
        db.commit()
        
        return CompareResponse(results=results, metadata=metadata)
        
    except Exception as e:
        error_msg = f"Error processing request: {str(e)}"
        print(f"Backend error: {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg)
```

---

## Frontend Implementation

### Phase 1: Authentication Context & State Management

#### 1.1 Authentication Context
```typescript
// frontend/src/contexts/AuthContext.tsx
import React, { createContext, useState, useContext, useEffect } from 'react';

interface User {
  id: number;
  email: string;
  is_verified: boolean;
  subscription_tier: string;
  subscription_status: string;
  daily_usage_count: number;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  // Load user from token on mount
  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const response = await fetch(`${API_URL}/auth/me`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
          } else {
            // Token invalid, clear it
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
          }
        } catch (error) {
          console.error('Failed to load user:', error);
        }
      }
      setIsLoading(false);
    };

    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }

    const data = await response.json();
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);

    // Fetch user data
    await refreshUser();
  };

  const register = async (email: string, password: string) => {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Registration failed');
    }

    // Don't auto-login, require email verification
    return;
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  };

  const refreshUser = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      register,
      logout,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```

### Phase 2: Authentication UI Components

#### 2.1 Login Component
```typescript
// frontend/src/components/LoginForm.tsx
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const LoginForm = ({ onSuccess, onSwitchToRegister }: { 
  onSuccess?: () => void;
  onSwitchToRegister?: () => void;
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-form">
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        {error && <div className="error-message">{error}</div>}
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Logging in...' : 'Login'}
        </button>
      </form>
      <div className="auth-footer">
        <p>Don't have an account? <button onClick={onSwitchToRegister}>Register</button></p>
        <p><a href="/forgot-password">Forgot password?</a></p>
      </div>
    </div>
  );
};
```

#### 2.2 Register Component
```typescript
// frontend/src/components/RegisterForm.tsx
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const RegisterForm = ({ onSuccess, onSwitchToLogin }: {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      await register(email, password);
      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-form">
        <h2>Check Your Email</h2>
        <p>We've sent a verification link to {email}. Please check your email to verify your account.</p>
        <button onClick={onSwitchToLogin}>Go to Login</button>
      </div>
    );
  }

  return (
    <div className="auth-form">
      <h2>Register</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            disabled={isLoading}
          />
          <small>Must be at least 8 characters with uppercase, lowercase, and numbers</small>
        </div>
        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        {error && <div className="error-message">{error}</div>}
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Registering...' : 'Register'}
        </button>
      </form>
      <div className="auth-footer">
        <p>Already have an account? <button onClick={onSwitchToLogin}>Login</button></p>
      </div>
    </div>
  );
};
```

#### 2.3 User Menu Component
```typescript
// frontend/src/components/UserMenu.tsx
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const UserMenu = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  if (!isAuthenticated || !user) {
    return (
      <div className="user-menu-guest">
        <button className="nav-button" onClick={() => {/* Open login modal */}}>
          Login
        </button>
        <button className="nav-button primary" onClick={() => {/* Open register modal */}}>
          Register
        </button>
      </div>
    );
  }

  return (
    <div className="user-menu">
      <button 
        className="user-menu-button"
        onClick={() => setShowMenu(!showMenu)}
      >
        <span className="user-email">{user.email}</span>
        <span className="user-tier-badge">{user.subscription_tier}</span>
      </button>
      
      {showMenu && (
        <div className="user-menu-dropdown">
          <div className="menu-section">
            <p className="menu-item-label">Usage Today</p>
            <p className="menu-item-value">
              {user.daily_usage_count} / {
                user.subscription_tier === 'free' ? 10 :
                user.subscription_tier === 'pro' ? 50 : 100
              }
            </p>
          </div>
          <div className="menu-divider" />
          <a href="/dashboard" className="menu-item">Dashboard</a>
          <a href="/subscription" className="menu-item">Upgrade Plan</a>
          <a href="/settings" className="menu-item">Settings</a>
          <div className="menu-divider" />
          <button onClick={logout} className="menu-item danger">Logout</button>
        </div>
      )}
    </div>
  );
};
```

### Phase 3: Update Main App Component

#### 3.1 Integrate Authentication
```typescript
// Update frontend/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);
```

#### 3.2 Update App.tsx with Authentication
```typescript
// Update frontend/src/App.tsx - Add to top of file
import { useAuth } from './contexts/AuthContext';
import { UserMenu } from './components/UserMenu';

// Inside App component, replace navbar section
<nav className="navbar">
  <div className="nav-brand">
    {/* existing brand logo */}
  </div>
  
  <div className="nav-actions">
    <UserMenu />
  </div>
</nav>

// Update handleSubmit to include auth token
const handleSubmit = async () => {
  const { user } = useAuth();
  
  // ... existing validation ...
  
  try {
    const token = localStorage.getItem('access_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const res = await fetch(`${API_URL}/compare`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        input_data: input,
        models: selectedModels,
        conversation_history: conversationHistory,
        browser_fingerprint: browserFingerprint
      }),
      signal: controller.signal,
    });
    
    // ... rest of existing logic ...
  }
};
```

---

## Email Service Integration

### Email Service Configuration
```python
# backend/app/email_service.py
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from pydantic import EmailStr
import os

# Email configuration
conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
    MAIL_FROM=os.getenv("MAIL_FROM", "noreply@compareintel.com"),
    MAIL_PORT=int(os.getenv("MAIL_PORT", 587)),
    MAIL_SERVER=os.getenv("MAIL_SERVER", "smtp.sendgrid.net"),
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)

fm = FastMail(conf)

async def send_verification_email(email: EmailStr, token: str):
    """Send email verification link"""
    verification_url = f"{os.getenv('FRONTEND_URL')}/verify-email?token={token}"
    
    html = f"""
    <html>
      <body>
        <h2>Welcome to CompareIntel!</h2>
        <p>Thank you for registering. Please verify your email address by clicking the link below:</p>
        <p><a href="{verification_url}">Verify Email Address</a></p>
        <p>This link will expire in 24 hours.</p>
        <p>If you didn't create an account, you can safely ignore this email.</p>
      </body>
    </html>
    """
    
    message = MessageSchema(
        subject="Verify Your CompareIntel Account",
        recipients=[email],
        body=html,
        subtype="html"
    )
    
    await fm.send_message(message)

async def send_password_reset_email(email: EmailStr, token: str):
    """Send password reset link"""
    reset_url = f"{os.getenv('FRONTEND_URL')}/reset-password?token={token}"
    
    html = f"""
    <html>
      <body>
        <h2>Password Reset Request</h2>
        <p>You requested to reset your password. Click the link below to create a new password:</p>
        <p><a href="{reset_url}">Reset Password</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      </body>
    </html>
    """
    
    message = MessageSchema(
        subject="Reset Your CompareIntel Password",
        recipients=[email],
        body=html,
        subtype="html"
    )
    
    await fm.send_message(message)

async def send_subscription_confirmation_email(email: EmailStr, tier: str, period: str):
    """Send subscription confirmation"""
    html = f"""
    <html>
      <body>
        <h2>Subscription Confirmed!</h2>
        <p>Thank you for upgrading to CompareIntel {tier.upper()}!</p>
        <p>Your {period} subscription is now active.</p>
        <p>You now have access to all {tier} features.</p>
        <p><a href="{os.getenv('FRONTEND_URL')}/dashboard">Go to Dashboard</a></p>
      </body>
    </html>
    """
    
    message = MessageSchema(
        subject="Subscription Confirmed - CompareIntel",
        recipients=[email],
        body=html,
        subtype="html"
    )
    
    await fm.send_message(message)
```

### Environment Variables
```bash
# Add to backend/.env
MAIL_USERNAME=apikey
MAIL_PASSWORD=your_sendgrid_api_key
MAIL_FROM=noreply@compareintel.com
MAIL_SERVER=smtp.sendgrid.net
MAIL_PORT=587
FRONTEND_URL=https://compareintel.com
SECRET_KEY=your_secret_key_here
DATABASE_URL=postgresql://user:password@localhost:5432/compareai
```

---

## Payment Integration

### Stripe Integration (Future Phase)
```python
# backend/app/routers/payments.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import stripe
import os

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

router = APIRouter(prefix="/payments", tags=["Payments"])

@router.post("/create-checkout-session")
async def create_checkout_session(
    tier: str,
    period: str,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db)
):
    """Create Stripe checkout session for subscription"""
    
    prices = {
        "starter": {"monthly": "price_starter_monthly_id", "yearly": "price_starter_yearly_id"},
        "pro": {"monthly": "price_pro_monthly_id", "yearly": "price_pro_yearly_id"},
    }
    
    price_id = prices.get(tier, {}).get(period)
    if not price_id:
        raise HTTPException(status_code=400, detail="Invalid tier or period")
    
    try:
        checkout_session = stripe.checkout.Session.create(
            customer_email=current_user.email,
            payment_method_types=['card'],
            line_items=[{
                'price': price_id,
                'quantity': 1,
            }],
            mode='subscription',
            success_url=f"{os.getenv('FRONTEND_URL')}/subscription/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{os.getenv('FRONTEND_URL')}/subscription/cancel",
            client_reference_id=str(current_user.id)
        )
        
        return {"checkout_url": checkout_session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """Handle Stripe webhooks"""
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, os.getenv("STRIPE_WEBHOOK_SECRET")
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Handle different event types
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        user_id = int(session['client_reference_id'])
        # Update user subscription in database
        # ...
    
    return {"status": "success"}
```

---

## Migration Strategy

### Phase 1: Parallel Systems (Week 1-2)
1. Deploy authentication system alongside existing IP-based rate limiting
2. Both anonymous and authenticated users can use the platform
3. No breaking changes to existing functionality

### Phase 2: User Migration (Week 3-4)
1. Add prominent "Register" calls-to-action
2. Show benefits of registration (higher limits, history, analytics)
3. Email existing users (if you have a list)
4. Offer incentives (e.g., extra free comparisons for early registrants)

### Phase 3: Gradual Transition (Week 5-8)
1. Reduce anonymous user limits (10 → 5 comparisons/day)
2. Add "Register to continue" prompts
3. Monitor conversion rates
4. Eventually require registration for full access

### Database Migration Script
```python
# backend/migrations/migrate_to_postgresql.py
import sqlite3
import psycopg2
from datetime import datetime

def migrate_data():
    """Migrate existing data from SQLite to PostgreSQL"""
    # Connect to both databases
    sqlite_conn = sqlite3.connect('compareintel.db')
    pg_conn = psycopg2.connect(
        "postgresql://user:password@localhost:5432/compareai"
    )
    
    # If you have existing data to migrate, add migration logic here
    # For a fresh start, just create the schema
    
    sqlite_conn.close()
    pg_conn.close()

if __name__ == "__main__":
    migrate_data()
```

---

## Security Considerations

### Password Security
- **Bcrypt hashing**: Slow, resistant to brute force
- **Minimum 8 characters**: Enforced with uppercase, lowercase, numbers
- **Rate limiting on auth endpoints**: Prevent brute force attacks

### Token Security
- **Short-lived access tokens**: 30 minutes
- **HTTP-only cookies**: Consider using for tokens (more secure than localStorage)
- **Token refresh mechanism**: Refresh tokens last 7 days
- **Token blacklisting**: Implement for logout (requires Redis)

### Email Security
- **Time-limited tokens**: 24 hours for verification, 1 hour for password reset
- **Don't reveal user existence**: Generic messages for reset/verification
- **Rate limiting**: Prevent email spam

### Database Security
- **Parameterized queries**: SQLAlchemy prevents SQL injection
- **Connection encryption**: Use SSL for PostgreSQL connections
- **Regular backups**: Automated daily backups
- **Least privilege**: Database user has minimal necessary permissions

### API Security
- **CORS configuration**: Restrict to your domain only
- **Rate limiting**: Per-user and per-IP
- **Input validation**: Pydantic schemas validate all inputs
- **Error handling**: Don't expose internal errors to users

---

## Implementation Timeline

### Week 1-2: Backend Foundation
- [x] Set up PostgreSQL database
- [x] Create SQLAlchemy models
- [x] Implement authentication utilities (JWT, password hashing)
- [x] Create authentication endpoints (register, login, verify)
- [x] Set up email service
- [x] Test all endpoints

### Week 3-4: Frontend Integration
- [ ] Create authentication context
- [ ] Build login/register components
- [ ] Add user menu and dashboard
- [ ] Integrate with existing App component
- [ ] Update API calls to include auth headers
- [ ] Test authentication flow

### Week 5-6: Subscription Features
- [ ] Implement subscription tier logic
- [ ] Add usage tracking per user
- [ ] Create upgrade/downgrade UI
- [ ] Build analytics dashboard
- [ ] Add conversation history features
- [ ] Implement batch processing

### Week 7-8: Polish & Launch
- [ ] Comprehensive testing (unit, integration, e2e)
- [ ] Security audit
- [ ] Performance optimization
- [ ] Documentation updates
- [ ] Gradual rollout
- [ ] Monitor and iterate

---

## Testing Checklist

### Backend Tests
- [ ] User registration (valid/invalid inputs)
- [ ] Email verification flow
- [ ] Login with correct/incorrect credentials
- [ ] Password reset flow
- [ ] JWT token validation
- [ ] Rate limiting (authenticated/anonymous)
- [ ] Subscription tier enforcement
- [ ] Usage tracking accuracy

### Frontend Tests
- [ ] Login form validation
- [ ] Register form validation
- [ ] Token storage and retrieval
- [ ] Protected routes
- [ ] User menu display
- [ ] Usage counter updates
- [ ] Subscription upgrade flow

### Integration Tests
- [ ] Full registration → verification → login flow
- [ ] Anonymous → authenticated user conversion
- [ ] Subscription upgrade → feature access
- [ ] Rate limit enforcement
- [ ] Payment processing (when implemented)

---

## Monitoring & Analytics

### Key Metrics to Track
1. **User Acquisition**
   - New registrations per day
   - Email verification rate
   - Anonymous vs authenticated usage

2. **Engagement**
   - Daily active users
   - Average comparisons per user
   - Feature usage (analytics, history, etc.)

3. **Conversion**
   - Free → Pro conversion rate
   - Pro → Pro+ conversion rate
   - Monthly vs yearly subscription split

4. **Revenue**
   - Monthly recurring revenue (MRR)
   - Customer lifetime value (CLV)
   - Churn rate

5. **Technical**
   - API response times
   - Error rates
   - Database query performance

---

## Future Enhancements

### Phase 2 Features (Post-Launch)
1. **OAuth Integration**: Google, GitHub login
2. **Team Accounts**: Multi-user organizations
3. **API Access**: RESTful API for Pro+ users
4. **Advanced Analytics**: Custom reports, data export
5. **Model Comparison**: Side-by-side performance metrics
6. **Conversation Sharing**: Public/private conversation links
7. **Custom Branding**: White-label for enterprise
8. **Mobile App**: Native iOS/Android apps

### Technical Improvements
1. **Redis Caching**: Session management, rate limiting
2. **CDN Integration**: Faster asset delivery
3. **Horizontal Scaling**: Multiple backend instances
4. **Real-time Updates**: WebSocket support
5. **Advanced Search**: Full-text search for conversations
6. **Data Analytics**: Business intelligence dashboard

---

## Support & Documentation

### User Documentation
- [ ] Getting started guide
- [ ] FAQ section
- [ ] Video tutorials
- [ ] Subscription comparison chart
- [ ] API documentation (for Pro+)

### Developer Documentation
- [ ] Architecture overview
- [ ] API reference
- [ ] Database schema documentation
- [ ] Deployment guide
- [ ] Contributing guidelines

---

## Cost Projections

### Infrastructure Costs (Monthly)
- **AWS EC2 (t3.medium)**: $30
- **PostgreSQL (RDS)**: $25
- **SendGrid (Email)**: $15 (free tier → 100 emails/day)
- **Stripe fees**: 2.9% + $0.30 per transaction
- **OpenRouter API**: Variable based on usage

### Profitability Analysis
**Break-even Point:**
- Need ~100 Pro users OR 40 Pro+ users
- With 10% free → paid conversion: Need 1,000 active users
- With 5% Pro+ upgrade: Need additional conversions

**Target Metrics (Year 1):**
- 5,000 total users
- 500 Pro subscribers ($14,995/month)
- 100 Pro+ subscribers ($4,999/month)
- **Total MRR: $19,994**
- Infrastructure costs: ~$500/month
- **Net profit: ~$19,500/month**

---

## Conclusion

This implementation plan provides a complete roadmap for transforming CompareAI from an IP-based rate-limited service to a full-featured freemium platform with user authentication and subscriptions.

The architecture is designed to be:
- ✅ **Scalable**: PostgreSQL, JWT tokens, modular design
- ✅ **Secure**: Bcrypt, JWT, rate limiting, input validation
- ✅ **User-friendly**: Clear upgrade paths, smooth onboarding
- ✅ **Profitable**: Data-driven pricing based on actual costs
- ✅ **Maintainable**: Clean code, good documentation, testing

**Next Steps:**
1. Review and approve this plan
2. Set up development environment
3. Begin Week 1-2 implementation
4. Regular progress reviews

**Questions or modifications?**
This document is a living reference - update it as requirements change or as we learn from implementation.

