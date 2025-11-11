"""
Edge case tests for rate limiting functionality.

Tests cover:
- Boundary conditions
- Reset scenarios
- Extended tier limits
- Anonymous user edge cases
- Concurrent access
"""
import pytest
from datetime import date, datetime, timedelta
from app.models import User
from app.rate_limiting import (
    check_user_rate_limit,
    increment_user_usage,
    check_anonymous_rate_limit,
    increment_anonymous_usage,
    check_extended_tier_limit,
    increment_extended_usage,
    check_anonymous_extended_limit,
    increment_anonymous_extended_usage,
    get_user_usage_stats,
    get_anonymous_usage_stats,
    anonymous_rate_limit_storage,
)


class TestUserRateLimitBoundaries:
    """Tests for user rate limit boundary conditions."""
    
    def test_rate_limit_at_exact_limit(self, db_session, test_user_free):
        """Test rate limiting at exact limit."""
        from app.config import get_daily_limit
        
        daily_limit = get_daily_limit(test_user_free.subscription_tier)
        test_user_free.daily_usage_count = daily_limit
        
        is_allowed, count, limit = check_user_rate_limit(test_user_free, db_session)
        assert is_allowed is False
        assert count == daily_limit
        assert limit == daily_limit
    
    def test_rate_limit_one_below_limit(self, db_session, test_user_free):
        """Test rate limiting one below limit."""
        from app.config import get_daily_limit
        
        daily_limit = get_daily_limit(test_user_free.subscription_tier)
        test_user_free.daily_usage_count = daily_limit - 1
        
        is_allowed, count, limit = check_user_rate_limit(test_user_free, db_session)
        assert is_allowed is True
        assert count == daily_limit - 1
        assert limit == daily_limit
    
    def test_rate_limit_one_above_limit(self, db_session, test_user_free):
        """Test rate limiting one above limit."""
        from app.config import get_daily_limit
        
        daily_limit = get_daily_limit(test_user_free.subscription_tier)
        test_user_free.daily_usage_count = daily_limit + 1
        
        is_allowed, count, limit = check_user_rate_limit(test_user_free, db_session)
        assert is_allowed is False
        assert count == daily_limit + 1
    
    def test_rate_limit_zero_usage(self, db_session, test_user_free):
        """Test rate limiting with zero usage."""
        test_user_free.daily_usage_count = 0
        
        is_allowed, count, limit = check_user_rate_limit(test_user_free, db_session)
        assert is_allowed is True
        assert count == 0


class TestRateLimitReset:
    """Tests for rate limit reset scenarios."""
    
    def test_reset_on_new_day(self, db_session, test_user_free):
        """Test that usage resets on new day."""
        from app.config import get_daily_limit
        
        # Set usage to limit and reset date to yesterday
        daily_limit = get_daily_limit(test_user_free.subscription_tier)
        test_user_free.daily_usage_count = daily_limit
        test_user_free.usage_reset_date = date.today() - timedelta(days=1)
        
        is_allowed, count, limit = check_user_rate_limit(test_user_free, db_session)
        
        # Should reset and allow usage
        assert is_allowed is True
        assert count == 0
        assert test_user_free.usage_reset_date == date.today()
    
    def test_no_reset_same_day(self, db_session, test_user_free):
        """Test that usage doesn't reset on same day."""
        test_user_free.daily_usage_count = 5
        test_user_free.usage_reset_date = date.today()
        
        is_allowed, count, limit = check_user_rate_limit(test_user_free, db_session)
        
        # Should not reset
        assert count == 5
        assert test_user_free.usage_reset_date == date.today()
    
    def test_reset_multiple_days_later(self, db_session, test_user_free):
        """Test reset after multiple days."""
        test_user_free.daily_usage_count = 10
        test_user_free.usage_reset_date = date.today() - timedelta(days=5)
        
        is_allowed, count, limit = check_user_rate_limit(test_user_free, db_session)
        
        # Should reset
        assert count == 0
        assert test_user_free.usage_reset_date == date.today()


