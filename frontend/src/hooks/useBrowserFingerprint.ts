/**
 * Custom hook for managing browser fingerprint
 * 
 * Generates and caches a browser fingerprint for anonymous user tracking
 * and rate limiting purposes.
 */

import { useState, useEffect } from 'react';
import { generateBrowserFingerprint } from '../utils';

export interface UseBrowserFingerprintReturn {
  browserFingerprint: string;
  setBrowserFingerprint: React.Dispatch<React.SetStateAction<string>>;
}

export function useBrowserFingerprint(): UseBrowserFingerprintReturn {
  const [browserFingerprint, setBrowserFingerprint] = useState('');

  // Generate browser fingerprint on mount
  useEffect(() => {
    const generateFingerprint = async () => {
      const fingerprint = await generateBrowserFingerprint();
      setBrowserFingerprint(fingerprint);
    };

    generateFingerprint();
  }, []);

  return {
    browserFingerprint,
    setBrowserFingerprint,
  };
}

