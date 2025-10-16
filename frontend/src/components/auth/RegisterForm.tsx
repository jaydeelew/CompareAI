/**
 * Register Form Component
 */

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './AuthForms.css';

interface RegisterFormProps {
    onSuccess?: () => void;
    onSwitchToLogin?: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSuccess, onSwitchToLogin }) => {
    const { register } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const validateForm = (): boolean => {
        if (password.length < 12) {
            setError('Password must be at least 12 characters long');
            return false;
        }

        // Check for uppercase letter
        if (!/[A-Z]/.test(password)) {
            setError('Password must contain at least one uppercase letter');
            return false;
        }

        // Check for lowercase letter
        if (!/[a-z]/.test(password)) {
            setError('Password must contain at least one lowercase letter');
            return false;
        }

        // Check for number
        if (!/[0-9]/.test(password)) {
            setError('Password must contain at least one number');
            return false;
        }

        // Check for special character
        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            setError('Password must contain at least one special character (!@#$%^&*()_+-=[]{};\':"|,.<>/?)');
            return false;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return false;
        }

        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!validateForm()) {
            return;
        }

        setIsLoading(true);

        try {
            await register({ email, password });
            onSuccess?.();
        } catch (err) {
            console.error('Registration error:', err);
            if (err instanceof Error) {
                // Check if it's a network error
                if (err.message.includes('fetch') || err.message.includes('Failed to fetch')) {
                    setError('Cannot connect to server. Please make sure the backend is running on http://127.0.0.1:8000');
                } else {
                    setError(err.message);
                }
            } else {
                setError('Registration failed. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-form-container">
            <div className="auth-form-header">
                <h2>Create Account</h2>
                <p>Get 10 daily comparisons for free</p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
                {error && (
                    <div className="auth-error">
                        <span className="error-icon">⚠️</span>
                        {error}
                    </div>
                )}

                <div className="form-group">
                    <label htmlFor="email">Email</label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        required
                        autoComplete="email"
                        disabled={isLoading}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        required
                        autoComplete="new-password"
                        disabled={isLoading}
                        minLength={12}
                    />
                    <small className="form-hint">At least 12 characters with uppercase, lowercase, number, and special character</small>
                </div>

                <div className="form-group">
                    <label htmlFor="confirmPassword">Confirm Password</label>
                    <input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••••••"
                        required
                        autoComplete="new-password"
                        disabled={isLoading}
                        minLength={12}
                    />
                </div>

                <button
                    type="submit"
                    className="auth-submit-btn"
                    disabled={isLoading}
                >
                    {isLoading ? 'Creating account...' : 'Create Account'}
                </button>
            </form>

            <div className="auth-form-footer">
                <p className="terms-text">
                    By creating an account, you agree to our Terms of Service and Privacy Policy
                </p>
                <p>
                    Already have an account?{' '}
                    <button
                        type="button"
                        className="auth-link-btn"
                        onClick={onSwitchToLogin}
                    >
                        Sign in
                    </button>
                </p>
            </div>
        </div>
    );
};

