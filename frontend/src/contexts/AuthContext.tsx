/**
 * Authentication Context for CompareAI
 * Manages user authentication state, login, logout, and token refresh
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, AuthContextType, LoginCredentials, RegisterData, AuthResponse } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// API base URL with smart fallback
const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '/api';

interface AuthProviderProps {
    children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Note: Tokens are now stored in HTTP-only cookies set by the backend
    // We no longer need to manage tokens in localStorage
    // Cookies are automatically sent with requests, so we don't need to read them

    // Fetch current user from API
    // Cookies are automatically sent with the request, no need to include Authorization header
    const fetchCurrentUser = useCallback(async (): Promise<User | null> => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/me`, {
                credentials: 'include', // Important: Include cookies in request
            });

            if (!response.ok) {
                // 401 (Unauthorized) is expected when user is not authenticated - handle silently
                if (response.status === 401) {
                    return null;
                }
                throw new Error('Failed to fetch user');
            }

            const userData = await response.json();
            return userData;
        } catch (error) {
            // Silently handle cancellation errors (expected when component unmounts)
            if (error instanceof Error && error.name === 'AbortError') {
                return null;
            }
            return null;
        }
    }, []);

    // Refresh access token using refresh token from cookies
    const refreshToken = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
                method: 'POST',
                credentials: 'include', // Important: Include cookies (refresh token) in request
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                // 401 (Unauthorized) is expected when user is not authenticated (e.g., after logout)
                // Only throw/error for unexpected failures
                if (response.status === 401) {
                    setUser(null);
                    setIsLoading(false);
                    return;
                }
                throw new Error('Token refresh failed');
            }

            // Tokens are now set in cookies by the backend, no need to save them
            // Fetch user data after refreshing token
            const userData = await fetchCurrentUser();
            if (userData) {
                setUser(userData);
            } else {
                // If we can't fetch user, user is not authenticated
                setUser(null);
            }
        } catch (error) {
            // Only log unexpected errors (network errors, 500s, etc.)
            // 401s are handled above and are expected when not authenticated
            console.error('Error refreshing token:', error);
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }, [fetchCurrentUser]);

    // Login function
    const login = async (credentials: LoginCredentials) => {
        setIsLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                credentials: 'include', // Important: Include cookies in request/response
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: credentials.email,
                    password: credentials.password,
                }),
            });

            if (!response.ok) {
                // Try to get error message from response
                let errorMessage = 'Login failed';
                const contentType = response.headers.get('content-type');
                
                try {
                    if (contentType && contentType.includes('application/json')) {
                        const error = await response.json();
                        errorMessage = error.detail || error.message || JSON.stringify(error);
                    } else {
                        // Try to read as text for non-JSON responses
                        const errorText = await response.text();
                        errorMessage = errorText || `Server error (${response.status})`;
                    }
                } catch (parseError) {
                    errorMessage = `Server error (${response.status}): ${response.statusText}`;
                }
                
                throw new Error(errorMessage);
            }

            // Tokens are now set in HTTP-only cookies by the backend
            // No need to save them to localStorage
            const data: AuthResponse = await response.json();

            // Fetch user data - don't fail login if this fails
            try {
                const userData = await fetchCurrentUser();
                if (userData) {
                    setUser(userData);
                } else {
                    // Retry in background without blocking
                    fetchCurrentUser().then(userData => {
                        if (userData) {
                            setUser(userData);
                        }
                    }).catch(() => {
                        // Silently fail background retry
                    });
                }
            } catch (userFetchError) {
                // User fetch failed, but login is still successful
                // Retry in background without blocking
                fetchCurrentUser().then(userData => {
                    if (userData) {
                        setUser(userData);
                    }
                }).catch(() => {
                    // Silently fail background retry
                });
            }
            
            setIsLoading(false);
        } catch (error) {
            setIsLoading(false);
            throw error;
        }
    };

    // Register function
    const register = async (data: RegisterData) => {
        setIsLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                credentials: 'include', // Important: Include cookies in request/response
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: data.email,
                    password: data.password,
                    recaptcha_token: data.recaptcha_token,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Registration failed');
            }

            // Tokens are now set in HTTP-only cookies by the backend
            const responseData: AuthResponse = await response.json();
            setUser(responseData.user);
            setIsLoading(false);
        } catch (error) {
            console.error('Registration error:', error);
            setIsLoading(false);
            throw error;
        }
    };

    // Logout function
    const logout = async () => {
        try {
            // Call logout endpoint to clear cookies on server
            await fetch(`${API_BASE_URL}/auth/logout`, {
                method: 'POST',
                credentials: 'include', // Important: Include cookies in request
            });
        } catch (error) {
            console.error('Error during logout:', error);
            // Continue with logout even if request fails
        }
        
        setUser(null);
        setIsLoading(false);
        // Refresh the webpage after logout to ensure clean state
        window.location.reload();
    };

    // Update user data
    const updateUser = (updatedUser: User) => {
        setUser(updatedUser);
    };

    // Refresh user data from server
    const refreshUser = useCallback(async () => {
        const userData = await fetchCurrentUser();
        if (userData) {
            setUser(userData);
        }
    }, [fetchCurrentUser]);

    // Initialize auth state on mount (only once)
    useEffect(() => {
        let isMounted = true;
        
        const initAuth = async () => {
            console.log('[Auth] Initializing auth state...');
            const initStartTime = Date.now();

            console.log('[Auth] Attempting to fetch user data...');
            // Try to fetch user (cookies are automatically sent)
            const userData = await fetchCurrentUser();

            if (!isMounted) return;

            if (userData) {
                console.log('[Auth] User data fetched successfully during initialization');
                setUser(userData);
                setIsLoading(false);
                const initDuration = Date.now() - initStartTime;
                console.log('[Auth] Auth initialization completed in', initDuration, 'ms');
            } else {
                console.log('[Auth] User data fetch failed, attempting token refresh...');
                // If access token is invalid, try to refresh
                await refreshToken();
                if (isMounted) {
                    const initDuration = Date.now() - initStartTime;
                    console.log('[Auth] Auth initialization completed (after refresh) in', initDuration, 'ms');
                }
            }
        };

        initAuth();
        
        return () => {
            isMounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run once on mount - fetchCurrentUser and refreshToken are stable callbacks

    // Set up token refresh interval (refresh every 14 minutes, tokens expire in 15)
    useEffect(() => {
        if (!user) return;

        const interval = setInterval(() => {
            refreshToken();
        }, 14 * 60 * 1000); // 14 minutes

        return () => clearInterval(interval);
    }, [user, refreshToken]);

    const value: AuthContextType = {
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshToken,
        updateUser,
        refreshUser,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

// Helper hook to get auth headers for API calls
// Note: With cookie-based auth, tokens are automatically sent with requests
// This hook is kept for backward compatibility but no longer adds Authorization header
export const useAuthHeaders = () => {
    const getHeaders = useCallback(() => {
        return {
            'Content-Type': 'application/json',
            // Tokens are now in HTTP-only cookies, automatically sent by browser
        };
    }, []);

    return getHeaders;
};

