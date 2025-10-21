/**
 * User Menu Component
 * Displays user info and dropdown menu when authenticated
 */

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './UserMenu.css';

export const UserMenu: React.FC = () => {
    const { user, logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    if (!user) return null;

    const getTierBadgeClass = (tier: string) => {
        switch (tier) {
            case 'pro':
                return 'tier-badge-pro';
            case 'starter':
                return 'tier-badge-starter';
            default:
                return 'tier-badge-free';
        }
    };

    const getTierDisplay = (tier: string) => {
        switch (tier) {
            case 'pro':
                return 'Pro';
            case 'starter':
                return 'Starter';
            default:
                return 'Free';
        }
    };

    return (
        <div className="user-menu" ref={menuRef}>
            <button
                className="user-menu-trigger"
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                aria-haspopup="true"
            >
                <div className="user-avatar">
                    {user.email.charAt(0).toUpperCase()}
                </div>
                <span className="user-menu-caret">▼</span>
            </button>

            {isOpen && (
                <div className="user-menu-dropdown">
                    <div className="user-menu-header">
                        <div className="user-info">
                            <div className="user-email">{user.email}</div>
                            <div className={`tier-badge ${getTierBadgeClass(user.subscription_tier)}`}>
                                {getTierDisplay(user.subscription_tier)}
                            </div>
                        </div>
                    </div>

                    <div className="user-menu-divider"></div>

                    <div className="user-menu-section">
                        <div className="usage-info">
                            <div className="usage-label">Today's Usage</div>
                            <div className="usage-value">
                                {user.daily_usage_count} comparisons
                            </div>
                        </div>
                        {user.monthly_overage_count > 0 && (
                            <div className="usage-info">
                                <div className="usage-label">Monthly Overages</div>
                                <div className="usage-value overage-count">
                                    {user.monthly_overage_count} comparisons
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="user-menu-divider"></div>

                    <nav className="user-menu-nav">
                        <a href="/dashboard" className="menu-item">
                            <span className="menu-icon">📊</span>
                            Dashboard
                        </a>
                        <a href="/pricing" className="menu-item">
                            <span className="menu-icon">💳</span>
                            Upgrade Plan
                        </a>
                        <a href="/settings" className="menu-item">
                            <span className="menu-icon">⚙️</span>
                            Settings
                        </a>
                        <a
                            href="mailto:support@compareintel.com"
                            className="menu-item"
                            onClick={() => {
                                // Don't prevent default - let the browser handle it naturally
                                setIsOpen(false);
                            }}
                        >
                            <span className="menu-icon">📧</span>
                            Contact Support
                        </a>
                    </nav>

                    <div className="user-menu-divider"></div>

                    <button
                        className="menu-item logout-btn"
                        onClick={() => {
                            logout();
                            setIsOpen(false);
                        }}
                    >
                        <span className="menu-icon">🚪</span>
                        Sign Out
                    </button>
                </div>
            )}
        </div>
    );
};

