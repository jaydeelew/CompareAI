/**
 * Authentication types for CompareAI
 */

export interface User {
    id: number;
    email: string;
    is_verified: boolean;
    is_active: boolean;
    subscription_tier: 'free' | 'starter' | 'pro';
    subscription_status: 'active' | 'cancelled' | 'expired';
    subscription_period: 'monthly' | 'yearly';
    daily_usage_count: number;
    monthly_overage_count: number;
    created_at: string;
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface RegisterData {
    email: string;
    password: string;
    confirm_password?: string;
}

export interface AuthTokens {
    access_token: string;
    refresh_token: string;
    token_type: string;
}

export interface AuthResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
    user: User;
}

export interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (credentials: LoginCredentials) => Promise<void>;
    register: (data: RegisterData) => Promise<void>;
    logout: () => void;
    refreshToken: () => Promise<void>;
    updateUser: (user: User) => void;
    refreshUser: () => Promise<void>;
}

export interface UsageStats {
    daily_usage: number;
    daily_limit: number;
    remaining_usage: number;
    subscription_tier: string;
    model_limit: number;
    overage_allowed: boolean;
    overage_price: number | null;
    monthly_overage_count: number;
    reset_time: string;
}

