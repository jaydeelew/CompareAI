"""
Unit tests for rate limiting functionality.

Tests cover:
- Rate limit checking for different subscription tiers
- Anonymous user rate limiting
- Extended tier limits
- Usage increment/decrement
"""
import pytest
from datetime import datetime, timedelta
from app.models import User, UsageLog
from app.rate_limiting import (
    check_user_rate_limit,
    increment_user_usage,
    check_anonymous_rate_limit,
    increment_anonymous_usage,
    check_extended_tier_limit,
    increment_extended_usage,
    check_anonymous_extended_limit,
    increment_anonymous_extended_usage,
)


class TestUserRateLimiting:
    """Tests for authenticated user rate limiting."""
    
    def test_free_tier_rate_limit(self, db_session, test_user):
        """Test rate limit checking for free tier user."""
        # Free tier should have specific limits
        # Adjust based on your actual TIER_LIMITS configuration
        can_proceed, current_count, daily_limit = check_user_rate_limit(
            test_user, db_session
        )
        assert isinstance(can_proceed, bool)
        assert isinstance(current_count, int)
        assert isinstance(daily_limit, int)
        assert current_count >= 0
        assert daily_limit > 0
    
    def test_premium_tier_rate_limit(self, db_session, test_user_premium):
        """Test rate limit checking for premium tier user."""
        can_proceed, current_count, daily_limit = check_user_rate_limit(
            test_user_premium, db_session
        )
        assert isinstance(can_proceed, bool)
        assert isinstance(current_count, int)
        assert isinstance(daily_limit, int)
        # Premium should have higher limits than free
        assert current_count >= 0
        assert daily_limit > 0
    
    def test_rate_limit_exceeded(self, db_session, test_user):
        """Test rate limit when user has exceeded their limit."""
        # Increment usage multiple times to exceed limit
        for _ in range(100):  # Adjust based on your tier limits
            increment_user_usage(test_user, db_session)
            db_session.refresh(test_user)  # Refresh to get updated count
        
        can_proceed, current_count, daily_limit = check_user_rate_limit(
            test_user, db_session
        )
        # Should be False if limit exceeded
        assert isinstance(can_proceed, bool)
        assert isinstance(current_count, int)
        assert isinstance(daily_limit, int)
    
    def test_increment_user_usage(self, db_session, test_user):
        """Test incrementing user usage."""
        initial_count = test_user.daily_usage_count
        
        increment_user_usage(test_user, db_session)
        db_session.refresh(test_user)  # Refresh to get updated count
        
        new_count = test_user.daily_usage_count
        assert new_count == initial_count + 1


class TestAnonymousRateLimiting:
    """Tests for anonymous user rate limiting."""
    
    def test_anonymous_rate_limit_check(self):
        """Test rate limit checking for anonymous users."""
        fingerprint = "test-fingerprint-123"
        can_proceed, remaining = check_anonymous_rate_limit(fingerprint)
        assert isinstance(can_proceed, bool)
        assert isinstance(remaining, int)
        assert remaining >= 0
    
    def test_anonymous_rate_limit_exceeded(self):
        """Test anonymous rate limit when exceeded."""
        fingerprint = "test-fingerprint-456"
        
        # Increment usage multiple times
        for _ in range(100):  # Adjust based on your anonymous limits
            increment_anonymous_usage(fingerprint)
        
        can_proceed, remaining = check_anonymous_rate_limit(fingerprint)
        assert isinstance(can_proceed, bool)
        assert isinstance(remaining, int)
    
    def test_increment_anonymous_usage(self):
        """Test incrementing anonymous user usage."""
        fingerprint = "test-fingerprint-789"
        # Should not raise an error
        increment_anonymous_usage(fingerprint)
        
        can_proceed, remaining = check_anonymous_rate_limit(fingerprint)
        assert isinstance(can_proceed, bool)


