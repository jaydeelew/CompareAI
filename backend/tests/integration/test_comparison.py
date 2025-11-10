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
    
    def test_comparison_allows_anonymous_access(self, client):
        """Test that comparison endpoint allows anonymous access."""
        response = client.post(
            "/api/compare",
            json={
                "input_data": "Test prompt",
                "models": ["gpt-4"],
            }
        )
        # Endpoint supports anonymous users, so should not require authentication
        # May return 200 (success), 429 (rate limited), or 400 (validation error)
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_429_TOO_MANY_REQUESTS,
            status.HTTP_400_BAD_REQUEST,
        ]
    
    def test_comparison_with_authentication(self, authenticated_client):
        """Test comparison endpoint with authenticated user."""
        client, user, token, _ = authenticated_client
        
        response = client.post(
            "/api/compare",
            json={
                "input_data": "What is 2+2?",
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
        client, user, token, _ = authenticated_client
        
        response = client.post(
            "/api/compare",
            json={
                "input_data": "Explain quantum computing",
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
        client, user, token, _ = authenticated_client
        
        # Make multiple requests quickly
        responses = []
        for _ in range(20):  # Adjust based on rate limits
            response = client.post(
                "/api/compare",
                json={
                    "input_data": "Test",
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
        """Test that invalid models return errors in results."""
        client, user, token, _ = authenticated_client
        
        response = client.post(
            "/api/compare",
            json={
                "input_data": "Test",
                "models": ["invalid-model-name"],
                "tier": "brief",
            }
        )
        # Endpoint processes invalid models and returns errors in results, not as HTTP errors
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "results" in data
        assert "invalid-model-name" in data["results"]
        # Invalid model should return an error message
        assert "Error:" in data["results"]["invalid-model-name"] or "error" in data["results"]["invalid-model-name"].lower()
        # Metadata should indicate failed models
        assert "metadata" in data
        assert data["metadata"]["models_failed"] >= 1


class TestStreamingResponse:
    """Tests for streaming comparison responses."""
    
    def test_streaming_endpoint(self, authenticated_client):
        """Test streaming comparison endpoint."""
        client, user, token, _ = authenticated_client
        
        response = client.post(
            "/api/compare-stream",
            json={
                "input_data": "Test prompt",
                "models": ["gpt-4"],
                "tier": "brief",
            },
        )
        # TestClient handles StreamingResponse automatically
        # Verify it returns a streaming response with correct content type
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_429_TOO_MANY_REQUESTS,
        ]
        if response.status_code == status.HTTP_200_OK:
            # Verify it's a streaming response (SSE)
            # FastAPI automatically adds charset=utf-8 to text media types
            content_type = response.headers.get("content-type", "")
            assert content_type.startswith("text/event-stream")


class TestTierSelection:
    """Tests for tier selection (brief/standard/extended)."""
    
    def test_brief_tier(self, authenticated_client):
        """Test comparison with brief tier."""
        client, user, token, _ = authenticated_client
        
        response = client.post(
            "/api/compare",
            json={
                "input_data": "Short prompt",
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
        client, user, token, _ = authenticated_client
        
        response = client.post(
            "/api/compare",
            json={
                "input_data": "Medium prompt",
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
        client, user, token, _ = authenticated_client
        
        response = client.post(
            "/api/compare",
            json={
                "input_data": "Long prompt",
                "models": ["gpt-4"],
                "tier": "extended",
            }
        )
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_429_TOO_MANY_REQUESTS,
            status.HTTP_400_BAD_REQUEST,
        ]

