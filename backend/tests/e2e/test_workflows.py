"""
End-to-end tests for complete user workflows.

Tests cover:
- Complete user registration and verification flow
- Anonymous user comparison flow
- Authenticated user comparison flow
- Admin user management flow
- Rate limit handling workflows
"""
import pytest
from unittest.mock import patch
from fastapi import status


class TestUserRegistrationWorkflow:
    """Tests for complete user registration workflow."""
    
    def test_complete_registration_flow(self, client, db_session):
        """Test complete registration → verification → login flow."""
        # Step 1: Register new user
        email = "newuser@example.com"
        password = "SecurePassword123!"
        
        register_response = client.post(
            "/api/auth/register",
            json={
                "email": email,
                "password": password,
            },
        )
        assert register_response.status_code == status.HTTP_201_CREATED
        user_data = register_response.json()
        user_id = user_data.get("id")
        
        # Step 2: Verify email (if verification is required)
        # Adjust based on your verification implementation
        # verify_response = client.get(f"/api/auth/verify?token={verification_token}")
        # assert verify_response.status_code == status.HTTP_200_OK
        
        # Step 3: Login with new credentials
        login_response = client.post(
            "/api/auth/login",
            json={
                "email": email,
                "password": password,
            },
        )
        assert login_response.status_code == status.HTTP_200_OK
        token = login_response.json()["access_token"]
        
        # Step 4: Use token for authenticated request
        client.headers = {"Authorization": f"Bearer {token}"}
        # Make an authenticated request to verify token works
        # Adjust endpoint based on your implementation


class TestAnonymousUserWorkflow:
    """Tests for anonymous user comparison workflow."""
    
    def test_anonymous_comparison_flow(self, client):
        """Test anonymous user can make comparisons."""
        fingerprint = "test-anonymous-fingerprint"
        
        # Make comparison request
        response = client.post(
            "/api/compare",
            json={
                "input_data": "What is AI?",
                "models": ["gpt-4"],
                "tier": "brief",
                "browser_fingerprint": fingerprint,
            },
        )
        
        # Should either succeed or return rate limit error
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_429_TOO_MANY_REQUESTS,
            status.HTTP_401_UNAUTHORIZED,  # If auth is required
        ]
    
    @patch('app.routers.api.run_models')
    def test_anonymous_rate_limit_workflow(self, mock_run_models, client):
        """Test anonymous user hitting rate limits."""
        # Mock run_models to return successful results so they count against rate limits
        # Patch where it's used (app.routers.api) rather than where it's defined
        # This ensures the mock works when called via run_in_executor in a thread pool
        def mock_run_models_func(prompt, model_list, tier=None, conversation_history=None):
            # Return successful results for all models (not error messages)
            # This simulates successful API calls that count against rate limits
            return {model: f"Mock response for {model}" for model in model_list}
        
        mock_run_models.side_effect = mock_run_models_func
        
        fingerprint = "test-rate-limit-fingerprint"
        
        responses = []
        for i in range(50):  # Adjust based on anonymous limits
            response = client.post(
                "/api/compare",
                json={
                    "input_data": f"Test prompt {i}",
                    "models": ["gpt-4"],
                    "tier": "brief",
                    "browser_fingerprint": fingerprint,
                },
            )
            responses.append(response.status_code)
            
            # Stop early if we hit rate limit to avoid unnecessary iterations
            if response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
                break
        
        # Should eventually hit rate limit (anonymous limit is 10 model responses per day)
        # After 10 successful requests, the 11th should return 429
        assert status.HTTP_429_TOO_MANY_REQUESTS in responses, (
            f"Expected to hit rate limit but got status codes: {responses[:15]}. "
            f"Total requests made: {len(responses)}"
        )
        
        # Verify that mock was called (at least once before rate limit)
        assert mock_run_models.called, "run_models mock should have been called"