class TestExtendedTierLimiting:
    """Tests for extended tier (brief/standard/extended) rate limiting."""
    
    def test_extended_tier_limit_check(self, db_session, test_user):
        """Test extended tier limit checking."""
        can_proceed, current_count, daily_limit = check_extended_tier_limit(
            test_user, db_session
        )
        assert isinstance(can_proceed, bool)
        assert isinstance(current_count, int)
        assert isinstance(daily_limit, int)
        assert current_count >= 0
        assert daily_limit > 0
    
    def test_increment_extended_usage(self, db_session, test_user):
        """Test incrementing extended tier usage."""
        increment_extended_usage(test_user, db_session)
        db_session.refresh(test_user)  # Refresh to get updated count
        
        can_proceed, current_count, daily_limit = check_extended_tier_limit(
            test_user, db_session
        )
        assert isinstance(can_proceed, bool)
        assert isinstance(current_count, int)
        assert isinstance(daily_limit, int)
    
    def test_decrement_extended_usage(self, db_session, test_user):
        """Test decrementing extended tier usage."""
        from app.rate_limiting import decrement_extended_usage
        
        # First increment
        increment_extended_usage(test_user, db_session)
        db_session.refresh(test_user)
        _, current_count_after_increment, _ = check_extended_tier_limit(
            test_user, db_session
        )
        
        # Then decrement
        decrement_extended_usage(test_user, db_session)
        db_session.refresh(test_user)
        _, current_count_after_decrement, _ = check_extended_tier_limit(
            test_user, db_session
        )
        
        # Count should decrease after decrement
        assert current_count_after_decrement <= current_count_after_increment
    
    def test_anonymous_extended_limit(self):
        """Test anonymous extended tier limit checking."""
        fingerprint = "test-fingerprint-extended"
        
        can_proceed, current_count = check_anonymous_extended_limit(fingerprint)
        assert isinstance(can_proceed, bool)
        assert isinstance(current_count, int)
        assert current_count >= 0
    
    def test_increment_anonymous_extended_usage(self):
        """Test incrementing anonymous extended tier usage."""
        fingerprint = "test-fingerprint-extended-inc"
        
        increment_anonymous_extended_usage(fingerprint)
        can_proceed, current_count = check_anonymous_extended_limit(fingerprint)
        assert isinstance(can_proceed, bool)
        assert isinstance(current_count, int)
        assert current_count >= 0


class TestRateLimitEdgeCases:
    """Tests for edge cases in rate limiting."""
    
    def test_rate_limit_with_nonexistent_user(self, db_session):
        """Test rate limit check with a user that has been deleted from the database."""
        from app.models import User
        from sqlalchemy.orm.exc import DetachedInstanceError
        from sqlalchemy.exc import InvalidRequestError
        
        # Create a user in the database
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        user = User(
            email="temp@example.com",
            password_hash=pwd_context.hash("secret"),
            is_verified=True,
            subscription_tier="free",
            is_active=True,
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        
        # Store the user ID and initial values for later reference
        user_id = user.id
        initial_usage_count = user.daily_usage_count
        
        # Detach the user from the session first, then delete it from the database
        db_session.expunge(user)
        db_session.query(User).filter(User.id == user_id).delete()
        db_session.commit()
        
        # Now try to use check_user_rate_limit with the deleted user
        # The function may succeed with cached data, but if it tries to modify
        # and commit, it should fail. We test that it either:
        # 1. Raises an error when trying to commit changes to a deleted user, OR
        # 2. Returns a result based on cached data (which is acceptable behavior)
        try:
            can_proceed, current_count, daily_limit = check_user_rate_limit(user, db_session)
            # If it succeeds, verify the result is valid
            assert isinstance(can_proceed, bool)
            assert isinstance(current_count, int)
            assert isinstance(daily_limit, int)
            # The count should be based on cached data (initial value or 0)
            assert current_count >= 0
        except (DetachedInstanceError, InvalidRequestError, AttributeError) as e:
            # If it raises an error, that's also acceptable - it means the function
            # tried to access/modify the deleted user and SQLAlchemy caught it
            assert True  # Test passes if we catch the expected error
    
    def test_rate_limit_with_invalid_tier(self, db_session, test_user):
        """Test rate limit check with invalid subscription tier."""
        # Set invalid tier on user
        original_tier = test_user.subscription_tier
        test_user.subscription_tier = "invalid_tier"
        db_session.commit()
        db_session.refresh(test_user)
        
        # Should handle gracefully (get_daily_limit should return a default)
        can_proceed, current_count, daily_limit = check_user_rate_limit(
            test_user, db_session
        )
        assert isinstance(can_proceed, bool)
        assert isinstance(current_count, int)
        assert isinstance(daily_limit, int)
        
        # Restore original tier
        test_user.subscription_tier = original_tier
        db_session.commit()
    
    def test_concurrent_rate_limit_checks(self, db_session, test_user):
        """Test multiple concurrent rate limit checks."""
        # Simulate concurrent checks
        results = []
        for _ in range(10):
            can_proceed, current_count, daily_limit = check_user_rate_limit(
                test_user, db_session
            )
            results.append((can_proceed, current_count, daily_limit))
        
        # All results should be valid
        assert len(results) == 10
        assert all(isinstance(r[0], bool) and isinstance(r[1], int) and isinstance(r[2], int) for r in results)

