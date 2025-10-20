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

    // No need for manual password reset detection - handled by App.tsx tab coordination

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

