/**
 * Auth Modal Component
 * Displays login or register form in a modal
 */

import React, { useState, useEffect } from 'react';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import './AuthForms.css';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({
    isOpen,
    onClose,
    initialMode = 'login'
}) => {
    const [mode, setMode] = useState<'login' | 'register'>(initialMode);

    // Update mode when initialMode changes (e.g., when opening modal with different button)
    useEffect(() => {
        if (isOpen) {
            setMode(initialMode);
        }
    }, [isOpen, initialMode]);

    if (!isOpen) return null;

    const handleSuccess = () => {
        onClose();
    };

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="auth-modal-overlay" onClick={handleOverlayClick}>
            <div className="auth-modal">
                <button className="auth-modal-close" onClick={onClose} aria-label="Close">
                    ×
                </button>

                {mode === 'login' ? (
                    <LoginForm
                        onSuccess={handleSuccess}
                        onSwitchToRegister={() => setMode('register')}
                    />
                ) : (
                    <RegisterForm
                        onSuccess={handleSuccess}
                        onSwitchToLogin={() => setMode('login')}
                    />
                )}
            </div>
        </div>
    );
};

