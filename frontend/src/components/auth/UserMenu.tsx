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

    // Extended tier limits per subscription tier
    const getExtendedLimit = (tier: string): number => {
        const limits = {
            free: 5,
            starter: 10,
            starter_plus: 20,
            pro: 40,
            pro_plus: 80
        };
        return limits[tier as keyof typeof limits] || 5;
    };

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
                                {user.daily_usage_count} model responses
                            </div>
                        </div>
                        <div className="usage-info">
                            <div className="usage-label">
                                Extended Interactions
                                <span style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 'normal',
                                    opacity: 0.7,
                                    marginLeft: '0.25rem'
                                }} title="Follow-ups with >10 messages of context (same cost, more capacity). Paid tiers can purchase additional extended interactions.">ℹ️</span>
                            </div>
                            <div className="usage-value">
                                {user.daily_extended_usage || 0} of {getExtendedLimit(user.subscription_tier)} remaining
                            </div>
                        </div>
                        {user.monthly_overage_count > 0 && (
                            <div className="usage-info">
                                <div className="usage-label">Monthly Overages</div>
                                <div className="usage-value overage-count">
                                    {user.monthly_overage_count} model responses
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
                            <p className="modal-subtitle">Get more capacity and compare more models simultaneously</p>
                            <p className="modal-subtitle" style={{ fontSize: '0.9rem', marginTop: '0.5rem', color: '#666' }}>
                                You currently have: <strong>20 model responses per day</strong> • <strong>3 models max</strong> per comparison
                            </p>
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
                                        <span className="feature-text"><strong>50 model responses</strong> per day (2.5x more)</span>
                                    </div>
                                    <div className="feature-item">
                                        <span className="feature-icon">✓</span>
                                        <span className="feature-text">Compare up to <strong>6 models</strong> simultaneously (2x more)</span>
                                    </div>
                                    <div className="feature-item">
                                        <span className="feature-icon">✓</span>
                                        <span className="feature-text">Overage options available</span>
                                    </div>
                                    <div className="feature-item">
                                        <span className="feature-icon">✓</span>
                                        <span className="feature-text">Email support (<strong>48-hour</strong> response)</span>
                                    </div>
                                    <div className="feature-item">
                                        <span className="feature-icon">✓</span>
                                        <span className="feature-text"><strong>30 days</strong> chat history retention</span>
                                    </div>
                                </div>
                            </div>

                            <div className="pricing-tier tier-starter">
                                <div className="tier-header">
                                    <h3 className="tier-name">Starter+</h3>
                                </div>
                                <div className="tier-features">
                                    <div className="feature-item">
                                        <span className="feature-icon">✓</span>
                                        <span className="feature-text"><strong>100 model responses</strong> per day (5x more)</span>
                                    </div>
                                    <div className="feature-item">
                                        <span className="feature-icon">✓</span>
                                        <span className="feature-text">Compare up to <strong>6 models</strong> simultaneously (2x more)</span>
                                    </div>
                                    <div className="feature-item">
                                        <span className="feature-icon">✓</span>
                                        <span className="feature-text">Overage options available</span>
                                    </div>
                                    <div className="feature-item">
                                        <span className="feature-icon">✓</span>
                                        <span className="feature-text">Email support (<strong>48-hour</strong> response)</span>
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
                                        <span className="feature-text"><strong>200 model responses</strong> per day (10x more)</span>
                                    </div>
                                    <div className="feature-item">
                                        <span className="feature-icon">✓</span>
                                        <span className="feature-text">Compare up to <strong>9 models</strong> simultaneously (3x more)</span>
                                    </div>
                                    <div className="feature-item">
                                        <span className="feature-icon">✓</span>
                                        <span className="feature-text">Overage options available</span>
                                    </div>
                                    <div className="feature-item">
                                        <span className="feature-icon">✓</span>
                                        <span className="feature-text">Priority email support (<strong>24-hour</strong> response)</span>
                                    </div>
                                    <div className="feature-item">
                                        <span className="feature-icon">✓</span>
                                        <span className="feature-text"><strong>60 days</strong> chat history retention</span>
                                    </div>
                                </div>
                            </div>

                            <div className="pricing-tier tier-pro">
                                <div className="tier-header">
                                    <h3 className="tier-name">Pro+</h3>
                                </div>
                                <div className="tier-features">
                                    <div className="feature-item">
                                        <span className="feature-icon">✓</span>
                                        <span className="feature-text"><strong>400 model responses</strong> per day (20x more)</span>
                                    </div>
                                    <div className="feature-item">
                                        <span className="feature-icon">✓</span>
                                        <span className="feature-text">Compare up to <strong>9 models</strong> simultaneously (3x more)</span>
                                    </div>
                                    <div className="feature-item">
                                        <span className="feature-icon">✓</span>
                                        <span className="feature-text">Overage options available</span>
                                    </div>
                                    <div className="feature-item">
                                        <span className="feature-icon">✓</span>
                                        <span className="feature-text">Priority email support (<strong>24-hour</strong> response)</span>
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
                                💡 <strong>Model-based pricing:</strong> Each AI model response counts toward your daily limit. Higher tiers give you more daily responses AND let you compare more models at once for deeper analysis!
                            </p>
                            <p className="pricing-notice" style={{ marginTop: '0.75rem' }}>
                                Paid tiers and pricing will be available soon. We're working hard to bring you the best value and features!
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

