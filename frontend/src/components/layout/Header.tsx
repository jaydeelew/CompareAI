import React from 'react';
import { UserMenu } from '../auth';

/**
 * Header component props
 */
export interface HeaderProps {
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** User object */
  user?: {
    is_admin?: boolean;
    email?: string;
  } | null;
  /** Current view (main or admin) */
  currentView?: 'main' | 'admin';
  /** Callback to toggle admin view */
  onAdminToggle?: () => void;
  /** Callback to open auth modal in login mode */
  onSignInClick?: () => void;
  /** Callback to open auth modal in register mode */
  onSignUpClick?: () => void;
}

/**
 * Application header with navigation and branding
 * 
 * @example
 * ```tsx
 * <Header
 *   isAuthenticated={true}
 *   user={user}
 *   currentView="main"
 *   onAdminToggle={() => setCurrentView('admin')}
 * />
 * ```
 */
export const Header: React.FC<HeaderProps> = ({
  isAuthenticated,
  user,
  currentView = 'main',
  onAdminToggle,
  onSignInClick,
  onSignUpClick,
}) => {
  return (
    <header className="app-header">
      <nav className="navbar">
        <div className="nav-brand">
          <div className="brand-logo">
            <img
              src="/CompareIntel.png"
              alt="CompareIntel Logo"
              className="logo-icon"
            />
            <div className="brand-text">
              <h1>CompareIntel</h1>
              <span className="brand-tagline">AI Model Comparison Platform</span>
            </div>
          </div>
        </div>

        <div className="nav-actions">
          {isAuthenticated ? (
            <>
              {user?.is_admin && (
                <button
                  className="admin-avatar-button"
                  onClick={onAdminToggle}
                  title={currentView === 'admin' ? 'Back to Main App' : 'Admin Panel'}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                </button>
              )}
              <UserMenu />
            </>
          ) : (
            <>
              <button className="nav-button-text" onClick={onSignInClick}>
                Sign In
              </button>
              <button className="nav-button-primary" onClick={onSignUpClick}>
                Sign Up
              </button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
};

Header.displayName = 'Header';

