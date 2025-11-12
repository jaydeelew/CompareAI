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

    // Get tokens from localStorage
    const getAccessToken = () => localStorage.getItem('access_token');
    const getRefreshToken = () => localStorage.getItem('refresh_token');

    // Save tokens to localStorage
    const saveTokens = (accessToken: string, refreshToken: string) => {
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', refreshToken);
    };

    // Clear tokens from localStorage
    const clearTokens = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
    };

    // Fetch current user from API
    const fetchCurrentUser = useCallback(async (accessToken: string): Promise<User | null> => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (!response.ok) {
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

    // Refresh access token using refresh token
    const refreshToken = useCallback(async () => {
        const refreshTokenValue = getRefreshToken();

        if (!refreshTokenValue) {
            setUser(null);
            setIsLoading(false);
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ refresh_token: refreshTokenValue }),
            });

            if (!response.ok) {
                throw new Error('Token refresh failed');
            }

            // Refresh endpoint returns TokenResponse (tokens only, no user)
            const data = await response.json() as { access_token: string; refresh_token: string; token_type: string };
            saveTokens(data.access_token, data.refresh_token);
            
            // Fetch user data after refreshing token (refresh endpoint doesn't return user)
            const userData = await fetchCurrentUser(data.access_token);
            if (userData) {
                setUser(userData);
            } else {
                // If we can't fetch user, clear tokens
                clearTokens();
                setUser(null);
            }
        } catch (error) {
            console.error('Error refreshing token:', error);
            clearTokens();
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

            const data: AuthResponse = await response.json();
            saveTokens(data.access_token, data.refresh_token);

            // Fetch user data - don't fail login if this fails
            try {
                const userData = await fetchCurrentUser(data.access_token);
                if (userData) {
                    setUser(userData);
                } else {
                    // Retry in background without blocking
                    fetchCurrentUser(data.access_token).then(userData => {
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
                fetchCurrentUser(data.access_token).then(userData => {
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

            const responseData: AuthResponse = await response.json();
            saveTokens(responseData.access_token, responseData.refresh_token);
            setUser(responseData.user);
            setIsLoading(false);
        } catch (error) {
            console.error('Registration error:', error);
            setIsLoading(false);
            throw error;
        }
    };

    // Logout function
    const logout = () => {
        clearTokens();
        setUser(null);
        setIsLoading(false); // Set loading to false after logout
        // Refresh the webpage after logout
        window.location.reload();
    };

    // Update user data
    const updateUser = (updatedUser: User) => {
        setUser(updatedUser);
    };

    // Refresh user data from server
    const refreshUser = async () => {
        const accessToken = getAccessToken();
        if (!accessToken) {
            return;
        }

        const userData = await fetchCurrentUser(accessToken);
        if (userData) {
            setUser(userData);
        }
    };

    // Initialize auth state on mount (only once)
    useEffect(() => {
        let isMounted = true;
        
        const initAuth = async () => {
            console.log('[Auth] Initializing auth state...');
            const initStartTime = Date.now();
            const accessToken = getAccessToken();

            if (!accessToken) {
                console.log('[Auth] No access token found, user is not authenticated');
                if (isMounted) {
                    setIsLoading(false);
                }
                return;
            }

            console.log('[Auth] Access token found, attempting to fetch user data...');
            // Try to fetch user with current access token
            const userData = await fetchCurrentUser(accessToken);

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
export const useAuthHeaders = () => {
    const getHeaders = useCallback(() => {
        const token = localStorage.getItem('access_token');
        return {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
        };
    }, []);

    return getHeaders;
};