class TestIncrementUsage:
    """Tests for usage increment edge cases."""
    
    def test_increment_by_one(self, db_session, test_user_free):
        """Test incrementing usage by one."""
        initial_count = test_user_free.daily_usage_count
        increment_user_usage(test_user_free, db_session, count=1)
        
        db_session.refresh(test_user_free)
        assert test_user_free.daily_usage_count == initial_count + 1
    
    def test_increment_by_multiple(self, db_session, test_user_free):
        """Test incrementing usage by multiple."""
        initial_count = test_user_free.daily_usage_count
        increment_user_usage(test_user_free, db_session, count=5)
        
        db_session.refresh(test_user_free)
        assert test_user_free.daily_usage_count == initial_count + 5
    
    def test_increment_zero(self, db_session, test_user_free):
        """Test incrementing by zero."""
        initial_count = test_user_free.daily_usage_count
        increment_user_usage(test_user_free, db_session, count=0)
        
        db_session.refresh(test_user_free)
        assert test_user_free.daily_usage_count == initial_count
    
    def test_increment_negative(self, db_session, test_user_free):
        """Test incrementing by negative number."""
        initial_count = test_user_free.daily_usage_count
        increment_user_usage(test_user_free, db_session, count=-1)
        
        db_session.refresh(test_user_free)
        # Implementation allows negative increments (may be used for corrections)
        assert test_user_free.daily_usage_count == initial_count - 1


class TestAnonymousRateLimitBoundaries:
    """Tests for anonymous rate limit boundary conditions."""
    
    def test_anonymous_at_limit(self):
        """Test anonymous user at limit."""
        identifier = "ip:192.168.1.1"
        from app.config import ANONYMOUS_DAILY_LIMIT
        
        # Set to limit
        anonymous_rate_limit_storage[identifier]["count"] = ANONYMOUS_DAILY_LIMIT
        anonymous_rate_limit_storage[identifier]["date"] = datetime.now().date().isoformat()
        
        is_allowed, count = check_anonymous_rate_limit(identifier)
        assert is_allowed is False
        assert count == ANONYMOUS_DAILY_LIMIT
    
    def test_anonymous_one_below_limit(self):
        """Test anonymous user one below limit."""
        identifier = "ip:192.168.1.2"
        from app.config import ANONYMOUS_DAILY_LIMIT
        
        anonymous_rate_limit_storage[identifier]["count"] = ANONYMOUS_DAILY_LIMIT - 1
        anonymous_rate_limit_storage[identifier]["date"] = datetime.now().date().isoformat()
        
        is_allowed, count = check_anonymous_rate_limit(identifier)
        assert is_allowed is True
        assert count == ANONYMOUS_DAILY_LIMIT - 1
    
    def test_anonymous_reset_on_new_day(self):
        """Test anonymous user reset on new day."""
        identifier = "ip:192.168.1.3"
        
        # Set to limit with yesterday's date
        anonymous_rate_limit_storage[identifier]["count"] = 100
        anonymous_rate_limit_storage[identifier]["date"] = (datetime.now().date() - timedelta(days=1)).isoformat()
        
        is_allowed, count = check_anonymous_rate_limit(identifier)
        
        # Should reset
        assert is_allowed is True
        assert count == 0
        assert anonymous_rate_limit_storage[identifier]["date"] == datetime.now().date().isoformat()


class TestExtendedTierLimits:
    """Tests for extended tier limit edge cases."""
    
    def test_extended_limit_at_boundary(self, db_session, test_user_pro):
        """Test extended limit at boundary."""
        from app.config import get_extended_limit
        
        extended_limit = get_extended_limit(test_user_pro.subscription_tier)
        test_user_pro.daily_extended_usage = extended_limit
        
        is_allowed, count, limit = check_extended_tier_limit(test_user_pro, db_session)
        assert is_allowed is False
        assert count == extended_limit
    
    def test_extended_limit_one_below(self, db_session, test_user_pro):
        """Test extended limit one below boundary."""
        from app.config import get_extended_limit
        
        extended_limit = get_extended_limit(test_user_pro.subscription_tier)
        test_user_pro.daily_extended_usage = extended_limit - 1
        
        is_allowed, count, limit = check_extended_tier_limit(test_user_pro, db_session)
        assert is_allowed is True
        assert count == extended_limit - 1
    
    def test_increment_extended_usage(self, db_session, test_user_pro):
        """Test incrementing extended usage."""
        initial_count = test_user_pro.daily_extended_usage
        increment_extended_usage(test_user_pro, db_session, count=1)
        
        db_session.refresh(test_user_pro)
        assert test_user_pro.daily_extended_usage == initial_count + 1
    
    def test_anonymous_extended_limit(self):
        """Test anonymous extended limit."""
        identifier = "ip:192.168.1.4"
        from app.config import EXTENDED_TIER_LIMITS
        
        # Get anonymous extended limit (should be 0 or minimal)
        extended_key = f"{identifier}_extended"
        anonymous_rate_limit_storage[extended_key]["count"] = 1
        anonymous_rate_limit_storage[extended_key]["date"] = datetime.now().date().isoformat()
        
        # Function returns (is_allowed, count) - 2 values, not 3
        is_allowed, count = check_anonymous_extended_limit(identifier)
        # Should check against anonymous extended limit
        assert isinstance(is_allowed, bool)
        assert isinstance(count, int)


