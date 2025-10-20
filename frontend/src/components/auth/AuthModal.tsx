/**
 * Auth Modal Component
 * Displays login or register form in a modal
 */

import React, { useState, useEffect } from 'react';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import './AuthForms.css';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialMode?: 'login' | 'register' | 'forgot-password';
}

export const AuthModal: React.FC<AuthModalProps> = ({
    isOpen,
    onClose,
    initialMode = 'login'
}) => {
    const [mode, setMode] = useState<'login' | 'register' | 'forgot-password'>(initialMode);

    // Update mode when initialMode changes (e.g., when opening modal with different button)
    useEffect(() => {
        if (isOpen) {
            setMode(initialMode);
        }
    }, [isOpen, initialMode]);

    // Listen for password reset flow to auto-close the modal
    useEffect(() => {
        const handlePasswordResetFlow = () => {
            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get('token');
            const path = window.location.pathname;
            const fullUrl = window.location.href;

            // If user clicked the reset link while modal is open, close the modal immediately
            if (token && (path.includes('reset-password') || fullUrl.includes('reset-password'))) {
                if (isOpen) {
                    onClose();
                }
            }
        };

        // Check immediately
        handlePasswordResetFlow();

        // Listen for URL changes (for single-page apps)
        window.addEventListener('popstate', handlePasswordResetFlow);

        // Also check periodically in case URL changes aren't detected
        const intervalId = setInterval(handlePasswordResetFlow, 200);

        return () => {
            window.removeEventListener('popstate', handlePasswordResetFlow);
            clearInterval(intervalId);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSuccess = () => {
        onClose();
    };

    return (
        <div className="auth-modal-overlay">
            <div className="auth-modal">
                <button className="auth-modal-close" onClick={onClose} aria-label="Close">
                    ×
                </button>

                {mode === 'login' ? (
                    <LoginForm
                        onSuccess={handleSuccess}
                        onSwitchToRegister={() => setMode('register')}
                        onForgotPassword={() => setMode('forgot-password')}
                    />
                ) : mode === 'register' ? (
                    <RegisterForm
                        onSuccess={handleSuccess}
                        onSwitchToLogin={() => setMode('login')}
                    />
                ) : (
                    <ForgotPasswordForm
                        onSuccess={handleSuccess}
                        onBackToLogin={() => setMode('login')}
                        onClose={onClose}
                    />
                )}
            </div>
        </div>
    );
};

