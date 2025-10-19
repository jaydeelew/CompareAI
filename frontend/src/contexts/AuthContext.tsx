/**
 * Authentication Context for CompareAI
 * Manages user authentication state, login, logout, and token refresh
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, AuthContextType, LoginCredentials, RegisterData, AuthResponse } from '../types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '/api';
console.log('API_BASE_URL:', API_BASE_URL); // Debug log

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
            console.error('Error fetching user:', error);
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

            const data: AuthResponse = await response.json();
            saveTokens(data.access_token, data.refresh_token);
            setUser(data.user);
        } catch (error) {
            console.error('Error refreshing token:', error);
            clearTokens();
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Login function
    const login = async (credentials: LoginCredentials) => {
        try {
            console.log('Attempting login to:', `${API_BASE_URL}/auth/login`);
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
            console.log('Login response status:', response.status);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Login failed');
            }

            const data: AuthResponse = await response.json();
            console.log('Login successful!');

            // The backend login doesn't return user data, so we need to fetch it
            saveTokens(data.access_token, data.refresh_token);

            // Fetch user data
            const userData = await fetchCurrentUser(data.access_token);
            if (userData) {
                setUser(userData);
            } else {
                throw new Error('Failed to fetch user data');
            }
        } catch (error) {
            console.error('Login error:', error);
            console.error('Error type:', error instanceof TypeError ? 'Network error' : 'Other error');
            throw error;
        }
    };

    // Register function
    const register = async (data: RegisterData) => {
        try {
            console.log('Attempting registration to:', `${API_BASE_URL}/auth/register`);
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: data.email,
                    password: data.password,
                }),
            });
            console.log('Registration response status:', response.status);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Registration failed');
            }

            const responseData: AuthResponse = await response.json();
            console.log('Registration successful!');
            saveTokens(responseData.access_token, responseData.refresh_token);
            setUser(responseData.user);
        } catch (error) {
            console.error('Registration error:', error);
            console.error('Error type:', error instanceof TypeError ? 'Network error' : 'Other error');
            throw error;
        }
    };

    // Logout function
    const logout = () => {
        clearTokens();
        setUser(null);
    };

    // Update user data
    const updateUser = (updatedUser: User) => {
        setUser(updatedUser);
    };

    // Refresh user data from server
    const refreshUser = async () => {
        const accessToken = getAccessToken();
        if (!accessToken) return;

        const userData = await fetchCurrentUser(accessToken);
        if (userData) {
            setUser(userData);
        }
    };

    // Initialize auth state on mount
    useEffect(() => {
        const initAuth = async () => {
            const accessToken = getAccessToken();

            if (!accessToken) {
                setIsLoading(false);
                return;
            }

            // Try to fetch user with current access token
            const userData = await fetchCurrentUser(accessToken);

            if (userData) {
                setUser(userData);
                setIsLoading(false);
            } else {
                // If access token is invalid, try to refresh
                await refreshToken();
            }
        };

        initAuth();
    }, [fetchCurrentUser, refreshToken]);

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

