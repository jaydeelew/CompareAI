/**
 * User Menu Component
 * Displays user info and dropdown menu when authenticated
 */

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './UserMenu.css';

type ModalType = 'dashboard' | 'settings' | 'upgrade' | null;

export const UserMenu: React.FC = () => {
    const { user, logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [activeModal, setActiveModal] = useState<ModalType>(null);
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

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (activeModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [activeModal]);

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

    const handleMenuItemClick = (modalType: ModalType) => {
        setActiveModal(modalType);
        setIsOpen(false);
    };

    const closeModal = () => {
        setActiveModal(null);
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
                        <button
                            className="menu-item"
                            onClick={() => handleMenuItemClick('dashboard')}
                        >
                            <span className="menu-icon">📊</span>
                            Dashboard
                        </button>
                        <button
                            className="menu-item"
                            onClick={() => handleMenuItemClick('upgrade')}
                        >
                            <span className="menu-icon">💳</span>
                            Upgrade Plan
                        </button>
                        <button
                            className="menu-item"
                            onClick={() => handleMenuItemClick('settings')}
                        >
                            <span className="menu-icon">⚙️</span>
                            Settings
                        </button>
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

            {/* Modals */}
            {activeModal === 'dashboard' && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content coming-soon-modal" onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close" onClick={closeModal} aria-label="Close modal">
                            ×
                        </button>
                        <div className="modal-icon">📊</div>
                        <h2 className="modal-title">Dashboard</h2>
                        <p className="modal-description">
                            The Dashboard feature is coming soon! Track your usage analytics, view comparison history, and gain insights into your AI model evaluations all in one place.
                        </p>
                        <button className="modal-button-primary" onClick={closeModal}>
                            Got it
                        </button>
                    </div>
                </div>
            )}

            {activeModal === 'settings' && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content coming-soon-modal" onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close" onClick={closeModal} aria-label="Close modal">
                            ×
                        </button>
                        <div className="modal-icon">⚙️</div>
                        <h2 className="modal-title">Settings</h2>
                        <p className="modal-description">
                            The Settings feature is coming soon! Customize your experience, manage your account preferences, and configure notifications to suit your workflow.
                        </p>
                        <button className="modal-button-primary" onClick={closeModal}>
                            Got it
                        </button>
                    </div>
                </div>
            )}

            {activeModal === 'upgrade' && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content upgrade-modal" onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close" onClick={closeModal} aria-label="Close modal">
                            ×
                        </button>
                        <div className="upgrade-modal-header">
                            <h2 className="modal-title">Upgrade Your Plan</h2>
                            <p className="modal-subtitle">Choose the plan that best fits your needs</p>
                        </div>

                        <div className="pricing-tiers">
                            <div className="pricing-tier tier-starter">
                                <div className="tier-header">
                                    <h3 className="tier-name">Starter</h3>
                                    <div className="tier-badge tier-badge-starter">POPULAR</div>
                                </div>
                                <div className="tier-features">
                                    <div className="feature-item">
                                        <span className="feature-icon">✓</span>
                                        <span className="feature-text"><strong>25 comparisons</strong> per day</span>
                                    </div>
                                    <div className="feature-item">
                                        <span className="feature-icon">✓</span>
                                        <span className="feature-text">Compare up to <strong>6 models</strong> simultaneously</span>
                                    </div>
                                    <div className="feature-item">
                                        <span className="feature-icon">✓</span>
                                        <span className="feature-text">Expedited email support (<strong>48-hour</strong> max response)</span>
                                    </div>
                                    <div className="feature-item">
                                        <span className="feature-icon">✓</span>
                                        <span className="feature-text"><strong>30 days</strong> chat history retention</span>
                                    </div>
                                </div>
                            </div>

                            <div className="pricing-tier tier-pro">
                                <div className="tier-header">
                                    <h3 className="tier-name">Pro</h3>
                                    <div className="tier-badge tier-badge-pro">BEST VALUE</div>
                                </div>
                                <div className="tier-features">
                                    <div className="feature-item">
                                        <span className="feature-icon">✓</span>
                                        <span className="feature-text"><strong>50 comparisons</strong> per day</span>
                                    </div>
                                    <div className="feature-item">
                                        <span className="feature-icon">✓</span>
                                        <span className="feature-text">Compare up to <strong>9 models</strong> simultaneously</span>
                                    </div>
                                    <div className="feature-item">
                                        <span className="feature-icon">✓</span>
                                        <span className="feature-text">Expedited email support (<strong>24-hour</strong> max response)</span>
                                    </div>
                                    <div className="feature-item">
                                        <span className="feature-icon">✓</span>
                                        <span className="feature-text"><strong>90 days</strong> chat history retention</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="upgrade-modal-footer">
                            <p className="pricing-notice">
                                💡 <strong>Flexible overage pricing:</strong> Need more comparisons? Both paid tiers allow you to exceed your daily limit by paying per additional comparison. Never hit a hard limit again!
                            </p>
                            <p className="pricing-notice" style={{ marginTop: '0.75rem' }}>
                                These paid tiers and pricing will be available soon. We're working hard to bring you the best value and features!
                            </p>
                            <button className="modal-button-primary" onClick={closeModal}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

