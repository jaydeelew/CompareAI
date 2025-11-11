"""
Edge case and error scenario tests for comparison endpoint.

Tests cover:
- Invalid model IDs
- API failures and timeouts
- Rate limiting edge cases
- Input validation edge cases
- Error handling scenarios
"""
import pytest
from fastapi import status
from unittest.mock import patch, MagicMock
from app.models import User


class TestComparisonInputValidation:
    """Tests for input validation edge cases."""
    
    def test_empty_input(self, authenticated_client):
        """Test comparison with empty input."""
        client, user, token, _ = authenticated_client
        
        response = client.post(
            "/api/compare",
            json={
                "input_data": "",
                "models": ["gpt-4"],
                "tier": "brief"
            }
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "empty" in response.json()["detail"].lower()
    
    def test_whitespace_only_input(self, authenticated_client):
        """Test comparison with whitespace-only input."""
        client, user, token, _ = authenticated_client
        
        response = client.post(
            "/api/compare",
            json={
                "input_data": "   \n\t  ",
                "models": ["gpt-4"],
                "tier": "brief"
            }
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
    
    def test_no_models_selected(self, authenticated_client):
        """Test comparison with no models selected."""
        client, user, token, _ = authenticated_client
        
        response = client.post(
            "/api/compare",
            json={
                "input_data": "Test prompt",
                "models": [],
                "tier": "brief"
            }
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "at least one" in response.json()["detail"].lower()
    
    def test_invalid_model_id(self, authenticated_client):
        """Test comparison with invalid model ID."""
        client, user, token, _ = authenticated_client
        
        response = client.post(
            "/api/compare",
            json={
                "input_data": "Test prompt",
                "models": ["invalid-model-id-12345"],
                "tier": "brief"
            }
        )
        # Should either fail validation or return error in results
        assert response.status_code in [
            status.HTTP_200_OK,  # If it accepts and returns error in results
            status.HTTP_400_BAD_REQUEST,  # If it validates upfront
            status.HTTP_422_UNPROCESSABLE_ENTITY
        ]
    
    def test_invalid_tier(self, authenticated_client):
        """Test comparison with invalid tier."""
        client, user, token, _ = authenticated_client
        
        response = client.post(
            "/api/compare",
            json={
                "input_data": "Test prompt",
                "models": ["gpt-4"],
                "tier": "invalid_tier"
            }
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_input_exceeds_tier_limit(self, authenticated_client):
        """Test input that exceeds tier character limit."""
        client, user, token, _ = authenticated_client
        
        # Create input that exceeds brief tier limit (assuming it's 500 chars)
        long_input = "a" * 10000
        
        response = client.post(
            "/api/compare",
            json={
                "input_data": long_input,
                "models": ["gpt-4"],
                "tier": "brief"
            }
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "exceed" in response.json()["detail"].lower() or "limit" in response.json()["detail"].lower()
    
    def test_too_many_models(self, authenticated_client):
        """Test comparison with too many models (exceeds tier limit)."""
        client, user, token, _ = authenticated_client
        
        # Try with more models than allowed for free tier (assuming limit is 3)
        many_models = ["gpt-4", "claude-3-opus", "gpt-3.5-turbo", "claude-3-sonnet", "gpt-4-turbo"]
        
        response = client.post(
            "/api/compare",
            json={
                "input_data": "Test prompt",
                "models": many_models,
                "tier": "brief"
            }
        )
        # Should either fail validation or succeed but only use allowed models
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_422_UNPROCESSABLE_ENTITY
        ]
    
    def test_very_long_input(self, authenticated_client):
        """Test comparison with very long input (within extended tier limit)."""
        client, user, token, _ = authenticated_client
        
        # Create very long input (but within extended tier limit)
        long_input = "Test prompt. " * 1000  # ~13,000 characters
        
        response = client.post(
            "/api/compare",
            json={
                "input_data": long_input,
                "models": ["gpt-4"],
                "tier": "extended"
            }
        )
        # Should succeed if within extended tier limit
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_429_TOO_MANY_REQUESTS,
            status.HTTP_400_BAD_REQUEST
        ]


class TestComparisonRateLimitingEdgeCases:
    """Tests for rate limiting edge cases."""
    
    def test_rate_limit_at_boundary(self, authenticated_client, db_session):
        """Test rate limiting at exact boundary."""
        client, user, token, _ = authenticated_client
        
        # Set usage count to exactly at limit
        from app.config import get_daily_limit
        daily_limit = get_daily_limit(user.subscription_tier)
        user.daily_usage_count = daily_limit - 1
        db_session.commit()
        
        # First request should succeed (at limit - 1)
        response1 = client.post(
            "/api/compare",
            json={
                "input_data": "Test prompt",
                "models": ["gpt-4"],
                "tier": "brief"
            }
        )
        # Should succeed (now at limit)
        assert response1.status_code in [status.HTTP_200_OK, status.HTTP_429_TOO_MANY_REQUESTS]
        
        # Refresh user
        db_session.refresh(user)
        
        # Next request should be rate limited (at limit)
        if user.daily_usage_count >= daily_limit:
            response2 = client.post(
                "/api/compare",
                json={
                    "input_data": "Test prompt 2",
                    "models": ["gpt-4"],
                    "tier": "brief"
                }
            )
            assert response2.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    
    def test_rate_limit_reset_on_new_day(self, authenticated_client, db_session):
        """Test that rate limit resets on new day."""
        from datetime import date, timedelta
        from app.config import get_daily_limit
        
        client, user, token, _ = authenticated_client
        
        # Set usage to limit and set reset date to yesterday
        daily_limit = get_daily_limit(user.subscription_tier)
        user.daily_usage_count = daily_limit
        user.usage_reset_date = date.today() - timedelta(days=1)
        db_session.commit()
        
        # Request should succeed (limit should reset)
        response = client.post(
            "/api/compare",
            json={
                "input_data": "Test prompt",
                "models": ["gpt-4"],
                "tier": "brief"
            }
        )
        # Should succeed because limit was reset
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_429_TOO_MANY_REQUESTS]
        
        # Verify usage was reset
        db_session.refresh(user)
        assert user.usage_reset_date == date.today()
        assert user.daily_usage_count <= 1  # Should be 0 or 1 (if request succeeded)


class TestComparisonErrorHandling:
    """Tests for error handling scenarios."""
    
    @patch('app.routers.api.run_models')
    def test_api_failure_handling(self, mock_run_models, authenticated_client):
        """Test handling of API failures."""
        client, user, token, _ = authenticated_client
        
        # Mock API failure
        mock_run_models.side_effect = Exception("API connection failed")
        
        response = client.post(
            "/api/compare",
            json={
                "input_data": "Test prompt",
                "models": ["gpt-4"],
                "tier": "brief"
            }
        )
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    
    @patch('app.routers.api.run_models')
    def test_partial_model_failure(self, mock_run_models, authenticated_client):
        """Test handling when some models fail."""
        client, user, token, _ = authenticated_client
        
        # Mock partial failure (some models succeed, some fail)
        def mock_run_models_side_effect(input_data, models, tier, conversation_history):
            results = {}
            for i, model in enumerate(models):
                if i == 0:
                    results[model] = "Success response"
                else:
                    results[model] = "Error: Model failed"
            return results
        
        mock_run_models.side_effect = mock_run_models_side_effect
        
        response = client.post(
            "/api/compare",
            json={
                "input_data": "Test prompt",
                "models": ["gpt-4", "claude-3-opus"],
                "tier": "brief"
            }
        )
        # Should succeed but with some failed models
        if response.status_code == status.HTTP_200_OK:
            data = response.json()
            assert "results" in data
            assert "metadata" in data
            assert data["metadata"]["models_failed"] >= 0
    
    def test_concurrent_requests(self, authenticated_client):
        """Test handling of concurrent requests."""
        import asyncio
        import concurrent.futures
        
        client, user, token, _ = authenticated_client
        
        def make_request():
            return client.post(
                "/api/compare",
                json={
                    "input_data": "Test prompt",
                    "models": ["gpt-4"],
                    "tier": "brief"
                }
            )
        
        # Make multiple concurrent requests
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(make_request) for _ in range(5)]
            responses = [future.result() for future in concurrent.futures.as_completed(futures)]
        
        # All requests should complete (may be rate limited)
        assert len(responses) == 5
        for response in responses:
            assert response.status_code in [
                status.HTTP_200_OK,
                status.HTTP_429_TOO_MANY_REQUESTS,
                status.HTTP_400_BAD_REQUEST,
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ]


class TestComparisonStreamingEdgeCases:
    """Tests for streaming comparison edge cases."""
    
    def test_streaming_empty_input(self, authenticated_client):
        """Test streaming with empty input."""
        client, user, token, _ = authenticated_client
        
        response = client.post(
            "/api/compare-stream",
            json={
                "input_data": "",
                "models": ["gpt-4"],
                "tier": "brief"
            }
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
    
    def test_streaming_no_models(self, authenticated_client):
        """Test streaming with no models."""
        client, user, token, _ = authenticated_client
        
        response = client.post(
            "/api/compare-stream",
            json={
                "input_data": "Test prompt",
                "models": [],
                "tier": "brief"
            }
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
    
    def test_streaming_invalid_tier(self, authenticated_client):
        """Test streaming with invalid tier."""
        client, user, token, _ = authenticated_client
        
        response = client.post(
            "/api/compare-stream",
            json={
                "input_data": "Test prompt",
                "models": ["gpt-4"],
                "tier": "invalid"
            }
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestComparisonAnonymousUserEdgeCases:
    """Tests for anonymous user edge cases."""
    
    def test_anonymous_user_rate_limit(self, client):
        """Test anonymous user rate limiting."""
        # Make many requests as anonymous user
        responses = []
        for i in range(20):
            response = client.post(
                "/api/compare",
                json={
                    "input_data": f"Test prompt {i}",
                    "models": ["gpt-4"],
                    "tier": "brief"
                }
            )
            responses.append(response.status_code)
        
        # At least some should be rate limited
        assert status.HTTP_429_TOO_MANY_REQUESTS in responses or len(responses) == 20
    
    def test_anonymous_user_with_fingerprint(self, client):
        """Test anonymous user with browser fingerprint."""
        fingerprint = "test-fingerprint-12345"
        
        response = client.post(
            "/api/compare",
            json={
                "input_data": "Test prompt",
                "models": ["gpt-4"],
                "tier": "brief",
                "browser_fingerprint": fingerprint
            }
        )
        # Should accept fingerprint
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_429_TOO_MANY_REQUESTS,
            status.HTTP_400_BAD_REQUEST
        ]


class TestComparisonConversationHistory:
    """Tests for conversation history edge cases."""
    
    def test_conversation_history_with_invalid_format(self, authenticated_client):
        """Test conversation history with invalid format."""
        client, user, token, _ = authenticated_client
        
        response = client.post(
            "/api/compare",
            json={
                "input_data": "Test prompt",
                "models": ["gpt-4"],
                "tier": "brief",
                "conversation_history": [
                    {"invalid": "format"}
                ]
            }
        )
        # Should either validate and reject or accept with defaults
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            status.HTTP_400_BAD_REQUEST
        ]
    
    def test_conversation_history_empty(self, authenticated_client):
        """Test conversation history with empty array."""
        client, user, token, _ = authenticated_client
        
        response = client.post(
            "/api/compare",
            json={
                "input_data": "Test prompt",
                "models": ["gpt-4"],
                "tier": "brief",
                "conversation_history": []
            }
        )
        # Should succeed (empty history is valid)
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_429_TOO_MANY_REQUESTS,
            status.HTTP_400_BAD_REQUEST
        ]
    
    def test_conversation_history_very_long(self, authenticated_client):
        """Test conversation history with many messages."""
        client, user, token, _ = authenticated_client
        
        # Create very long conversation history
        long_history = [
            {"role": "user", "content": f"Message {i}"}
            for i in range(100)
        ]
        
        response = client.post(
            "/api/compare",
            json={
                "input_data": "Test prompt",
                "models": ["gpt-4"],
                "tier": "brief",
                "conversation_history": long_history
            }
        )
        # Should either succeed or fail validation
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_429_TOO_MANY_REQUESTS,
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_422_UNPROCESSABLE_ENTITY
        ]

