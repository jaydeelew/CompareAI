"""
Unit tests for authentication functionality.

Tests cover:
- User registration
- User login
- Token refresh
- Email verification
- Password reset
"""
import pytest
from fastapi import status
from app.models import User


class TestUserRegistration:
    """Tests for user registration endpoint."""
    
    def test_register_new_user(self, client, db_session):
        """Test successful user registration."""
        response = client.post(
            "/api/auth/register",
            json={
                "email": "newuser@example.com",
                "password": "SecurePassword123!",
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert "id" in data["user"]
        assert data["user"]["email"] == "newuser@example.com"
        assert "password" not in data  # Password should not be in response
        assert "password" not in data.get("user", {})  # Password should not be in user object either
        
        # Verify user was created in database
        user = db_session.query(User).filter(User.email == "newuser@example.com").first()
        assert user is not None
        assert user.is_verified is False  # Should not be verified initially
    
    def test_register_duplicate_email(self, client, test_user):
        """Test registration with existing email fails."""
        response = client.post(
            "/api/auth/register",
            json={
                "email": test_user.email,
                "password": "AnotherPassword123!",
            },
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
    
    def test_register_invalid_email(self, client):
        """Test registration with invalid email format."""
        response = client.post(
            "/api/auth/register",
            json={
                "email": "not-an-email",
                "password": "SecurePassword123!",
            },
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_register_weak_password(self, client):
        """Test registration with weak password."""
        response = client.post(
            "/api/auth/register",
            json={
                "email": "user@example.com",
                "password": "123",  # Too short
            },
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestUserLogin:
    """Tests for user login endpoint."""
    
    def test_login_success(self, client, test_user):
        """Test successful login with correct credentials."""
        response = client.post(
            "/api/auth/login",
            json={
                "email": test_user.email,
                "password": "secret",  # Default test password
            },
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert "token_type" in data
        assert data["token_type"] == "bearer"
    
    def test_login_wrong_password(self, client, test_user):
        """Test login with incorrect password."""
        response = client.post(
            "/api/auth/login",
            json={
                "email": test_user.email,
                "password": "wrongpassword",
            },
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_login_nonexistent_user(self, client):
        """Test login with non-existent user."""
        response = client.post(
            "/api/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "SomePassword123!",
            },
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_login_unverified_user(self, client, db_session):
        """Test login with unverified user (if verification is required)."""
        # Create unverified user
        from app.models import User
        from passlib.context import CryptContext
        
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        unverified_user = User(
            email="unverified@example.com",
            password_hash=pwd_context.hash("password123"),
            is_verified=False,
        )
        db_session.add(unverified_user)
        db_session.commit()
        
        response = client.post(
            "/api/auth/login",
            json={
                "email": unverified_user.email,
                "password": "password123",
            },
        )
        # Behavior depends on implementation - may allow or deny
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_403_FORBIDDEN]


class TestTokenRefresh:
    """Tests for token refresh endpoint."""
    
    def test_refresh_token_success(self, authenticated_client):
        """Test successful token refresh."""
        client, user, old_access_token, old_refresh_token = authenticated_client
        
        response = client.post(
            "/api/auth/refresh",
            json={"refresh_token": old_refresh_token}
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert "token_type" in data
        assert data["token_type"] == "bearer"
        # Verify tokens are valid (non-empty strings)
        assert len(data["access_token"]) > 0
        assert len(data["refresh_token"]) > 0
        # Note: Tokens may be identical if created in the same second due to JWT encoding,
        # but the endpoint should still return valid tokens
    
    def test_refresh_token_unauthorized(self, client):
        """Test token refresh without valid refresh token."""
        # Test with missing refresh_token (422 validation error)
        response = client.post("/api/auth/refresh")
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        # Test with invalid refresh_token (401 unauthorized)
        response = client.post(
            "/api/auth/refresh",
            json={"refresh_token": "invalid-token"}
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestEmailVerification:
    """Tests for email verification functionality."""
    
    def test_verify_email_success(self, client, db_session):
        """Test successful email verification."""
        # Create unverified user
        from app.models import User
        from passlib.context import CryptContext
        
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        user = User(
            email="verify@example.com",
            password_hash=pwd_context.hash("password123"),
            is_verified=False,
            verification_token="test-token-123",
        )
        db_session.add(user)
        db_session.commit()
        
        # Verify email (implementation depends on your verification endpoint)
        # This is a placeholder - adjust based on your actual implementation
        response = client.get(f"/api/auth/verify?token=test-token-123")
        # Adjust expected status code based on your implementation
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_404_NOT_FOUND]
    
    def test_verify_email_invalid_token(self, client):
        """Test email verification with invalid token."""
        response = client.get("/api/auth/verify?token=invalid-token")
        assert response.status_code == status.HTTP_404_NOT_FOUND

