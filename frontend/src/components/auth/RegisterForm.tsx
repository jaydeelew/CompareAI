/**
 * Register Form Component
 */

import React, { useState, useEffect } from 'react';
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
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Auto-sync password to confirm password field when password changes
    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newPassword = e.target.value;
        setPassword(newPassword);
        // Auto-fill confirm password field when password is filled (e.g., by 1Password)
        if (newPassword && !confirmPassword) {
            setConfirmPassword(newPassword);
        }
    };

    // Monitor password field for programmatic changes (e.g., 1Password autofill)
    useEffect(() => {
        const passwordField = document.getElementById('register-password') as HTMLInputElement;
        const confirmPasswordField = document.getElementById('register-confirm-password') as HTMLInputElement;

        if (passwordField && confirmPasswordField) {
            // Check for changes every 100ms to catch 1Password autofill
            const interval = setInterval(() => {
                // If password field has a value but React state doesn't match
                if (passwordField.value && passwordField.value !== password) {
                    setPassword(passwordField.value);
                    // Auto-fill confirm password field if it's empty
                    if (!confirmPassword) {
                        setConfirmPassword(passwordField.value);
                    }
                }

                // If confirm password field has a value but React state doesn't match
                if (confirmPasswordField.value && confirmPasswordField.value !== confirmPassword) {
                    setConfirmPassword(confirmPasswordField.value);
                    // If password field is empty, copy from confirm field
                    if (!password) {
                        setPassword(confirmPasswordField.value);
                    }
                }
            }, 100);

            // Also use MutationObserver for immediate detection
            const observer = new MutationObserver(() => {
                // If password field has a value but React state doesn't match
                if (passwordField.value && passwordField.value !== password) {
                    setPassword(passwordField.value);
                    // Auto-fill confirm password field if it's empty
                    if (!confirmPassword) {
                        setConfirmPassword(passwordField.value);
                    }
                }

                // If confirm password field has a value but React state doesn't match
                if (confirmPasswordField.value && confirmPasswordField.value !== confirmPassword) {
                    setConfirmPassword(confirmPasswordField.value);
                    // If password field is empty, copy from confirm field
                    if (!password) {
                        setPassword(confirmPasswordField.value);
                    }
                }
            });

            observer.observe(passwordField, { attributes: true, attributeFilter: ['value'] });
            observer.observe(confirmPasswordField, { attributes: true, attributeFilter: ['value'] });

            return () => {
                clearInterval(interval);
                observer.disconnect();
            };
        }
    }, [password, confirmPassword]);


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
                <p>Get 20 daily comparisons for free</p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form" autoComplete="off">
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
                        name="email"
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
                    <label htmlFor="register-password">Password</label>
                    <div className="password-input-container">
                        <input
                            id="register-password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={handlePasswordChange}
                            placeholder="••••••••••••"
                            required
                            autoComplete="new-password"
                            disabled={isLoading}
                            minLength={12}
                            data-lpignore="false"
                            data-form-type="register"
                            data-1p-ignore="false"
                        />
                        <button
                            type="button"
                            className="password-toggle-btn"
                            onClick={() => setShowPassword(!showPassword)}
                            disabled={isLoading}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                            {showPassword ? "🔒" : "👁️"}
                        </button>
                    </div>
                    <small className="form-hint">Min 12 chars: uppercase, lowercase, number & special char</small>
                </div>

                <div className="form-group">
                    <label htmlFor="register-confirm-password">Confirm Password</label>
                    <div className="password-input-container">
                        <input
                            id="register-confirm-password"
                            name="confirmPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••••••"
                            required
                            autoComplete="new-password"
                            disabled={isLoading}
                            minLength={12}
                            data-lpignore="false"
                            data-form-type="register"
                            data-1p-ignore="false"
                        />
                        <button
                            type="button"
                            className="password-toggle-btn"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            disabled={isLoading}
                            aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                        >
                            {showConfirmPassword ? "🔒" : "👁️"}
                        </button>
                    </div>
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

