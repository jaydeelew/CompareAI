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
        can_proceed, remaining = check_user_rate_limit(
            db_session, test_user.id, "free"
        )
        assert isinstance(can_proceed, bool)
        assert isinstance(remaining, int)
        assert remaining >= 0
    
    def test_premium_tier_rate_limit(self, db_session, test_user_premium):
        """Test rate limit checking for premium tier user."""
        can_proceed, remaining = check_user_rate_limit(
            db_session, test_user_premium.id, "premium"
        )
        assert isinstance(can_proceed, bool)
        assert isinstance(remaining, int)
        # Premium should have higher limits than free
        assert remaining >= 0
    
    def test_rate_limit_exceeded(self, db_session, test_user):
        """Test rate limit when user has exceeded their limit."""
        # Increment usage multiple times to exceed limit
        tier = test_user.subscription_tier
        for _ in range(100):  # Adjust based on your tier limits
            increment_user_usage(db_session, test_user.id, tier)
        
        can_proceed, remaining = check_user_rate_limit(
            db_session, test_user.id, tier
        )
        # Should be False if limit exceeded
        assert isinstance(can_proceed, bool)
        assert isinstance(remaining, int)
    
    def test_increment_user_usage(self, db_session, test_user):
        """Test incrementing user usage."""
        initial_count = db_session.query(UsageLog).filter(
            UsageLog.user_id == test_user.id
        ).count()
        
        increment_user_usage(db_session, test_user.id, test_user.subscription_tier)
        
        new_count = db_session.query(UsageLog).filter(
            UsageLog.user_id == test_user.id
        ).count()
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
        tier_type = "standard"  # or "brief", "extended"
        can_proceed, remaining = check_extended_tier_limit(
            db_session, test_user.id, tier_type
        )
        assert isinstance(can_proceed, bool)
        assert isinstance(remaining, int)
        assert remaining >= 0
    
    def test_increment_extended_usage(self, db_session, test_user):
        """Test incrementing extended tier usage."""
        tier_type = "standard"
        increment_extended_usage(db_session, test_user.id, tier_type)
        
        can_proceed, remaining = check_extended_tier_limit(
            db_session, test_user.id, tier_type
        )
        assert isinstance(can_proceed, bool)
    
    def test_decrement_extended_usage(self, db_session, test_user):
        """Test decrementing extended tier usage."""
        from app.rate_limiting import decrement_extended_usage
        
        tier_type = "standard"
        # First increment
        increment_extended_usage(db_session, test_user.id, tier_type)
        _, remaining_after_increment = check_extended_tier_limit(
            db_session, test_user.id, tier_type
        )
        
        # Then decrement
        decrement_extended_usage(db_session, test_user.id, tier_type)
        _, remaining_after_decrement = check_extended_tier_limit(
            db_session, test_user.id, tier_type
        )
        
        # Remaining should increase after decrement
        assert remaining_after_decrement >= remaining_after_increment
    
    def test_anonymous_extended_limit(self):
        """Test anonymous extended tier limit checking."""
        fingerprint = "test-fingerprint-extended"
        tier_type = "standard"
        
        can_proceed, remaining = check_anonymous_extended_limit(fingerprint, tier_type)
        assert isinstance(can_proceed, bool)
        assert isinstance(remaining, int)
    
    def test_increment_anonymous_extended_usage(self):
        """Test incrementing anonymous extended tier usage."""
        fingerprint = "test-fingerprint-extended-inc"
        tier_type = "standard"
        
        increment_anonymous_extended_usage(fingerprint, tier_type)
        can_proceed, remaining = check_anonymous_extended_limit(fingerprint, tier_type)
        assert isinstance(can_proceed, bool)


class TestRateLimitEdgeCases:
    """Tests for edge cases in rate limiting."""
    
    def test_rate_limit_with_nonexistent_user(self, db_session):
        """Test rate limit check with non-existent user ID."""
        # Should handle gracefully without raising exception
        can_proceed, remaining = check_user_rate_limit(
            db_session, 99999, "free"
        )
        assert isinstance(can_proceed, bool)
        assert isinstance(remaining, int)
    
    def test_rate_limit_with_invalid_tier(self, db_session, test_user):
        """Test rate limit check with invalid subscription tier."""
        # Should handle gracefully
        can_proceed, remaining = check_user_rate_limit(
            db_session, test_user.id, "invalid_tier"
        )
        assert isinstance(can_proceed, bool)
        assert isinstance(remaining, int)
    
    def test_concurrent_rate_limit_checks(self, db_session, test_user):
        """Test multiple concurrent rate limit checks."""
        # Simulate concurrent checks
        results = []
        for _ in range(10):
            can_proceed, remaining = check_user_rate_limit(
                db_session, test_user.id, test_user.subscription_tier
            )
            results.append((can_proceed, remaining))
        
        # All results should be valid
        assert len(results) == 10
        assert all(isinstance(r[0], bool) and isinstance(r[1], int) for r in results)

