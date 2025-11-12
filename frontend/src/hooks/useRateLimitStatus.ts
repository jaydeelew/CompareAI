/**
 * Custom hook for managing rate limit status
 * 
 * Fetches and tracks rate limit status for both authenticated
 * and anonymous users. Includes usage counts and tier limits.
 */

import { useState, useEffect, useCallback } from 'react';
import { getRateLimitStatus, type RateLimitStatus } from '../services/compareService';

export interface UseRateLimitStatusOptions {
  isAuthenticated: boolean;
  browserFingerprint: string;
}

export interface UseRateLimitStatusReturn {
  usageCount: number;
  setUsageCount: React.Dispatch<React.SetStateAction<number>>;
  extendedUsageCount: number;
  setExtendedUsageCount: React.Dispatch<React.SetStateAction<number>>;
  rateLimitStatus: RateLimitStatus | null;
  fetchRateLimitStatus: () => Promise<void>;
}

export function useRateLimitStatus({
  isAuthenticated,
  browserFingerprint,
}: UseRateLimitStatusOptions): UseRateLimitStatusReturn {
  const [usageCount, setUsageCount] = useState(0);
  const [extendedUsageCount, setExtendedUsageCount] = useState(0);
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus | null>(null);

  // Fetch rate limit status
  const fetchRateLimitStatus = useCallback(async () => {
    if (!isAuthenticated && !browserFingerprint) {
      return;
    }

    try {
      const status = await getRateLimitStatus(
        isAuthenticated ? undefined : browserFingerprint
      );
      setRateLimitStatus(status);
    } catch (error) {
      // Silently handle cancellation errors (expected when component unmounts)
      if (error instanceof Error && error.name === 'CancellationError') {
        return; // Don't log or update state for cancelled requests
      }
      console.error('Failed to fetch rate limit status:', error);
      setRateLimitStatus(null);
    }
  }, [isAuthenticated, browserFingerprint]);

  // Load usage counts from localStorage for anonymous users
  useEffect(() => {
    if (!isAuthenticated) {
      const savedUsage = localStorage.getItem('compareai_usage');
      const savedExtendedUsage = localStorage.getItem('compareai_extended_usage');

      if (savedUsage) {
        try {
          const { count, date } = JSON.parse(savedUsage);
          const today = new Date().toDateString();
          if (date === today) {
            setUsageCount(count);
          } else {
            // Reset count if it's a new day
            setUsageCount(0);
            localStorage.removeItem('compareai_usage');
          }
        } catch (e) {
          console.error('Failed to parse usage count:', e);
          setUsageCount(0);
        }
      }

      if (savedExtendedUsage) {
        try {
          const { count, date } = JSON.parse(savedExtendedUsage);
          const today = new Date().toDateString();
          if (date === today) {
            setExtendedUsageCount(count);
          } else {
            // Reset count if it's a new day
            setExtendedUsageCount(0);
            localStorage.removeItem('compareai_extended_usage');
          }
        } catch (e) {
          console.error('Failed to parse extended usage count:', e);
          setExtendedUsageCount(0);
        }
      }
    }
  }, [isAuthenticated]);

  // Fetch rate limit status on mount and when auth/fingerprint changes
  useEffect(() => {
    if (browserFingerprint || isAuthenticated) {
      fetchRateLimitStatus();
    }
  }, [isAuthenticated, browserFingerprint, fetchRateLimitStatus]);

  return {
    usageCount,
    setUsageCount,
    extendedUsageCount,
    setExtendedUsageCount,
    rateLimitStatus,
    fetchRateLimitStatus,
  };
}

