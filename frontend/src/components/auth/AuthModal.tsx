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
    initialEmail?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
    isOpen,
    onClose,
    initialMode = 'login',
    initialEmail = ''
}) => {
    const [mode, setMode] = useState<'login' | 'register' | 'forgot-password'>(initialMode);
    const [forgotPasswordEmail, setForgotPasswordEmail] = useState<string>('');

    // Update mode when initialMode changes (e.g., when opening modal with different button)
    useEffect(() => {
        if (isOpen) {
            setMode(initialMode);
        }
    }, [isOpen, initialMode]);

    // Reset forgotPasswordEmail when modal closes
    useEffect(() => {
        if (!isOpen) {
            setForgotPasswordEmail('');
        }
    }, [isOpen]);

    // No need for manual password reset detection - handled by App.tsx tab coordination

    if (!isOpen) return null;

    const handleSuccess = () => {
        // Reset email state on successful login/register
        setForgotPasswordEmail('');
        onClose();
    };

    const handleClose = () => {
        // Reset email state when modal closes
        setForgotPasswordEmail('');
        onClose();
    };

    return (
        <div className="auth-modal-overlay">
            <div className="auth-modal">
                <button className="auth-modal-close" onClick={handleClose} aria-label="Close">
                    ×
                </button>

                {mode === 'login' ? (
                    <LoginForm
                        onSuccess={handleSuccess}
                        onSwitchToRegister={() => setMode('register')}
                        onForgotPassword={(email) => {
                            setForgotPasswordEmail(email || '');
                            setMode('forgot-password');
                        }}
                        initialEmail={initialEmail}
                    />
                ) : mode === 'register' ? (
                    <RegisterForm
                        onSuccess={handleSuccess}
                        onSwitchToLogin={() => setMode('login')}
                    />
                ) : (
                    <ForgotPasswordForm
                        onSuccess={handleSuccess}
                        onBackToLogin={() => {
                            setForgotPasswordEmail('');
                            setMode('login');
                        }}
                        onClose={handleClose}
                        initialEmail={forgotPasswordEmail}
                    />
                )}
            </div>
        </div>
    );
};

