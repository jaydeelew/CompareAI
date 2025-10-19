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
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createUserData, setCreateUserData] = useState({
        email: '',
        password: '',
        role: 'user',
        subscription_tier: 'free',
        subscription_period: 'monthly',
        is_active: true,
        is_verified: false
    });

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

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const headers = getAuthHeaders();
            if (!headers.Authorization) {
                throw new Error('No authentication token available');
            }
            
            const response = await fetch('/api/admin/users', {
                method: 'POST',
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(createUserData)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                if (response.status === 401) {
                    throw new Error('Authentication required. Please log in again.');
                } else if (response.status === 403) {
                    throw new Error('Access denied. Admin privileges required.');
                } else if (response.status === 400) {
                    throw new Error(errorData.detail || 'Invalid user data');
                } else {
                    throw new Error(`Failed to create user (${response.status})`);
                }
            }
            
            // Reset form and close modal
            setCreateUserData({
                email: '',
                password: '',
                role: 'user',
                subscription_tier: 'free',
                subscription_period: 'monthly',
                is_active: true,
                is_verified: false
            });
            setShowCreateModal(false);
            
            // Refresh user list
            await fetchUsersInitial(currentPage);
            
            alert('User created successfully!');
        } catch (err) {
            console.error('Error creating user:', err);
            setError(err instanceof Error ? err.message : 'Failed to create user');
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
                        onClick={() => setShowCreateModal(true)}
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

            {/* Create User Modal */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Create New User</h2>
                            <button 
                                className="modal-close-btn"
                                onClick={() => setShowCreateModal(false)}
                            >
                                ×
                            </button>
                        </div>
                        
                        <form onSubmit={handleCreateUser} className="create-user-form">
                            <div className="form-group">
                                <label htmlFor="email">Email Address *</label>
                                <input
                                    id="email"
                                    type="email"
                                    value={createUserData.email}
                                    onChange={(e) => setCreateUserData({...createUserData, email: e.target.value})}
                                    required
                                    placeholder="user@example.com"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="password">Password *</label>
                                <input
                                    id="password"
                                    type="password"
                                    value={createUserData.password}
                                    onChange={(e) => setCreateUserData({...createUserData, password: e.target.value})}
                                    required
                                    minLength={12}
                                    placeholder="Min 12 chars, uppercase, number, special char"
                                />
                                <small className="form-hint">
                                    Must be at least 12 characters with uppercase, lowercase, numbers, and special characters (!@#$%^&*()_+-=[]{};':\"|,.&lt;&gt;/?)
                                </small>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="role">Role *</label>
                                    <select
                                        id="role"
                                        value={createUserData.role}
                                        onChange={(e) => setCreateUserData({...createUserData, role: e.target.value})}
                                        required
                                    >
                                        <option value="user">User</option>
                                        <option value="moderator">Moderator</option>
                                        <option value="admin">Admin</option>
                                        <option value="super_admin">Super Admin</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="subscription_tier">Subscription Tier *</label>
                                    <select
                                        id="subscription_tier"
                                        value={createUserData.subscription_tier}
                                        onChange={(e) => setCreateUserData({...createUserData, subscription_tier: e.target.value})}
                                        required
                                    >
                                        <option value="free">Free</option>
                                        <option value="starter">Starter</option>
                                        <option value="pro">Pro</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="subscription_period">Subscription Period *</label>
                                    <select
                                        id="subscription_period"
                                        value={createUserData.subscription_period}
                                        onChange={(e) => setCreateUserData({...createUserData, subscription_period: e.target.value})}
                                        required
                                    >
                                        <option value="monthly">Monthly</option>
                                        <option value="yearly">Yearly</option>
                                    </select>
                                </div>

                                <div className="form-group checkbox-group">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={createUserData.is_active}
                                            onChange={(e) => setCreateUserData({...createUserData, is_active: e.target.checked})}
                                        />
                                        <span>Active Account</span>
                                    </label>
                                    
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={createUserData.is_verified}
                                            onChange={(e) => setCreateUserData({...createUserData, is_verified: e.target.checked})}
                                        />
                                        <span>Email Verified</span>
                                    </label>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button 
                                    type="button" 
                                    className="cancel-btn"
                                    onClick={() => setShowCreateModal(false)}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="submit-btn"
                                >
                                    Create User
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;
