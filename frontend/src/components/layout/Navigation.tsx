import { UserMenu } from '../auth';

interface NavigationProps {
  isAuthenticated: boolean;
  isAdmin: boolean;
  currentView: 'main' | 'admin';
  onViewChange: (view: 'main' | 'admin') => void;
  onSignInClick: () => void;
  onSignUpClick: () => void;
}

/**
 * Navigation - Main navigation bar with logo, brand, and auth actions
 */
export function Navigation({
  isAuthenticated,
  isAdmin,
  currentView,
  onViewChange,
  onSignInClick,
  onSignUpClick
}: NavigationProps) {
  return (
    <header className="app-header">
      <nav className="navbar">
        <div className="nav-brand">
          <div className="brand-logo">
            <svg className="logo-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Background circle */}
              <circle cx="24" cy="24" r="24" fill="url(#logoGradient)" />

              {/* AI Brain/Neural Network Pattern */}
              <g>
                {/* Central node */}
                <circle cx="24" cy="24" r="3" fill="white" />

                {/* Left side nodes */}
                <circle cx="12" cy="18" r="2" fill="white" opacity="0.9" />
                <circle cx="12" cy="24" r="2" fill="white" opacity="0.9" />
                <circle cx="12" cy="30" r="2" fill="white" opacity="0.9" />

                {/* Right side nodes */}
                <circle cx="36" cy="18" r="2" fill="white" opacity="0.9" />
                <circle cx="36" cy="24" r="2" fill="white" opacity="0.9" />
                <circle cx="36" cy="30" r="2" fill="white" opacity="0.9" />

                {/* Connection lines */}
                <line x1="14" y1="18" x2="21" y2="21" stroke="white" strokeWidth="1.5" opacity="0.7" />
                <line x1="14" y1="24" x2="21" y2="24" stroke="white" strokeWidth="1.5" opacity="0.7" />
                <line x1="14" y1="30" x2="21" y2="27" stroke="white" strokeWidth="1.5" opacity="0.7" />

                <line x1="27" y1="21" x2="34" y2="18" stroke="white" strokeWidth="1.5" opacity="0.7" />
                <line x1="27" y1="24" x2="34" y2="24" stroke="white" strokeWidth="1.5" opacity="0.7" />
                <line x1="27" y1="27" x2="34" y2="30" stroke="white" strokeWidth="1.5" opacity="0.7" />

                {/* Comparison arrows */}
                <path d="M16 15 L20 12 L20 14 L28 14 L28 12 L32 15 L28 18 L28 16 L20 16 L20 18 Z"
                  fill="white" opacity="0.8" />
                <path d="M16 33 L20 30 L20 32 L28 32 L28 30 L32 33 L28 36 L28 34 L20 34 L20 36 Z"
                  fill="white" opacity="0.8" />
              </g>

              <defs>
                <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#2563eb" />
                  <stop offset="50%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#1d4ed8" />
                </linearGradient>
              </defs>
            </svg>
            <div className="brand-text">
              <h1>CompareIntel</h1>
              <span className="brand-tagline">AI Model Comparison Platform</span>
            </div>
          </div>
        </div>

        <div className="nav-actions">
          {isAuthenticated ? (
            <>
              {isAdmin && (
                <button
                  className="admin-avatar-button"
                  onClick={() => onViewChange(currentView === 'admin' ? 'main' : 'admin')}
                  title={currentView === 'admin' ? 'Back to Main App' : 'Admin Panel'}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
              <button
                className="nav-button-text"
                onClick={onSignInClick}
              >
                Sign In
              </button>
              <button
                className="nav-button-primary"
                onClick={onSignUpClick}
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