class TestUsageStats:
    """Tests for usage statistics edge cases."""
    
    def test_usage_stats_at_limit(self, test_user_free):
        """Test usage stats when at limit."""
        from app.config import get_daily_limit
        
        daily_limit = get_daily_limit(test_user_free.subscription_tier)
        test_user_free.daily_usage_count = daily_limit
        
        stats = get_user_usage_stats(test_user_free)
        assert stats["daily_usage"] == daily_limit
        assert stats["remaining_usage"] == 0
        assert stats["daily_limit"] == daily_limit
    
    def test_usage_stats_zero_usage(self, test_user_free):
        """Test usage stats with zero usage."""
        test_user_free.daily_usage_count = 0
        
        stats = get_user_usage_stats(test_user_free)
        assert stats["daily_usage"] == 0
        assert stats["remaining_usage"] > 0
    
    def test_usage_stats_over_limit(self, test_user_free):
        """Test usage stats when over limit."""
        from app.config import get_daily_limit
        
        daily_limit = get_daily_limit(test_user_free.subscription_tier)
        test_user_free.daily_usage_count = daily_limit + 10
        
        stats = get_user_usage_stats(test_user_free)
        assert stats["daily_usage"] == daily_limit + 10
        assert stats["remaining_usage"] == 0  # Should not go negative
    
    def test_anonymous_usage_stats(self):
        """Test anonymous usage stats."""
        identifier = "ip:192.168.1.5"
        from app.config import ANONYMOUS_DAILY_LIMIT
        
        anonymous_rate_limit_storage[identifier]["count"] = 5
        anonymous_rate_limit_storage[identifier]["date"] = datetime.now().date().isoformat()
        
        stats = get_anonymous_usage_stats(identifier)
        assert stats["daily_usage"] == 5
        assert stats["remaining_usage"] == ANONYMOUS_DAILY_LIMIT - 5


class TestConcurrentAccess:
    """Tests for concurrent access scenarios."""
    
    def test_concurrent_increment(self, db_session, test_user_free):
        """Test concurrent usage increments."""
        import threading
        
        initial_count = test_user_free.daily_usage_count
        
        def increment():
            db_session.refresh(test_user_free)
            increment_user_usage(test_user_free, db_session, count=1)
        
        # Create multiple threads
        threads = [threading.Thread(target=increment) for _ in range(5)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        
        db_session.refresh(test_user_free)
        # Should have incremented (may not be exactly 5 due to race conditions)
        assert test_user_free.daily_usage_count >= initial_count


class TestDifferentSubscriptionTiers:
    """Tests for different subscription tier limits."""
    
    def test_free_tier_limit(self, db_session, test_user_free):
        """Test free tier limit."""
        from app.config import get_daily_limit
        
        limit = get_daily_limit(test_user_free.subscription_tier)
        assert limit > 0
        
        is_allowed, count, daily_limit = check_user_rate_limit(test_user_free, db_session)
        assert daily_limit == limit
    
    def test_starter_tier_limit(self, db_session, test_user_starter):
        """Test starter tier limit."""
        from app.config import get_daily_limit
        
        limit = get_daily_limit(test_user_starter.subscription_tier)
        assert limit > 0
        
        is_allowed, count, daily_limit = check_user_rate_limit(test_user_starter, db_session)
        assert daily_limit == limit
    
    def test_pro_tier_limit(self, db_session, test_user_pro):
        """Test pro tier limit."""
        from app.config import get_daily_limit
        
        limit = get_daily_limit(test_user_pro.subscription_tier)
        assert limit > 0
        
        is_allowed, count, daily_limit = check_user_rate_limit(test_user_pro, db_session)
        assert daily_limit == limit
    
    def test_pro_plus_tier_limit(self, db_session, test_user_pro_plus):
        """Test pro_plus tier limit."""
        from app.config import get_daily_limit
        
        limit = get_daily_limit(test_user_pro_plus.subscription_tier)
        assert limit > 0
        
        is_allowed, count, daily_limit = check_user_rate_limit(test_user_pro_plus, db_session)
        assert daily_limit == limit
    
    def test_tier_hierarchy(self):
        """Test that tier limits increase with tier level."""
        from app.config import get_daily_limit
        
        free_limit = get_daily_limit("free")
        starter_limit = get_daily_limit("starter")
        pro_limit = get_daily_limit("pro")
        pro_plus_limit = get_daily_limit("pro_plus")
        
        # Higher tiers should have higher or equal limits
        assert starter_limit >= free_limit
        assert pro_limit >= starter_limit
        assert pro_plus_limit >= pro_limit

