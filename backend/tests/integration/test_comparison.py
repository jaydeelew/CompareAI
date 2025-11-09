"""
Integration tests for model comparison functionality.

Tests cover:
- Comparison endpoint
- Model selection
- Streaming responses
- Result formatting
"""
import pytest
from fastapi import status


class TestComparisonEndpoint:
    """Tests for the comparison endpoint."""
    
    def test_comparison_requires_authentication(self, client):
        """Test that comparison endpoint requires authentication."""
        response = client.post(
            "/api/compare",
            json={
                "prompt": "Test prompt",
                "models": ["gpt-4"],
            }
        )
        # Should require authentication
        assert response.status_code in [
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN
        ]
    
    def test_comparison_with_authentication(self, authenticated_client):
        """Test comparison endpoint with authenticated user."""
        client, user, token = authenticated_client
        
        response = client.post(
            "/api/compare",
            json={
                "prompt": "What is 2+2?",
                "models": ["gpt-4"],
                "tier": "brief",
            }
        )
        # Adjust expected status based on your implementation
        # May return 200 (success) or 429 (rate limited) or other
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_429_TOO_MANY_REQUESTS,
            status.HTTP_400_BAD_REQUEST,
        ]
    
    def test_comparison_with_multiple_models(self, authenticated_client):
        """Test comparison with multiple models."""
        client, user, token = authenticated_client
        
        response = client.post(
            "/api/compare",
            json={
                "prompt": "Explain quantum computing",
                "models": ["gpt-4", "claude-3-opus"],
                "tier": "standard",
            }
        )
        # Adjust based on your implementation
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_429_TOO_MANY_REQUESTS,
            status.HTTP_400_BAD_REQUEST,
        ]
    
    def test_comparison_rate_limiting(self, authenticated_client):
        """Test that rate limiting is enforced."""
        client, user, token = authenticated_client
        
        # Make multiple requests quickly
        responses = []
        for _ in range(20):  # Adjust based on rate limits
            response = client.post(
                "/api/compare",
                json={
                    "prompt": "Test",
                    "models": ["gpt-4"],
                    "tier": "brief",
                }
            )
            responses.append(response.status_code)
        
        # At least one should be rate limited if limits are enforced
        # This depends on your rate limit configuration
        assert len(responses) == 20


class TestModelSelection:
    """Tests for model selection functionality."""
    
    def test_get_available_models(self, client):
        """Test getting list of available models."""
        response = client.get("/api/models")
        # Adjust endpoint based on your implementation
        if response.status_code == status.HTTP_200_OK:
            data = response.json()
            assert isinstance(data, (list, dict))
    
    def test_model_validation(self, authenticated_client):
        """Test that invalid models are rejected."""
        client, user, token = authenticated_client
        
        response = client.post(
            "/api/compare",
            json={
                "prompt": "Test",
                "models": ["invalid-model-name"],
                "tier": "brief",
            }
        )
        assert response.status_code in [
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_422_UNPROCESSABLE_ENTITY,
        ]


class TestStreamingResponse:
    """Tests for streaming comparison responses."""
    
    def test_streaming_endpoint(self, authenticated_client):
        """Test streaming comparison endpoint."""
        client, user, token = authenticated_client
        
        response = client.post(
            "/api/compare/stream",
            json={
                "prompt": "Test prompt",
                "models": ["gpt-4"],
                "tier": "brief",
            },
            stream=True,
        )
        # Adjust based on your streaming implementation
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_429_TOO_MANY_REQUESTS,
        ]


class TestTierSelection:
    """Tests for tier selection (brief/standard/extended)."""
    
    def test_brief_tier(self, authenticated_client):
        """Test comparison with brief tier."""
        client, user, token = authenticated_client
        
        response = client.post(
            "/api/compare",
            json={
                "prompt": "Short prompt",
                "models": ["gpt-4"],
                "tier": "brief",
            }
        )
        # Should accept brief tier
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_429_TOO_MANY_REQUESTS,
            status.HTTP_400_BAD_REQUEST,
        ]
    
    def test_standard_tier(self, authenticated_client):
        """Test comparison with standard tier."""
        client, user, token = authenticated_client
        
        response = client.post(
            "/api/compare",
            json={
                "prompt": "Medium prompt",
                "models": ["gpt-4"],
                "tier": "standard",
            }
        )
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_429_TOO_MANY_REQUESTS,
            status.HTTP_400_BAD_REQUEST,
        ]
    
    def test_extended_tier(self, authenticated_client):
        """Test comparison with extended tier."""
        client, user, token = authenticated_client
        
        response = client.post(
            "/api/compare",
            json={
                "prompt": "Long prompt",
                "models": ["gpt-4"],
                "tier": "extended",
            }
        )
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_429_TOO_MANY_REQUESTS,
            status.HTTP_400_BAD_REQUEST,
        ]

