import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, useAuthHeaders } from '../../contexts/AuthContext';
import './AdminPanel.css';

interface AdminUser {
    id: number;
    email: string;
    is_verified: boolean;
    is_active: boolean;
    role: string;
    is_admin: boolean;
    subscription_tier: string;
    subscription_status: string;
    subscription_period: string;
    daily_usage_count: number;
    monthly_overage_count: number;
    created_at: string;
    updated_at: string;
}

interface AdminStats {
    total_users: number;
    active_users: number;
    verified_users: number;
    users_by_tier: { [key: string]: number };
    users_by_role: { [key: string]: number };
    recent_registrations: number;
    total_usage_today: number;
    admin_actions_today: number;
}

interface AdminUserListResponse {
    users: AdminUser[];
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
}

const AdminPanel: React.FC = () => {
    const { user } = useAuth();
    const getAuthHeaders = useAuthHeaders();
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [users, setUsers] = useState<AdminUserListResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRole, setSelectedRole] = useState('');
    const [selectedTier, setSelectedTier] = useState('');

    const fetchStats = useCallback(async () => {
        try {
            const headers = getAuthHeaders();
            if (!headers.Authorization) {
                throw new Error('No authentication token available');
            }
            
            const response = await fetch('/api/admin/stats', {
                headers
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Authentication required. Please log in again.');
                } else if (response.status === 403) {
                    throw new Error('Access denied. Admin privileges required.');
                } else {
                    throw new Error(`Failed to fetch admin stats (${response.status})`);
                }
            }
            
            const data = await response.json();
            setStats(data);
        } catch (err) {
            console.error('Error fetching admin stats:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch stats');
        }
    }, [getAuthHeaders]);

    const fetchUsersInitial = useCallback(async (page = 1) => {
        try {
            const headers = getAuthHeaders();
            if (!headers.Authorization) {
                throw new Error('No authentication token available');
            }
            
            const params = new URLSearchParams({
                page: page.toString(),
                per_page: '20'
            });
            
            const response = await fetch(`/api/admin/users?${params}`, {
                headers
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Authentication required. Please log in again.');
                } else if (response.status === 403) {
                    throw new Error('Access denied. Admin privileges required.');
                } else {
                    throw new Error(`Failed to fetch users (${response.status})`);
                }
            }
            
            const data = await response.json();
            setUsers(data);
        } catch (err) {
            console.error('Error fetching users:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch users');
        }
    }, [getAuthHeaders]);

    useEffect(() => {
        const loadData = async () => {
            // Only load data if user is properly authenticated and is admin
            if (!user?.is_admin) {
                setLoading(false);
                return;
            }
            
            setLoading(true);
            setError(null); // Clear any previous errors
            
            try {
                await Promise.all([fetchStats(), fetchUsersInitial(currentPage)]);
            } catch (err) {
                console.error('Error loading admin data:', err);
            } finally {
                setLoading(false);
            }
        };
        
        loadData();
    }, [currentPage, user?.is_admin, fetchStats, fetchUsersInitial]);

    const handleManualSearch = async () => {
        try {
            const headers = getAuthHeaders();
            if (!headers.Authorization) {
                throw new Error('No authentication token available');
            }
            
            const params = new URLSearchParams({
                page: '1',
                per_page: '20'
            });
            
            if (searchTerm) params.append('search', searchTerm);
            if (selectedRole) params.append('role', selectedRole);
            if (selectedTier) params.append('tier', selectedTier);
            
            const response = await fetch(`/api/admin/users?${params}`, {
                headers
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Authentication required. Please log in again.');
                } else if (response.status === 403) {
                    throw new Error('Access denied. Admin privileges required.');
                } else {
                    throw new Error(`Failed to fetch users (${response.status})`);
                }
            }
            
            const data = await response.json();
            setUsers(data);
            setCurrentPage(1);
        } catch (err) {
            console.error('Error searching users:', err);
            setError(err instanceof Error ? err.message : 'Failed to search users');
        }
    };

    const toggleUserActive = async (userId: number) => {
        try {
            const headers = getAuthHeaders();
            if (!headers.Authorization) {
                throw new Error('No authentication token available');
            }
            
            const response = await fetch(`/api/admin/users/${userId}/toggle-active`, {
                method: 'POST',
                headers
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Authentication required. Please log in again.');
                } else if (response.status === 403) {
                    throw new Error('Access denied. Admin privileges required.');
                } else {
                    throw new Error(`Failed to toggle user status (${response.status})`);
                }
            }
            
            // Refresh users list
            await fetchUsersInitial(currentPage);
        } catch (err) {
            console.error('Error toggling user status:', err);
            setError(err instanceof Error ? err.message : 'Failed to toggle user status');
        }
    };

    const sendVerification = async (userId: number) => {
        try {
            const headers = getAuthHeaders();
            if (!headers.Authorization) {
                throw new Error('No authentication token available');
            }
            
            const response = await fetch(`/api/admin/users/${userId}/send-verification`, {
                method: 'POST',
                headers
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Authentication required. Please log in again.');
                } else if (response.status === 403) {
                    throw new Error('Access denied. Admin privileges required.');
                } else {
                    throw new Error(`Failed to send verification email (${response.status})`);
                }
            }
            
            alert('Verification email sent successfully');
        } catch (err) {
            console.error('Error sending verification:', err);
            setError(err instanceof Error ? err.message : 'Failed to send verification email');
        }
    };

    // Check if user is admin
    if (!user?.is_admin) {
        return (
            <div className="admin-panel">
                <div className="error-message">
                    <h2>Access Denied</h2>
                    <p>You need admin privileges to access this panel.</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="admin-panel">
                <div className="loading-message">Loading admin panel...</div>
            </div>
        );
    }

    return (
        <div className="admin-panel">
            <div className="admin-header">
                <div className="admin-header-content">
                    <div className="admin-title-section">
                        <h1>Admin Panel</h1>
                        <p>Manage users and monitor system activity</p>
                    </div>
                    <a href="/" className="back-to-app-btn">
                        ← Back to App
                    </a>
                </div>
            </div>

            {error && (
                <div className="error-message">
                    <h3>Error</h3>
                    <p>{error}</p>
                    <button onClick={() => setError(null)}>Dismiss</button>
                </div>
            )}

            {/* Stats Dashboard */}
            {stats && (
                <div className="admin-stats">
                    <h2>System Statistics</h2>
                    <div className="stats-grid">
                        <div className="stat-card">
                            <h3>Total Users</h3>
                            <p className="stat-number">{stats.total_users}</p>
                        </div>
                        <div className="stat-card">
                            <h3>Active Users</h3>
                            <p className="stat-number">{stats.active_users}</p>
                        </div>
                        <div className="stat-card">
                            <h3>Verified Users</h3>
                            <p className="stat-number">{stats.verified_users}</p>
                        </div>
                        <div className="stat-card">
                            <h3>Recent Registrations</h3>
                            <p className="stat-number">{stats.recent_registrations}</p>
                            <p className="stat-label">Last 7 days</p>
                        </div>
                    </div>

                    <div className="stats-breakdown">
                        <div className="breakdown-section">
                            <h3>Users by Subscription Tier</h3>
                            <div className="breakdown-list">
                                {Object.entries(stats.users_by_tier).map(([tier, count]) => (
                                    <div key={tier} className="breakdown-item">
                                        <span className="tier-name">{tier}</span>
                                        <span className="tier-count">{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="breakdown-section">
                            <h3>Users by Role</h3>
                            <div className="breakdown-list">
                                {Object.entries(stats.users_by_role).map(([role, count]) => (
                                    <div key={role} className="breakdown-item">
                                        <span className="role-name">{role}</span>
                                        <span className="role-count">{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* User Management */}
            <div className="user-management">
                <div className="user-management-header">
                    <h2>User Management</h2>
                    <button 
                        className="create-user-btn"
                        onClick={() => alert('Create User functionality coming soon!')}
                    >
                        Create User
                    </button>
                </div>

                {/* Search and Filters */}
                <div className="search-form">
                    <div className="search-controls">
                        <input
                            type="text"
                            placeholder="Search by email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                        
                        <select
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value)}
                            className="filter-select"
                        >
                            <option value="">All Roles</option>
                            <option value="user">User</option>
                            <option value="moderator">Moderator</option>
                            <option value="admin">Admin</option>
                            <option value="super_admin">Super Admin</option>
                        </select>
                        
                        <select
                            value={selectedTier}
                            onChange={(e) => setSelectedTier(e.target.value)}
                            className="filter-select"
                        >
                            <option value="">All Tiers</option>
                            <option value="free">Free</option>
                            <option value="starter">Starter</option>
                            <option value="pro">Pro</option>
                        </select>
                        
                        <button 
                            type="button"
                            className="search-btn"
                            onClick={handleManualSearch}
                        >
                            Search
                        </button>
                    </div>
                </div>

                {/* Users Table */}
                {users && (
                    <div className="users-table-container">
                        <table className="users-table">
                            <thead>
                                <tr>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Tier</th>
                                    <th>Status</th>
                                    <th>Verified</th>
                                    <th>Usage</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.users.map((user) => (
                                    <tr key={user.id}>
                                        <td>{user.email}</td>
                                        <td>
                                            <span className={`role-badge role-${user.role}`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`tier-badge tier-${user.subscription_tier}`}>
                                                {user.subscription_tier}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                                                {user.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`verified-badge ${user.is_verified ? 'verified' : 'unverified'}`}>
                                                {user.is_verified ? '✓' : '✗'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="usage-info">
                                                <span className="usage-count">{user.daily_usage_count} today</span>
                                                {user.monthly_overage_count > 0 && (
                                                    <span className="overage-count">
                                                        {user.monthly_overage_count} overages
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <span title={new Date(user.created_at).toLocaleString()}>
                                                {new Date(user.created_at).toLocaleDateString()}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <button
                                                    onClick={() => toggleUserActive(user.id)}
                                                    className={`toggle-btn ${user.is_active ? 'deactivate' : 'activate'}`}
                                                >
                                                    {user.is_active ? 'Deactivate' : 'Activate'}
                                                </button>
                                                {!user.is_verified && (
                                                    <button
                                                        onClick={() => sendVerification(user.id)}
                                                        className="verify-btn"
                                                    >
                                                        Send Verification
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Pagination */}
                        {users.total_pages > 1 && (
                            <div className="pagination">
                                <button
                                    onClick={() => setCurrentPage(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="page-btn"
                                >
                                    Previous
                                </button>
                                
                                <span className="page-info">
                                    Page {currentPage} of {users.total_pages}
                                </span>
                                
                                <button
                                    onClick={() => setCurrentPage(currentPage + 1)}
                                    disabled={currentPage === users.total_pages}
                                    className="page-btn"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminPanel;
