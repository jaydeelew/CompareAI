"""
Shared test fixtures and configuration for pytest.

This module provides common fixtures used across all test modules,
including database setup, API client, and test data factories.
"""
import sys
import os
import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Set environment variables to avoid email configuration issues
os.environ.setdefault('MAIL_USERNAME', '')
os.environ.setdefault('MAIL_PASSWORD', '')
os.environ.setdefault('MAIL_FROM', '')

# Mock email service functions before importing app to avoid fastapi_mail import issues
# This is a known bug in fastapi-mail 1.5.2 where SecretStr is not imported
email_service_mock = MagicMock()
email_service_mock.send_verification_email = AsyncMock(return_value=None)
email_service_mock.send_password_reset_email = AsyncMock(return_value=None)
email_service_mock.send_subscription_confirmation_email = AsyncMock(return_value=None)
email_service_mock.send_usage_limit_warning_email = AsyncMock(return_value=None)
email_service_mock.EMAIL_CONFIGURED = False

# Patch the email_service module before it's imported
sys.modules['app.email_service'] = email_service_mock

# Now import app - email_service will use the mock
from app.main import app
from app.database import Base, get_db
from app.models import User, UsageLog


# In-memory SQLite database for testing
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

# Create test engine with in-memory database
test_engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

# Create test session factory
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="function")
def db_session():
    """
    Create a fresh database session for each test.
    
    This fixture:
    - Creates all tables before the test
    - Yields a database session
    - Drops all tables after the test
    """
    # Create all tables
    Base.metadata.create_all(bind=test_engine)
    
    # Create a new session
    session = TestingSessionLocal()
    
    try:
        yield session
    finally:
        session.close()
        # Drop all tables after test
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="function")
def client(db_session):
    """
    Create a test client with database dependency override.
    
    This fixture:
    - Overrides the get_db dependency to use test database
    - Returns a TestClient instance for making API requests
    """
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as test_client:
        yield test_client
    
    # Clean up dependency override
    app.dependency_overrides.clear()


@pytest.fixture
def test_user(db_session):
    """
    Create a test user in the database.
    
    Returns a User instance with default test credentials.
    Password: "secret"
    """
    from passlib.context import CryptContext
    
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    user = User(
        email="test@example.com",
        password_hash=pwd_context.hash("secret"),
        is_verified=True,
        subscription_tier="free",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def test_user_premium(db_session):
    """
    Create a premium tier test user.
    Password: "secret"
    """
    from passlib.context import CryptContext
    
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    user = User(
        email="premium@example.com",
        password_hash=pwd_context.hash("secret"),
        is_verified=True,
        subscription_tier="pro",  # Using "pro" as premium tier
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def test_user_admin(db_session):
    """
    Create an admin test user.
    Password: "secret"
    """
    from passlib.context import CryptContext
    
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    user = User(
        email="admin@example.com",
        password_hash=pwd_context.hash("secret"),
        is_verified=True,
        subscription_tier="pro",
        is_admin=True,
        role="admin",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def authenticated_client(client, test_user):
    """
    Create a test client with authenticated user.
    
    Returns a tuple of (client, user, token) for making authenticated requests.
    """
    # Login to get token
    response = client.post(
        "/api/auth/login",
        data={
            "username": test_user.email,
            "password": "secret",  # Default test password
        },
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    
    # Set authorization header
    client.headers = {"Authorization": f"Bearer {token}"}
    
    return client, test_user, token

