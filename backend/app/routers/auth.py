"""
Authentication router for user registration, login, and verification.

This module handles all authentication-related endpoints including
user registration, login, email verification, and password resets.
"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from ..database import get_db
from ..models import User, UserPreference
from ..schemas import (
    UserRegister,
    UserLogin,
    UserResponse,
    TokenResponse,
    EmailVerification,
    ResendVerificationRequest,
    PasswordResetRequest,
    PasswordReset,
    RefreshTokenRequest,
)
from ..auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    generate_verification_token,
    verify_token,
)
from ..dependencies import get_current_user_required, get_current_verified_user, get_current_user
from ..email_service import send_verification_email, send_password_reset_email

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegister, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Register a new user account.

    - Creates user with hashed password
    - Generates email verification token
    - Sends verification email
    - Returns access token, refresh token, and user data
    """
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(User.email == user_data.email).first()
        if existing_user:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error checking existing user: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    try:
        # Create new user
        verification_token = generate_verification_token()
        new_user = User(
            email=user_data.email,
            password_hash=get_password_hash(user_data.password),
            verification_token=verification_token,
            verification_token_expires=datetime.utcnow() + timedelta(hours=24),
            subscription_tier="free",
            subscription_status="active",
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        # Create default user preferences
        preferences = UserPreference(user_id=new_user.id, theme="light", email_notifications=True, usage_alerts=True)
        db.add(preferences)
        db.commit()

        # Send verification email in background (optional - won't fail if email not configured)
        try:
            background_tasks.add_task(send_verification_email, email=new_user.email, token=verification_token)
        except Exception as e:
            print(f"Warning: Could not send verification email: {e}")
            # Continue anyway - email is optional for development

        # Generate tokens for immediate login
        access_token = create_access_token(data={"sub": str(new_user.id)})
        refresh_token = create_refresh_token(data={"sub": str(new_user.id)})

        # Convert user to dict for response
        user_dict = {
            "id": new_user.id,
            "email": new_user.email,
            "is_verified": new_user.is_verified,
            "is_active": new_user.is_active,
            "subscription_tier": new_user.subscription_tier,
            "subscription_status": new_user.subscription_status,
            "subscription_period": new_user.subscription_period,
            "daily_usage_count": new_user.daily_usage_count,
            "monthly_overage_count": new_user.monthly_overage_count,
            "created_at": new_user.created_at.isoformat() if new_user.created_at else None,
        }

        return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer", "user": user_dict}
    except HTTPException:
        raise
    except Exception as e:
        import traceback

        traceback.print_exc()
        print(f"Registration error: {e}")
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")


@router.post("/login", response_model=TokenResponse)
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """
    Login user and return JWT tokens.

    - Validates email and password
    - Returns access token (30 min) and refresh token (7 days)
    - Requires active account (but not verified email)
    """
    user = db.query(User).filter(User.email == user_data.email).first()

    if not user or not verify_password(user_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

    # Create tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(token_data: RefreshTokenRequest, db: Session = Depends(get_db)):
    """
    Refresh access token using refresh token.

    - Validates refresh token
    - Returns new access token and refresh token
    """
    payload = verify_token(token_data.refresh_token, token_type="refresh")

    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user_id: int = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    # Create new tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    new_refresh_token = create_refresh_token(data={"sub": str(user.id)})

    return {"access_token": access_token, "refresh_token": new_refresh_token, "token_type": "bearer"}


@router.post("/verify-email", status_code=status.HTTP_200_OK)
async def verify_email(verification: EmailVerification, db: Session = Depends(get_db)):
    """
    Verify user email with token.

    - Validates verification token
    - Marks email as verified
    - Clears verification token
    """
    print(f"Received verification request for token: {verification.token}")

    user = (
        db.query(User)
        .filter(User.verification_token == verification.token, User.verification_token_expires > datetime.utcnow())
        .first()
    )

    if not user:
        print(f"No user found with token: {verification.token}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification token")

    print(f"Verifying email for user: {user.email}")
    user.is_verified = True
    user.verification_token = None
    user.verification_token_expires = None
    db.commit()

    return {"message": "Email verified successfully"}


@router.post("/resend-verification", status_code=status.HTTP_200_OK)
async def resend_verification(request: ResendVerificationRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Resend verification email with rate limiting.

    - Rate limit: 1 request per minute per email
    - Generates new verification token
    - Sends new verification email
    - Returns success message (doesn't reveal if email exists)
    """
    user = db.query(User).filter(User.email == request.email).first()

    if not user:
        # Don't reveal if email exists - security best practice
        return {"message": "If the email exists and is not verified, a verification link has been sent"}

    if user.is_verified:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already verified")

    # Rate limiting: Check if user has requested too recently (within 60 seconds)
    if user.verification_token_expires:
        # Calculate time since last token generation
        # We use token expiry as a proxy for when the last resend was requested
        # Token expires in 24 hours, so if it's recent, check the creation time
        time_since_last_request = datetime.utcnow() - (user.verification_token_expires - timedelta(hours=24))

        if time_since_last_request.total_seconds() < 60:
            remaining_seconds = int(60 - time_since_last_request.total_seconds())
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait {remaining_seconds} seconds before requesting another verification email",
            )

    # Generate new token
    verification_token = generate_verification_token()
    user.verification_token = verification_token
    user.verification_token_expires = datetime.utcnow() + timedelta(hours=24)
    db.commit()

    # Send email in background
    background_tasks.add_task(send_verification_email, email=user.email, token=verification_token)

    return {"message": "Verification email sent"}


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(request: PasswordResetRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Request password reset.

    - Generates password reset token
    - Sends reset email
    - Returns success message (doesn't reveal if email exists)
    """
    user = db.query(User).filter(User.email == request.email).first()

    if not user:
        # Don't reveal if email exists - security best practice
        return {"message": "If the email exists, a reset link has been sent"}

    # Generate reset token
    reset_token = generate_verification_token()
    user.reset_token = reset_token
    user.reset_token_expires = datetime.utcnow() + timedelta(hours=1)
    db.commit()

    # Send email in background
    background_tasks.add_task(send_password_reset_email, email=user.email, token=reset_token)

    return {"message": "Password reset email sent"}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(reset: PasswordReset, db: Session = Depends(get_db)):
    """
    Reset password with token.

    - Validates reset token
    - Updates password
    - Clears reset token
    """
    user = db.query(User).filter(User.reset_token == reset.token, User.reset_token_expires > datetime.utcnow()).first()

    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")

    user.password_hash = get_password_hash(reset.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    db.commit()

    return {"message": "Password reset successfully", "email": user.email}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user_required), db: Session = Depends(get_db)):
    """
    Get current authenticated user information.

    - Returns user profile data
    - Requires valid access token
    """
    from datetime import date
    from ..rate_limiting import check_user_rate_limit, check_extended_tier_limit
    
    # Reset usage counts if it's a new day
    check_user_rate_limit(current_user, db)
    check_extended_tier_limit(current_user, db)
    
    # Refresh the user object to get updated values
    db.refresh(current_user)
    
    return current_user


@router.delete("/delete-account", status_code=status.HTTP_200_OK)
async def delete_account(current_user: User = Depends(get_current_verified_user), db: Session = Depends(get_db)):
    """
    Delete user account permanently.

    - Requires verified email
    - Deletes all user data (cascade)
    - Cannot be undone
    """
    db.delete(current_user)
    db.commit()

    return {"message": "Account deleted successfully"}


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(current_user: User = Depends(get_current_user_required)):
    """
    Logout user (client should delete tokens).

    Note: With JWT, logout is primarily client-side.
    For additional security, implement token blacklisting with Redis.
    """
    return {"message": "Logged out successfully"}
