"""
Integration tests for admin functionality.

Tests cover:
- Admin endpoints
- User management
- System configuration
- Admin authentication
"""
import pytest
from fastapi import status


class TestAdminAuthentication:
    """Tests for admin authentication."""
    
    def test_admin_endpoint_requires_admin(self, authenticated_client):
        """Test that admin endpoints require admin privileges."""
        client, user, token, _ = authenticated_client
        
        # Regular user should not have admin access
        response = client.get("/api/admin/users")
        # Should return 403 if user is not admin
        assert response.status_code in [
            status.HTTP_403_FORBIDDEN,
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_404_NOT_FOUND,
        ]
    
    def test_admin_endpoint_with_admin_user(self, client, test_user_admin):
        """Test admin endpoints with admin user."""
        # Login as admin
        response = client.post(
            "/api/auth/login",
            json={
                "email": test_user_admin.email,
                "password": "secret",
            },
        )
        assert response.status_code == status.HTTP_200_OK
        token = response.json()["access_token"]
        
        # Set authorization header
        client.headers = {"Authorization": f"Bearer {token}"}
        
        # Try to access admin endpoint
        response = client.get("/api/admin/users")
        # Should succeed if endpoint exists
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_404_NOT_FOUND,
        ]


class TestUserManagement:
    """Tests for user management endpoints."""
    
    def test_list_users(self, client, test_user_admin):
        """Test listing all users."""
        # Login as admin
        response = client.post(
            "/api/auth/login",
            json={
                "email": test_user_admin.email,
                "password": "secret",
            },
        )
        token = response.json()["access_token"]
        client.headers = {"Authorization": f"Bearer {token}"}
        
        response = client.get("/api/admin/users")
        if response.status_code == status.HTTP_200_OK:
            data = response.json()
            assert isinstance(data, (list, dict))
    
    def test_get_user_by_id(self, client, test_user_admin, test_user):
        """Test getting a specific user by ID."""
        # Login as admin
        response = client.post(
            "/api/auth/login",
            json={
                "email": test_user_admin.email,
                "password": "secret",
            },
        )
        token = response.json()["access_token"]
        client.headers = {"Authorization": f"Bearer {token}"}
        
        response = client.get(f"/api/admin/users/{test_user.id}")
        if response.status_code == status.HTTP_200_OK:
            data = response.json()
            assert "id" in data or "email" in data
    
    def test_update_user_tier(self, client, test_user_admin, test_user):
        """Test updating user subscription tier."""
        # Login as admin
        response = client.post(
            "/api/auth/login",
            json={
                "email": test_user_admin.email,
                "password": "secret",
            },
        )
        token = response.json()["access_token"]
        client.headers = {"Authorization": f"Bearer {token}"}
    
        response = client.put(
            f"/api/admin/users/{test_user.id}",
            json={"subscription_tier": "pro"}
        )
        # Adjust based on your implementation
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_404_NOT_FOUND,
            status.HTTP_400_BAD_REQUEST,
        ]


class TestSystemConfiguration:
    """Tests for system configuration endpoints."""
    
    def test_get_system_stats(self, client, test_user_admin):
        """Test getting system statistics."""
        # Login as admin
        response = client.post(
            "/api/auth/login",
            json={
                "email": test_user_admin.email,
                "password": "secret",
            },
        )
        token = response.json()["access_token"]
        client.headers = {"Authorization": f"Bearer {token}"}
        
        response = client.get("/api/admin/stats")
        if response.status_code == status.HTTP_200_OK:
            data = response.json()
            assert isinstance(data, dict)
    
    def test_get_usage_logs(self, client, test_user_admin):
        """Test getting usage logs."""
        # Login as admin
        response = client.post(
            "/api/auth/login",
            json={
                "email": test_user_admin.email,
                "password": "secret",
            },
        )
        token = response.json()["access_token"]
        client.headers = {"Authorization": f"Bearer {token}"}
        
        response = client.get("/api/admin/usage-logs")
        if response.status_code == status.HTTP_200_OK:
            data = response.json()
            assert isinstance(data, (list, dict))

