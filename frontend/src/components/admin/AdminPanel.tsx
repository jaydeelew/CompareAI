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
    mock_mode_enabled: boolean;
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

interface AdminPanelProps {
    onClose?: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
    const { user, refreshUser } = useAuth();
    const getAuthHeaders = useAuthHeaders();
    const [stats, setStats] = useState<AdminStats | null>(null);

    // Helper function to format tier and role names for display
    const formatName = (name: string): string => {
        return name
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };
    const [users, setUsers] = useState<AdminUserListResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRole, setSelectedRole] = useState('');
    const [selectedTier, setSelectedTier] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showSelfDeleteModal, setShowSelfDeleteModal] = useState(false);
    const [showTierChangeModal, setShowTierChangeModal] = useState(false);
    const [userToDelete, setUserToDelete] = useState<{ id: number; email: string } | null>(null);
    const [tierChangeData, setTierChangeData] = useState<{ userId: number; email: string; currentTier: string; newTier: string } | null>(null);
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

            // Refresh both users list and stats
            await Promise.all([fetchUsersInitial(currentPage), fetchStats()]);
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

            // Refresh both users list and stats
            await Promise.all([fetchUsersInitial(currentPage), fetchStats()]);
        } catch (err) {
            console.error('Error sending verification:', err);
            setError(err instanceof Error ? err.message : 'Failed to send verification email');
        }
    };

    const resetUsage = async (userId: number) => {
        try {
            const headers = getAuthHeaders();
            if (!headers.Authorization) {
                throw new Error('No authentication token available');
            }

            const response = await fetch(`/api/admin/users/${userId}/reset-usage`, {
                method: 'POST',
                headers
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Authentication required. Please log in again.');
                } else if (response.status === 403) {
                    throw new Error('Access denied. Admin privileges required.');
                } else {
                    throw new Error(`Failed to reset usage (${response.status})`);
                }
            }

            // Refresh both users list and stats
            await Promise.all([fetchUsersInitial(currentPage), fetchStats()]);

            // If the admin reset their own usage, refresh their user data in AuthContext
            // This ensures the UserMenu dropdown shows the updated count
            if (user && userId === user.id) {
                await refreshUser();
            }
        } catch (err) {
            console.error('Error resetting usage:', err);
            setError(err instanceof Error ? err.message : 'Failed to reset usage');
        }
    };

    const toggleMockMode = async (userId: number) => {
        try {
            const headers = getAuthHeaders();
            if (!headers.Authorization) {
                throw new Error('No authentication token available');
            }

            const response = await fetch(`/api/admin/users/${userId}/toggle-mock-mode`, {
                method: 'POST',
                headers
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Authentication required. Please log in again.');
                } else if (response.status === 403) {
                    throw new Error('Access denied. Admin privileges required.');
                } else if (response.status === 400) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Mock mode can only be enabled for admin/super-admin users');
                } else {
                    throw new Error(`Failed to toggle mock mode (${response.status})`);
                }
            }

            // Refresh both users list and stats
            await Promise.all([fetchUsersInitial(currentPage), fetchStats()]);

            // If toggling own mock mode, refresh user data to update UI
            if (user && userId === user.id) {
                await refreshUser();
            }
        } catch (err) {
            console.error('Error toggling mock mode:', err);
            setError(err instanceof Error ? err.message : 'Failed to toggle mock mode');
        }
    };

    const handleTierChangeClick = (userId: number, email: string, currentTier: string, newTier: string) => {
        if (currentTier === newTier) {
            return; // No change needed
        }
        setTierChangeData({ userId, email, currentTier, newTier });
        setShowTierChangeModal(true);
    };

    const handleTierChangeCancel = () => {
        setShowTierChangeModal(false);
        setTierChangeData(null);
        // Refresh the page to reset the dropdown to the original value
        fetchUsersInitial(currentPage);
    };

    const handleTierChangeConfirm = async () => {
        if (!tierChangeData) return;

        try {
            const headers = getAuthHeaders();
            if (!headers.Authorization) {
                throw new Error('No authentication token available');
            }

            const response = await fetch(`/api/admin/users/${tierChangeData.userId}/change-tier`, {
                method: 'POST',
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ subscription_tier: tierChangeData.newTier })
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Authentication required. Please log in again.');
                } else if (response.status === 403) {
                    throw new Error('Access denied. Super admin privileges required.');
                } else {
                    throw new Error(`Failed to change tier (${response.status})`);
                }
            }

            // Close modal and reset data
            setShowTierChangeModal(false);
            setTierChangeData(null);

            // Refresh both users list and stats
            await Promise.all([fetchUsersInitial(currentPage), fetchStats()]);

            // If the admin changed their own tier, refresh their user data in AuthContext
            if (user && tierChangeData.userId === user.id) {
                await refreshUser();
            }
        } catch (err) {
            console.error('Error changing tier:', err);
            setError(err instanceof Error ? err.message : 'Failed to change tier');
            setShowTierChangeModal(false);
            setTierChangeData(null);
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

            // Refresh both users list and stats
            await Promise.all([fetchUsersInitial(currentPage), fetchStats()]);

            alert('User created successfully!');
        } catch (err) {
            console.error('Error creating user:', err);
            setError(err instanceof Error ? err.message : 'Failed to create user');
        }
    };

    const handleDeleteClick = (userId: number, email: string) => {
        // Check if user is trying to delete themselves
        if (user && user.id === userId) {
            setUserToDelete({ id: userId, email });
            setShowSelfDeleteModal(true);
        } else {
            setUserToDelete({ id: userId, email });
            setShowDeleteModal(true);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!userToDelete) return;

        console.log('Attempting to delete user:', userToDelete);
        console.log('User ID:', userToDelete.id);
        console.log('User Email:', userToDelete.email);

        try {
            const headers = getAuthHeaders();
            console.log('Auth headers:', headers);
            
            if (!headers.Authorization) {
                throw new Error('No authentication token available');
            }

            const deleteUrl = `/api/admin/users/${userToDelete.id}`;
            console.log('Delete URL:', deleteUrl);

            const response = await fetch(deleteUrl, {
                method: 'DELETE',
                headers
            });

            console.log('Delete response status:', response.status);
            console.log('Delete response ok:', response.ok);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.log('Error response data:', errorData);
                console.log('Error status:', response.status);
                
                if (response.status === 401) {
                    throw new Error('Authentication required. Please log in again.');
                } else if (response.status === 403) {
                    throw new Error('Access denied. Super Admin privileges required to delete users.');
                } else if (response.status === 400) {
                    throw new Error(errorData.detail || 'Cannot delete user');
                } else if (response.status === 404) {
                    throw new Error('User not found');
                } else {
                    throw new Error(`Failed to delete user (${response.status})`);
                }
            }

            // Close modal and reset state
            setShowDeleteModal(false);
            setUserToDelete(null);

            // Refresh both users list and stats
            await Promise.all([fetchUsersInitial(currentPage), fetchStats()]);

            alert('User deleted successfully!');
        } catch (err) {
            console.error('Error deleting user:', err);
            setError(err instanceof Error ? err.message : 'Failed to delete user');
            setShowDeleteModal(false);
            setUserToDelete(null);
        }
    };

    const handleDeleteCancel = () => {
        setShowDeleteModal(false);
        setUserToDelete(null);
    };

    const handleSelfDeleteCancel = () => {
        setShowSelfDeleteModal(false);
        setUserToDelete(null);
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
                    {onClose && (
                        <button className="back-button" onClick={onClose} title="Back to Main App">
                            ↪
                        </button>
                    )}
                    <div className="admin-title-section">
                        <h1>Admin Panel</h1>
                        <p>Manage users and monitor system activity</p>
                    </div>
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
                                        <span className="tier-name">{formatName(tier)}</span>
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
                                        <span className="role-name">{formatName(role)}</span>
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
                            <option value="starter_plus">Starter+</option>
                            <option value="pro">Pro</option>
                            <option value="pro_plus">Pro+</option>
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
                                {users.users.map((userRow) => (
                                    <tr key={userRow.id}>
                                        <td>{userRow.email}</td>
                                        <td>
                                            <span className={`role-badge role-${userRow.role}`}>
                                                {userRow.role}
                                            </span>
                                        </td>
                                        <td>
                                            {user?.role === 'super_admin' ? (
                                                <select
                                                    value={userRow.subscription_tier}
                                                    onChange={(e) => handleTierChangeClick(userRow.id, userRow.email, userRow.subscription_tier, e.target.value)}
                                                    className="tier-select"
                                                    title="Change subscription tier (Super Admin only)"
                                                >
                                                    <option value="free">Free</option>
                                                    <option value="starter">Starter</option>
                                                    <option value="starter_plus">Starter+</option>
                                                    <option value="pro">Pro</option>
                                                    <option value="pro_plus">Pro+</option>
                                                </select>
                                            ) : (
                                                <span className={`tier-badge tier-${userRow.subscription_tier}`}>
                                                    {userRow.subscription_tier}
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <span className={`status-badge ${userRow.is_active ? 'active' : 'inactive'}`}>
                                                {userRow.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`verified-badge ${userRow.is_verified ? 'verified' : 'unverified'}`}>
                                                {userRow.is_verified ? '✓' : '✗'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="usage-info">
                                                <span className="usage-count">{userRow.daily_usage_count} today</span>
                                                {userRow.monthly_overage_count > 0 && (
                                                    <span className="overage-count">
                                                        {userRow.monthly_overage_count} overages
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <span title={new Date(userRow.created_at).toLocaleString()}>
                                                {(() => {
                                                    const date = new Date(userRow.created_at);
                                                    const month = String(date.getMonth() + 1).padStart(2, '0');
                                                    const day = String(date.getDate()).padStart(2, '0');
                                                    const year = date.getFullYear();
                                                    return `${month}/${day}/${year}`;
                                                })()}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <button
                                                    onClick={() => toggleUserActive(userRow.id)}
                                                    className={`toggle-btn ${userRow.is_active ? 'deactivate' : 'activate'}`}
                                                >
                                                    {userRow.is_active ? 'Deactivate' : 'Activate'}
                                                </button>
                                                {!userRow.is_verified && (
                                                    <button
                                                        onClick={() => sendVerification(userRow.id)}
                                                        className="verify-btn"
                                                    >
                                                        Send Verification
                                                    </button>
                                                )}
                                                {userRow.daily_usage_count > 0 && (
                                                    <button
                                                        onClick={() => resetUsage(userRow.id)}
                                                        className="reset-usage-btn"
                                                        title="Reset daily usage to 0"
                                                    >
                                                        Zero Usage
                                                    </button>
                                                )}
                                                {/* Mock mode toggle - available for any user in development mode, admin/super-admin in production */}
                                                {(import.meta.env.DEV || userRow.role === 'admin' || userRow.role === 'super_admin') && (
                                                    <button
                                                        onClick={() => toggleMockMode(userRow.id)}
                                                        className={`mock-mode-btn ${userRow.mock_mode_enabled ? 'enabled' : 'disabled'}`}
                                                        title={`Mock mode is ${userRow.mock_mode_enabled ? 'enabled' : 'disabled'} - ${userRow.mock_mode_enabled ? 'Using mock responses' : 'Using real API calls'}${import.meta.env.DEV ? ' (Dev Mode)' : ''}`}
                                                    >
                                                        🎭 {userRow.mock_mode_enabled ? 'Mock ON' : 'Mock OFF'}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDeleteClick(userRow.id, userRow.email)}
                                                    className="delete-btn"
                                                    title="Delete user (Super Admin only)"
                                                >
                                                    Delete
                                                </button>
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

            {/* Delete Confirmation Modal */}
            {showDeleteModal && userToDelete && (
                <div className="modal-overlay" onClick={handleDeleteCancel}>
                    <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>⚠️ Confirm Delete</h2>
                            <button
                                className="modal-close-btn"
                                onClick={handleDeleteCancel}
                            >
                                ×
                            </button>
                        </div>

                        <div className="delete-modal-body">
                            <p className="warning-text">
                                Are you sure you want to delete this user? This action cannot be undone.
                            </p>
                            <div className="user-to-delete">
                                <strong>Email:</strong> {userToDelete.email}
                            </div>
                            <p className="delete-note">
                                <strong>Note:</strong> Only Super Admins can delete users. All user data, history, and associations will be permanently removed.
                            </p>
                        </div>

                        <div className="modal-footer">
                            <button
                                type="button"
                                className="cancel-btn"
                                onClick={handleDeleteCancel}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="delete-confirm-btn"
                                onClick={handleDeleteConfirm}
                            >
                                Delete User
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Self-Deletion Warning Modal */}
            {showSelfDeleteModal && userToDelete && (
                <div className="modal-overlay" onClick={handleSelfDeleteCancel}>
                    <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>🚫 Cannot Delete Self</h2>
                            <button
                                className="modal-close-btn"
                                onClick={handleSelfDeleteCancel}
                            >
                                ×
                            </button>
                        </div>

                        <div className="delete-modal-body">
                            <p className="warning-text">
                                You cannot delete your own account. This action is not allowed for security reasons.
                            </p>
                            <div className="user-to-delete">
                                <strong>Email:</strong> {userToDelete.email}
                            </div>
                            <p className="delete-note">
                                <strong>Note:</strong> Super Admins cannot delete themselves. If you need to delete your account, please contact another Super Admin or use the account deletion feature in your profile settings.
                            </p>
                        </div>

                        <div className="modal-footer">
                            <button
                                type="button"
                                className="cancel-btn"
                                onClick={handleSelfDeleteCancel}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Tier Change Confirmation Modal */}
            {showTierChangeModal && tierChangeData && (
                <div className="modal-overlay" onClick={handleTierChangeCancel}>
                    <div className="modal-content tier-change-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>⚠️ Confirm Tier Change</h2>
                            <button
                                className="modal-close-btn"
                                onClick={handleTierChangeCancel}
                            >
                                ×
                            </button>
                        </div>

                        <div className="tier-change-modal-body">
                            <p className="warning-text">
                                You are about to change the subscription tier for this user. Please review the details below and confirm.
                            </p>
                            <div className="tier-change-details">
                                <div className="tier-change-row">
                                    <strong>User:</strong> {tierChangeData.email}
                                </div>
                                <div className="tier-change-row">
                                    <strong>Current Tier:</strong>
                                    <span className={`tier-badge tier-${tierChangeData.currentTier}`}>
                                        {tierChangeData.currentTier}
                                    </span>
                                </div>
                                <div className="tier-change-row">
                                    <strong>New Tier:</strong>
                                    <span className={`tier-badge tier-${tierChangeData.newTier}`}>
                                        {tierChangeData.newTier}
                                    </span>
                                </div>
                            </div>
                            <p className="tier-change-note">
                                <strong>⚠️ Warning:</strong> This will immediately change the user's subscription tier and may affect their access limits, features, and billing. This action will be logged in the admin audit trail.
                            </p>
                        </div>

                        <div className="modal-footer">
                            <button
                                type="button"
                                className="cancel-btn"
                                onClick={handleTierChangeCancel}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="tier-change-confirm-btn"
                                onClick={handleTierChangeConfirm}
                            >
                                Confirm Tier Change
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                                    onChange={(e) => setCreateUserData({ ...createUserData, email: e.target.value })}
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
                                    onChange={(e) => setCreateUserData({ ...createUserData, password: e.target.value })}
                                    required
                                    minLength={12}
                                    placeholder="Min 12 chars, uppercase, number, special char"
                                />
                                <small className="form-hint">
                                    Must be at least 12 characters with uppercase, lowercase, numbers, and special characters (!@#$%^&*()_+-=[]{ };':\"|,.&lt;&gt;/?)
                                </small>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="role">Role *</label>
                                    <select
                                        id="role"
                                        value={createUserData.role}
                                        onChange={(e) => setCreateUserData({ ...createUserData, role: e.target.value })}
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
                                        onChange={(e) => setCreateUserData({ ...createUserData, subscription_tier: e.target.value })}
                                        required
                                    >
                                        <option value="free">Free</option>
                                        <option value="starter">Starter</option>
                                        <option value="starter_plus">Starter+</option>
                                        <option value="pro">Pro</option>
                                        <option value="pro_plus">Pro+</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="subscription_period">Subscription Period *</label>
                                    <select
                                        id="subscription_period"
                                        value={createUserData.subscription_period}
                                        onChange={(e) => setCreateUserData({ ...createUserData, subscription_period: e.target.value })}
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
                                            onChange={(e) => setCreateUserData({ ...createUserData, is_active: e.target.checked })}
                                        />
                                        <span>Active Account</span>
                                    </label>

                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={createUserData.is_verified}
                                            onChange={(e) => setCreateUserData({ ...createUserData, is_verified: e.target.checked })}
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
