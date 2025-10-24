/**
 * Authentication types for CompareAI
 */

export interface User {
    id: number;
    email: string;
    is_verified: boolean;
    is_active: boolean;
    role: 'user' | 'moderator' | 'admin' | 'super_admin';
    is_admin: boolean;
    subscription_tier: 'free' | 'starter' | 'starter_plus' | 'pro' | 'pro_plus';
    subscription_status: 'active' | 'cancelled' | 'expired';
    subscription_period: 'monthly' | 'yearly';
    daily_usage_count: number; // MODEL-BASED: counts individual model responses, not comparisons
    daily_extended_usage: number; // Extended tier usage count
    monthly_overage_count: number; // MODEL-BASED: counts overage model responses
    mock_mode_enabled: boolean; // Testing feature - use mock responses instead of API calls (admin only)
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
    daily_usage: number; // MODEL-BASED: number of model responses used today
    daily_limit: number; // MODEL-BASED: total model responses allowed per day
    remaining_usage: number; // MODEL-BASED: remaining model responses
    subscription_tier: string;
    model_limit: number; // Max models per comparison (uniform 9 for all tiers)
    overage_allowed: boolean;
    overage_price: number | null; // Price per additional model response (TBD)
    monthly_overage_count: number; // MODEL-BASED: overage model responses this month
    reset_time: string;
}

