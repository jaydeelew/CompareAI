import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

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
    const { user, getAuthHeaders } = useAuth();
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [users, setUsers] = useState<AdminUserListResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRole, setSelectedRole] = useState('');
    const [selectedTier, setSelectedTier] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);

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

    const fetchStats = async () => {
        try {
            const response = await fetch('/api/admin/stats', {
                headers: getAuthHeaders()
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch admin stats');
            }
            
            const data = await response.json();
            setStats(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch stats');
        }
    };

    const fetchUsers = async (page = 1) => {
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                per_page: '20'
            });
            
            if (searchTerm) params.append('search', searchTerm);
            if (selectedRole) params.append('role', selectedRole);
            if (selectedTier) params.append('tier', selectedTier);
            
            const response = await fetch(`/api/admin/users?${params}`, {
                headers: getAuthHeaders()
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch users');
            }
            
            const data = await response.json();
            setUsers(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch users');
        }
    };

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            await Promise.all([fetchStats(), fetchUsers(currentPage)]);
            setLoading(false);
        };
        
        loadData();
    }, [currentPage, searchTerm, selectedRole, selectedTier]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setCurrentPage(1);
        fetchUsers(1);
    };

    const toggleUserActive = async (userId: number) => {
        try {
            const response = await fetch(`/api/admin/users/${userId}/toggle-active`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            
            if (!response.ok) {
                throw new Error('Failed to toggle user status');
            }
            
            // Refresh users list
            fetchUsers(currentPage);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to toggle user status');
        }
    };

    const sendVerification = async (userId: number) => {
        try {
            const response = await fetch(`/api/admin/users/${userId}/send-verification`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            
            if (!response.ok) {
                throw new Error('Failed to send verification email');
            }
            
            alert('Verification email sent successfully');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send verification email');
        }
    };

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
                <h1>Admin Panel</h1>
                <p>Manage users and monitor system activity</p>
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
                <form className="search-form" onSubmit={handleSearch}>
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
                        
                        <button type="submit" className="search-btn">Search</button>
                    </div>
                </form>

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
                                                <span>{user.daily_usage_count} today</span>
                                                {user.monthly_overage_count > 0 && (
                                                    <span className="overage-count">
                                                        {user.monthly_overage_count} overages
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td>{new Date(user.created_at).toLocaleDateString()}</td>
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
