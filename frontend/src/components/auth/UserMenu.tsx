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

    // Daily model response limits per subscription tier
    const getDailyLimit = (tier: string): number => {
        const limits = {
            free: 20,
            starter: 50,
            starter_plus: 100,
            pro: 200,
            pro_plus: 400
        };
        return limits[tier as keyof typeof limits] || 20;
    };

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
            case 'pro_plus':
                return 'tier-badge-pro';
            case 'starter':
            case 'starter_plus':
                return 'tier-badge-starter';
            default:
                return 'tier-badge-free';
        }
    };

    const getTierDisplay = (tier: string) => {
        switch (tier) {
            case 'pro':
                return 'Pro';
            case 'pro_plus':
                return 'Pro+';
            case 'starter':
                return 'Starter';
            case 'starter_plus':
                return 'Starter+';
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
                            <div className="user-tier-row">
                                <div className={`tier-badge ${getTierBadgeClass(user.subscription_tier)}`}>
                                    {getTierDisplay(user.subscription_tier)}
                                </div>
                                <div className="daily-limit-info">
                                    {getDailyLimit(user.subscription_tier)}/day
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="user-menu-divider"></div>

                    <div className="usage-section">
                        <div className="usage-header">Usage Today</div>
                        <div className="usage-stats-grid">
                            <div className="usage-stat">
                                <div className="usage-stat-label">Model Responses</div>
                                <div className="usage-stat-value">
                                    <span className="usage-current">{user.daily_usage_count}</span>
                                    <span className="usage-separator">/</span>
                                    <span className="usage-limit">{getDailyLimit(user.subscription_tier)}</span>
                                </div>
                                <div className="usage-progress-bar">
                                    <div 
                                        className="usage-progress-fill" 
                                        style={{ 
                                            width: `${Math.min(100, (user.daily_usage_count / getDailyLimit(user.subscription_tier)) * 100)}%` 
                                        }}
                                    ></div>
                                </div>
                            </div>
                            <div className="usage-stat">
                                <div className="usage-stat-label">Extended Interactions</div>
                                <div className="usage-stat-value">
                                    <span className="usage-current">{user.daily_extended_usage || 0}</span>
                                    <span className="usage-separator">/</span>
                                    <span className="usage-limit">{getExtendedLimit(user.subscription_tier)}</span>
                                </div>
                                <div className="usage-progress-bar">
                                    <div 
                                        className="usage-progress-fill extended" 
                                        style={{ 
                                            width: `${Math.min(100, ((user.daily_extended_usage || 0) / getExtendedLimit(user.subscription_tier)) * 100)}%` 
                                        }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                        {user.monthly_overage_count > 0 && (
                            <div className="usage-overage">
                                <span className="overage-icon">⚠️</span>
                                <span className="overage-text">{user.monthly_overage_count} overage this month</span>
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
                            <span>Dashboard</span>
                        </button>
                        <button
                            className="menu-item"
                            onClick={() => handleMenuItemClick('upgrade')}
                        >
                            <span className="menu-icon">💳</span>
                            <span>Upgrade Plan</span>
                        </button>
                        <button
                            className="menu-item"
                            onClick={() => handleMenuItemClick('settings')}
                        >
                            <span className="menu-icon">⚙️</span>
                            <span>Settings</span>
                        </button>
                        <a
                            href="mailto:support@compareintel.com"
                            className="menu-item"
                            onClick={() => {
                                setIsOpen(false);
                            }}
                        >
                            <span className="menu-icon">📧</span>
                            <span>Contact Support</span>
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
                        <span>Sign Out</span>
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
                                        <span className="feature-text"><strong>10 extended interactions</strong> per day</span>
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
                                        <span className="feature-text"><strong>10 conversations</strong> saved</span>
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
                                        <span className="feature-text"><strong>20 extended interactions</strong> per day</span>
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
                                        <span className="feature-text"><strong>20 conversations</strong> saved</span>
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
                                        <span className="feature-text"><strong>40 extended interactions</strong> per day</span>
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
                                        <span className="feature-text"><strong>40 conversations</strong> saved</span>
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
                                        <span className="feature-text"><strong>80 extended interactions</strong> per day</span>
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
                                        <span className="feature-text"><strong>80 conversations</strong> saved</span>
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