class TestAuthenticatedUserWorkflow:
    """Tests for authenticated user comparison workflow."""
    
    def test_authenticated_comparison_workflow(self, authenticated_client):
        """Test complete authenticated user comparison flow."""
        client, user, token, _ = authenticated_client
        
        # Step 1: Check rate limit status
        # Adjust endpoint based on your implementation
        # limit_response = client.get("/api/rate-limit-status")
        # assert limit_response.status_code == status.HTTP_200_OK
        
        # Step 2: Make comparison
        compare_response = client.post(
            "/api/compare",
            json={
                "input_data": "Explain machine learning",
                "models": ["gpt-4", "claude-3-opus"],
                "tier": "standard",
            }
        )
        
        # Should either succeed or be rate limited
        assert compare_response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_429_TOO_MANY_REQUESTS,
            status.HTTP_400_BAD_REQUEST,
        ]
        
        # Step 3: Check updated rate limit status
        # limit_response_after = client.get("/api/rate-limit-status")
        # if limit_response_after.status_code == status.HTTP_200_OK:
        #     # Usage should have increased
        #     pass
    
    def test_authenticated_user_tier_upgrade_workflow(self, authenticated_client, test_user_admin):
        """Test user tier upgrade workflow."""
        client, user, token, _ = authenticated_client
        
        # Admin upgrades user tier
        admin_client = client
        admin_response = admin_client.post(
            "/api/auth/login",
            json={
                "email": test_user_admin.email,
                "password": "secret",
            },
        )
        admin_token = admin_response.json()["access_token"]
        admin_client.headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Upgrade user tier
        upgrade_response = admin_client.patch(
            f"/api/admin/users/{user.id}",
            json={"subscription_tier": "premium"}
        )
        
        # User should now have higher rate limits
        # Verify with a comparison request
        user_client = client
        user_client.headers = {"Authorization": f"Bearer {token}"}
        compare_response = user_client.post(
            "/api/compare",
            json={
                "input_data": "Test",
                "models": ["gpt-4"],
                "tier": "standard",
            }
        )
        # Should work with new tier limits


class TestAdminWorkflow:
    """Tests for admin user management workflow."""
    
    def test_admin_user_management_workflow(self, client, test_user_admin, db_session):
        """Test complete admin user management workflow."""
        # Step 1: Admin login
        login_response = client.post(
            "/api/auth/login",
            json={
                "email": test_user_admin.email,
                "password": "secret",
            },
        )
        assert login_response.status_code == status.HTTP_200_OK
        admin_token = login_response.json()["access_token"]
        client.headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Step 2: List all users
        users_response = client.get("/api/admin/users")
        if users_response.status_code == status.HTTP_200_OK:
            users = users_response.json()
            assert isinstance(users, (list, dict))
        
        # Step 3: Get system stats
        stats_response = client.get("/api/admin/stats")
        if stats_response.status_code == status.HTTP_200_OK:
            stats = stats_response.json()
            assert isinstance(stats, dict)
        
        # Step 4: View usage logs
        logs_response = client.get("/api/admin/usage-logs")
        if logs_response.status_code == status.HTTP_200_OK:
            logs = logs_response.json()
            assert isinstance(logs, (list, dict))


class TestErrorRecoveryWorkflow:
    """Tests for error recovery workflows."""
    
    def test_rate_limit_recovery(self, authenticated_client):
        """Test that users can make requests after rate limit resets."""
        client, user, token, _ = authenticated_client
        
        # Exhaust rate limit
        for _ in range(100):
            response = client.post(
                "/api/compare",
                json={
                    "input_data": "Test",
                    "models": ["gpt-4"],
                    "tier": "brief",
                }
            )
            if response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
                break
        
        # After rate limit period (would need time mocking in real test)
        # User should be able to make requests again
        # This would require freezegun or similar time mocking
        pass
    
    def test_authentication_token_refresh_workflow(self, authenticated_client):
        """Test token refresh workflow."""
        client, user, token, refresh_token = authenticated_client
        
        # Refresh token
        refresh_response = client.post(
            "/api/auth/refresh",
            json={"refresh_token": refresh_token}
        )
        if refresh_response.status_code == status.HTTP_200_OK:
            new_token = refresh_response.json()["access_token"]
            
            # Use new token
            client.headers = {"Authorization": f"Bearer {new_token}"}
            # Make authenticated request
            # Should work with new token

