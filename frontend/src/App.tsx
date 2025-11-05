import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Routes, Route } from 'react-router-dom';
// Import all CSS modules directly (better for Vite than CSS @import)
import './styles/variables.css';
import './styles/base.css';
import './styles/animations.css';
import './styles/banners.css';
import './styles/components.css';
import './styles/navigation.css';
import './styles/layout.css';
import './styles/responsive.css';
import './styles/hero.css';
import './styles/models.css';
import './styles/results.css';
import './App.css';
import LatexRenderer from './components/LatexRenderer';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthModal, UserMenu, VerifyEmail, VerificationBanner, ResetPassword } from './components/auth';
import { AdminPanel } from './components/admin';
import { Footer } from './components';
import { TermsOfService } from './components/TermsOfService';

// API URL with smart fallback:
// - Uses VITE_API_URL from environment if set
// - Defaults to '/api' which works with Vite proxy in development
// - In production, set VITE_API_URL to full backend URL if no proxy
const API_URL = import.meta.env.VITE_API_URL || '/api';

interface CompareResponse {
  results: { [key: string]: string };
  metadata: {
    input_length: number;
    models_requested: number;
    models_successful: number;
    models_failed: number;
    timestamp: string;
    processing_time_ms?: number;
  };
}

interface ConversationMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  model_id?: string;
  id?: string | number;
}

interface ModelConversation {
  modelId: string;
  messages: ConversationMessage[];
}

interface Model {
  id: string;
  name: string;
  description: string;
  category: string;
  provider: string;
  available?: boolean; // Optional field - if false, model is not available for selection
}

interface ModelsByProvider {
  [provider: string]: Model[];
}

// Freemium usage limits (anonymous users only) - MODEL-BASED
// Anonymous (unregistered) users get 10 model responses per day
const MAX_DAILY_USAGE = 10;

// Maximum number of times extended mode can be used per day per subscription tier (quota enforcement)
// Extended mode is only triggered when the user explicitly clicks the Extended mode button
const EXTENDED_TIER_LIMITS = {
  anonymous: 2,
  free: 5,
  starter: 10,
  starter_plus: 20,
  pro: 40,
  pro_plus: 80
};

// Simple hash function to convert fingerprint to a fixed-length string
const simpleHash = async (str: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Generate browser fingerprint for usage tracking (anti-abuse measure)
const generateBrowserFingerprint = async () => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Browser fingerprint', 2, 2);
  }

  const fingerprint = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    canvas: canvas.toDataURL(),
    colorDepth: screen.colorDepth,
    hardwareConcurrency: navigator.hardwareConcurrency
    // Removed timestamp to keep fingerprint consistent across page refreshes
  };

  const fingerprintString = JSON.stringify(fingerprint);
  // Hash the fingerprint to keep it under 64 characters (SHA-256)
  return await simpleHash(fingerprintString);
};

function AppContent() {
  const { isAuthenticated, user, refreshUser, isLoading: authLoading } = useAuth();
  // Track wide layout to coordinate header control alignment with toggle
  const [isWideLayout, setIsWideLayout] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth > 1000; // match CSS breakpoint
  });

  useEffect(() => {
    const handleResize = () => setIsWideLayout(window.innerWidth > 1000);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // State for mobile tooltip visibility (capability tiles)
  const [visibleTooltip, setVisibleTooltip] = useState<string | null>(null);

  // Handle capability tile tap on mobile to show tooltip
  const handleCapabilityTileTap = (tileId: string) => {
    // Only show tooltip on mobile (screen width <= 768px)
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      setVisibleTooltip(tileId);
      // Hide tooltip after 2 seconds
      setTimeout(() => {
        setVisibleTooltip(null);
      }, 2000);
    }
  };

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [anonymousMockModeEnabled, setAnonymousMockModeEnabled] = useState(false);

  // Get max models based on user tier
  const getMaxModelsForUser = () => {
    if (!isAuthenticated || !user) {
      return 3; // Anonymous users
    }

    switch (user.subscription_tier) {
      case 'pro':
      case 'pro_plus':
        return 9;
      case 'starter':
      case 'starter_plus':
        return 6;
      case 'free':
      default:
        return 3;
    }
  };

  const maxModelsLimit = getMaxModelsForUser();

  const [loginEmail, setLoginEmail] = useState<string>('');
  const [currentView, setCurrentView] = useState<'main' | 'admin'>('main');

  // Ref to track if we've scrolled to results section in current comparison
  const hasScrolledToResultsRef = useRef(false);

  // State to trigger verification from another tab
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  // State to prevent new tab from verifying while checking for existing tabs
  // Initialize suppressVerification based on whether this is a new tab with a token
  const [suppressVerification, setSuppressVerification] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hasTokenInUrl = urlParams.get('token') !== null;
    const isNewTab = window.opener === null;
    return hasTokenInUrl && isNewTab;
  });

  // State to track if we're in password reset mode
  const [showPasswordReset, setShowPasswordReset] = useState(false);

  // Check for password reset token on mount (for direct navigation or non-tab scenarios)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const path = window.location.pathname;
    const fullUrl = window.location.href;

    // Show password reset if URL contains reset-password and a token
    // This handles cases where user directly navigates to the URL (not from email link in new tab)
    if (token && (path.includes('reset-password') || fullUrl.includes('reset-password'))) {
      setShowPasswordReset(true);
    }
  }, []);

  // Handle password reset close
  const handlePasswordResetClose = (email?: string) => {
    setShowPasswordReset(false);
    // Clear the token from URL
    const url = new URL(window.location.href);
    url.searchParams.delete('token');
    window.history.pushState({}, '', url);
    // Open login modal with the email if provided
    if (email) {
      setLoginEmail(email);
    }
    setIsAuthModalOpen(true);
    setAuthModalMode('login');
  };

  // Listen for verification messages from email and handle tab coordination
  useEffect(() => {
    // Check if BroadcastChannel is supported
    if (typeof BroadcastChannel === 'undefined') {
      console.error('[App] BroadcastChannel is not supported in this browser!');
      return;
    }

    const channel = new BroadcastChannel('compareintel-verification');
    let hasExistingTab = false;

    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'verify-email' && event.data.token) {
        // An existing tab (this one) received a verification token from a new tab
        // Update URL without page reload and trigger verification
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('token', event.data.token);
        window.history.pushState({}, '', newUrl);

        // Set the token to trigger verification in VerifyEmail component
        setVerificationToken(event.data.token);

        // Focus this tab
        window.focus();
      } else if (event.data.type === 'password-reset' && event.data.token) {
        // An existing tab (this one) received a password reset token from a new tab
        // Close the "Check Your Email" dialog if it's open
        setIsAuthModalOpen(false);

        // Update URL without page reload
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('token', event.data.token);
        if (!newUrl.pathname.includes('reset-password')) {
          newUrl.pathname = '/reset-password';
        }
        window.history.pushState({}, '', newUrl);

        // Show the password reset form
        setShowPasswordReset(true);

        // Focus this tab
        window.focus();
      } else if (event.data.type === 'ping') {
        // Another tab is checking if we exist - always respond for both email verification and password reset
        hasExistingTab = true;
        channel.postMessage({ type: 'pong' });
      } else if (event.data.type === 'pong') {
        // An existing tab responded to our ping
        hasExistingTab = true;
      }
    };

    channel.addEventListener('message', handleMessage);

    // Check if this is a verification page opened from email
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const path = window.location.pathname;
    const fullUrl = window.location.href;
    const isPasswordReset = path.includes('reset-password') || fullUrl.includes('reset-password');

    if (token && window.opener === null) {
      // This is a new tab opened from email with a token
      // Use tab coordination for both email verification AND password reset

      // Note: suppressVerification is already true from initial state

      // Ping to see if there's an existing CompareIntel tab
      channel.postMessage({ type: 'ping' });

      // Wait a moment to see if any existing tab responds
      setTimeout(() => {
        if (hasExistingTab) {
          // An existing tab exists - send the token to it and close this tab
          if (isPasswordReset) {
            // Send password reset token
            channel.postMessage({
              type: 'password-reset',
              token: token
            });
          } else {
            // Send email verification token
            channel.postMessage({
              type: 'verify-email',
              token: token
            });
          }

          // Give the existing tab time to process, then close this tab
          setTimeout(() => {
            window.close();
          }, 500);
        } else {
          // No existing tab found - handle in this tab
          if (isPasswordReset) {
            setShowPasswordReset(true);
            setSuppressVerification(false);
          } else {
            setSuppressVerification(false);
          }
        }
      }, 200);
    }

    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
    };
  }, []);

  // Fetch anonymous mock mode setting for anonymous users (development only)
  useEffect(() => {
    const fetchAnonymousMockModeSetting = async () => {
      // Only fetch for anonymous users in development mode
      if (isAuthenticated || !import.meta.env.DEV) {
        return;
      }

      try {
        const response = await fetch(`${API_URL}/anonymous-mock-mode-status`);
        if (response.ok) {
          const data = await response.json();
          if (data.is_development && data.anonymous_mock_mode_enabled) {
            setAnonymousMockModeEnabled(true);
          } else {
            setAnonymousMockModeEnabled(false);
          }
        }
      } catch {
        // Silently fail - this is a development-only feature
      }
    };

    fetchAnonymousMockModeSetting();
  }, [isAuthenticated]);

  // Screenshot handler for message area only
  const showNotification = (msg: string, type: 'success' | 'error' = 'success') => {
    const notif = document.createElement('div');

    // Create container with icon and text
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.gap = '12px';

    // Add icon
    const icon = document.createElement('div');
    icon.innerHTML = type === 'success' ? '✓' : '✕';
    icon.style.fontSize = '1.1rem';
    icon.style.fontWeight = 'bold';
    icon.style.display = 'flex';
    icon.style.alignItems = 'center';
    icon.style.justifyContent = 'center';
    icon.style.width = '24px';
    icon.style.height = '24px';
    icon.style.borderRadius = '50%';
    icon.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    icon.style.backdropFilter = 'blur(8px)';

    // Add text
    const text = document.createElement('span');
    text.textContent = msg;
    text.style.fontWeight = '500';
    text.style.fontSize = '0.95rem';
    text.style.letterSpacing = '0.025em';

    container.appendChild(icon);
    container.appendChild(text);
    notif.appendChild(container);

    // Main notification styling
    notif.style.position = 'fixed';
    notif.style.top = '24px';
    notif.style.right = '24px';
    notif.style.zIndex = '9999';
    notif.style.padding = '16px 24px';
    notif.style.borderRadius = '16px';
    notif.style.background = type === 'success' ?
      'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)' :
      'linear-gradient(135deg, #ef4444 0%, #f87171 100%)';
    notif.style.color = 'white';
    notif.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(255, 255, 255, 0.1)';
    notif.style.backdropFilter = 'blur(16px)';
    notif.style.border = '1px solid rgba(255, 255, 255, 0.2)';
    notif.style.pointerEvents = 'none';
    notif.style.transform = 'translateX(100%) scale(0.9)';
    notif.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
    notif.style.opacity = '0';
    notif.style.maxWidth = '400px';
    notif.style.minWidth = '280px';

    document.body.appendChild(notif);

    // Animate in
    requestAnimationFrame(() => {
      notif.style.transform = 'translateX(0) scale(1)';
      notif.style.opacity = '1';
    });

    // Animate out
    setTimeout(() => {
      notif.style.transform = 'translateX(100%) scale(0.9)';
      notif.style.opacity = '0';
      setTimeout(() => notif.remove(), 400);
    }, 3000);
  };

  // Sanitize modelId for HTML id and selector
  const getSafeId = (modelId: string) => modelId.replace(/[^a-zA-Z0-9_-]/g, '-');

  // Helper to check if element is scrolled to bottom (within 50px threshold)
  const isScrolledToBottom = (element: HTMLElement): boolean => {
    const threshold = 50; // px tolerance
    return element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
  };

  // Setup scroll listener for a model to detect user scrolling
  // Returns true if successful, false if element not found
  const setupScrollListener = (modelId: string): boolean => {
    const safeId = getSafeId(modelId);
    const expectedId = `conversation-content-${safeId}`;

    const conversationContent = document.querySelector(`#${expectedId}`) as HTMLElement;

    if (!conversationContent) {
      return false;
    }

    // Remove existing listeners if any
    const existingListeners = scrollListenersRef.current.get(modelId);
    if (existingListeners) {
      conversationContent.removeEventListener('scroll', existingListeners.scroll);
      conversationContent.removeEventListener('wheel', existingListeners.wheel);
      conversationContent.removeEventListener('touchstart', existingListeners.touchstart);
      conversationContent.removeEventListener('mousedown', existingListeners.mousedown);
    }

    // Initialize last scroll position
    lastScrollTopRef.current.set(modelId, conversationContent.scrollTop);

    // Handle mouse wheel - immediate indication of user interaction
    const handleWheel = (e: WheelEvent) => {
      const isAtTop = conversationContent.scrollTop === 0;
      const isAtBottom = isScrolledToBottom(conversationContent);

      // If at top and scrolling up, or at bottom and scrolling down, manually scroll the window
      if ((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0)) {
        // Manually scroll the window to allow continuation of scrolling beyond card boundaries
        window.scrollBy({
          top: e.deltaY * 0.5, // Scale down the scroll amount slightly for smoother UX
          left: 0,
          behavior: 'auto'
        });
        // Continue to let the event propagate naturally as well
        return;
      }

      // IMMEDIATELY pause auto-scroll when user scrolls
      autoScrollPausedRef.current.add(modelId);

      userInteractingRef.current.add(modelId);

      // Check scroll position after wheel event to potentially resume
      setTimeout(() => {
        if (isScrolledToBottom(conversationContent)) {
          // User scrolled to bottom - resume auto-scroll
          autoScrollPausedRef.current.delete(modelId);
        }
        // If not at bottom, keep it paused (already set above)
        userInteractingRef.current.delete(modelId);
      }, 75);
    };

    // Handle touch start - immediate indication of user interaction
    const handleTouchStart = () => {
      // IMMEDIATELY pause auto-scroll when user touches to scroll
      autoScrollPausedRef.current.add(modelId);

      userInteractingRef.current.add(modelId);

      // Check scroll position after touch to potentially resume
      setTimeout(() => {
        if (isScrolledToBottom(conversationContent)) {
          // User scrolled to bottom - resume auto-scroll
          autoScrollPausedRef.current.delete(modelId);
        }
        // If not at bottom, keep it paused (already set above)
        userInteractingRef.current.delete(modelId);
      }, 75);
    };

    // Handle mousedown on scrollbar - user is clicking/dragging scrollbar
    const handleMouseDown = () => {
      // IMMEDIATELY pause auto-scroll when user clicks scrollbar
      autoScrollPausedRef.current.add(modelId);

      userInteractingRef.current.add(modelId);

      // Check scroll position after mousedown to potentially resume
      setTimeout(() => {
        if (isScrolledToBottom(conversationContent)) {
          // User scrolled to bottom - resume auto-scroll
          autoScrollPausedRef.current.delete(modelId);
        }
        userInteractingRef.current.delete(modelId);
      }, 75);
    };

    // Handle scroll event - detect if scrolling upward (user interaction)
    const handleScroll = () => {
      const lastScrollTop = lastScrollTopRef.current.get(modelId) || 0;
      const currentScrollTop = conversationContent.scrollTop;

      // If scrolling up (position decreased), it's likely user interaction
      if (currentScrollTop < lastScrollTop) {
        // User scrolled up - pause auto-scroll
        autoScrollPausedRef.current.add(modelId);
      } else if (isScrolledToBottom(conversationContent)) {
        // Scrolled to bottom - resume auto-scroll
        autoScrollPausedRef.current.delete(modelId);
      }

      // Update last scroll position
      lastScrollTopRef.current.set(modelId, currentScrollTop);

      // If scroll lock is enabled, sync this scroll to all other cards
      if (!isScrollLockedRef.current) {
        return;
      }

      // If we're already in a sync operation, check if this is a new user scroll
      // This prevents infinite loops when programmatic scrolls trigger scroll events
      if (syncingFromElementRef.current !== null) {
        // If a different element is trying to scroll, check if it's user-initiated
        if (syncingFromElementRef.current !== conversationContent) {
          // Check if enough time has passed since the last sync to allow new user scrolling
          const timeSinceLastSync = Date.now() - lastSyncTimeRef.current;
          if (timeSinceLastSync < 100) {
            // Very recent sync - likely programmatic, skip it
            return;
          } else {
            // Enough time has passed, this is likely a new user scroll on a different pane
            syncingFromElementRef.current = null;
          }
        }
      }

      // Mark this element as the one initiating the sync
      syncingFromElementRef.current = conversationContent;
      lastSyncTimeRef.current = Date.now();

      // Get all conversation content elements
      const allConversations = document.querySelectorAll('[id^="conversation-content-"]');

      // Store the scroll position as a percentage to account for different content heights
      const scrollHeight = conversationContent.scrollHeight - conversationContent.clientHeight;
      const scrollPercentage = scrollHeight > 0 ? conversationContent.scrollTop / scrollHeight : 0;

      // Sync all other cards
      allConversations.forEach((element) => {
        const el = element as HTMLElement;
        // Don't sync to the element that triggered this scroll
        if (el !== conversationContent) {
          const targetScrollHeight = el.scrollHeight - el.clientHeight;
          if (targetScrollHeight > 0) {
            const targetScrollTop = scrollPercentage * targetScrollHeight;
            el.scrollTop = targetScrollTop;
          }
        }
      });

      // Reset the flag after a delay to allow all programmatic scroll events to complete
      setTimeout(() => {
        syncingFromElementRef.current = null;
      }, 300);
    };

    // Add all listeners
    conversationContent.addEventListener('wheel', handleWheel, { passive: true });
    conversationContent.addEventListener('touchstart', handleTouchStart, { passive: true });
    conversationContent.addEventListener('mousedown', handleMouseDown, { passive: true });
    conversationContent.addEventListener('scroll', handleScroll, { passive: true });

    scrollListenersRef.current.set(modelId, {
      scroll: handleScroll,
      wheel: handleWheel,
      touchstart: handleTouchStart,
      mousedown: handleMouseDown
    });

    return true;
  };

  // Cleanup scroll listener for a model
  const cleanupScrollListener = (modelId: string) => {
    const safeId = getSafeId(modelId);
    const conversationContent = document.querySelector(`#conversation-content-${safeId}`) as HTMLElement;
    const listeners = scrollListenersRef.current.get(modelId);

    if (conversationContent && listeners) {
      conversationContent.removeEventListener('scroll', listeners.scroll);
      conversationContent.removeEventListener('wheel', listeners.wheel);
      conversationContent.removeEventListener('touchstart', listeners.touchstart);
      conversationContent.removeEventListener('mousedown', listeners.mousedown);
    }
    scrollListenersRef.current.delete(modelId);
    userInteractingRef.current.delete(modelId);
    lastScrollTopRef.current.delete(modelId);
  };

  const handleScreenshot = async (modelId: string) => {
    const safeId = getSafeId(modelId);
    const content = document.querySelector(`#conversation-content-${safeId}`) as HTMLElement | null;
    if (!content) {
      showNotification('Screenshot target not found.', 'error');
      return;
    }

    // Store original styles that we'll modify
    const prevOverflow = content.style.overflow;
    const prevMaxHeight = content.style.maxHeight;

    // Expand to show all content
    content.style.overflow = 'visible';
    content.style.maxHeight = 'none';

    // Force a repaint to ensure all styles are applied
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      // Dynamically import html-to-image
      const htmlToImage = await import("html-to-image");
      const toBlob = htmlToImage.toBlob;

      // Use html-to-image which typically preserves colors better
      const blob = await toBlob(content, {
        pixelRatio: 2, // High quality
        backgroundColor: '#ffffff',
        cacheBust: true,
        style: {
          // Ensure the element is fully visible
          overflow: 'visible',
          maxHeight: 'none',
        }
      });

      if (blob && navigator.clipboard && window.ClipboardItem) {
        try {
          await navigator.clipboard.write([
            new window.ClipboardItem({ 'image/png': blob })
          ]);
          showNotification('Screenshot copied to clipboard!', 'success');
        } catch {
          showNotification('Clipboard copy failed. Image downloaded instead.', 'error');
          const link = document.createElement('a');
          link.download = `model_${safeId}_messages.png`;
          link.href = URL.createObjectURL(blob);
          link.click();
          URL.revokeObjectURL(link.href);
        }
      } else if (blob) {
        showNotification('Clipboard not supported. Image downloaded.', 'error');
        const link = document.createElement('a');
        link.download = `model_${safeId}_messages.png`;
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
      } else {
        showNotification('Could not create image blob.', 'error');
      }
    } catch (err) {
      showNotification('Screenshot failed: ' + (err as Error).message, 'error');
    } finally {
      // Restore original styles
      content.style.overflow = prevOverflow;
      content.style.maxHeight = prevMaxHeight;
    }
  };

  const handleCopyResponse = async (modelId: string) => {
    // Find the conversation for this model
    const conversation = conversations.find(conv => conv.modelId === modelId);
    if (!conversation) {
      showNotification('Model response not found.', 'error');
      return;
    }

    if (conversation.messages.length === 0) {
      showNotification('No messages to copy.', 'error');
      return;
    }

    // Format the entire conversation history
    const formattedHistory = conversation.messages
      .map((msg) => {
        const label = msg.type === 'user' ? 'You' : 'AI';
        const timestamp = new Date(msg.timestamp).toLocaleTimeString();
        return `[${label}] ${timestamp}\n${msg.content}`;
      })
      .join('\n\n---\n\n');

    try {
      await navigator.clipboard.writeText(formattedHistory);
      showNotification('Raw conversation copied to clipboard!', 'success');
    } catch (err) {
      showNotification('Failed to copy to clipboard.', 'error');
      console.error('Copy failed:', err);
    }
  };
  const [response, setResponse] = useState<CompareResponse | null>(null);
  const [input, setInput] = useState('');
  const [isExtendedMode, setIsExtendedMode] = useState(false);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedModelsGridRef = useRef<HTMLDivElement>(null);
  const [modelsByProvider, setModelsByProvider] = useState<ModelsByProvider>({});
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [openDropdowns, setOpenDropdowns] = useState<Set<string>>(new Set());
  const [processingTime, setProcessingTime] = useState<number | null>(null);
  const [currentAbortController, setCurrentAbortController] = useState<AbortController | null>(null);
  const [closedCards, setClosedCards] = useState<Set<string>>(new Set());
  const [conversations, setConversations] = useState<ModelConversation[]>([]);
  const [isFollowUpMode, setIsFollowUpMode] = useState(false);

  // Conversation history state
  interface ConversationSummary {
    id: string | number;
    input_data: string;
    models_used: string[];
    created_at: string;
    message_count?: number;
  }

  const [conversationHistory, setConversationHistory] = useState<ConversationSummary[]>([]);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  // Track the ID of the currently visible comparison to highlight it in history dropdown
  const [currentVisibleComparisonId, setCurrentVisibleComparisonId] = useState<string | null>(null);

  // Get history limit based on tier - use useMemo to ensure it updates when user/auth changes
  const historyLimit = useMemo(() => {
    if (!isAuthenticated || !user) return 2; // Anonymous
    const tier = user.subscription_tier || 'free';
    const limits: { [key: string]: number } = {
      anonymous: 2,
      free: 3,
      starter: 10,
      starter_plus: 20,
      pro: 50,
      pro_plus: 100,
    };
    return limits[tier] || 2;
  }, [isAuthenticated, user]);
  const [, setUserMessageTimestamp] = useState<string>('');
  const [originalSelectedModels, setOriginalSelectedModels] = useState<string[]>([]);
  const userCancelledRef = useRef(false);
  const followUpJustActivatedRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastAlignedRoundRef = useRef<number>(0); // Track which round was last aligned
  const [showDoneSelectingCard, setShowDoneSelectingCard] = useState(false);
  const modelsSectionRef = useRef<HTMLDivElement>(null);
  const compareButtonRef = useRef<HTMLButtonElement>(null);
  const [isAnimatingButton, setIsAnimatingButton] = useState(false);
  const [isAnimatingTextarea, setIsAnimatingTextarea] = useState(false);
  const animationTimeoutRef = useRef<number | null>(null);

  // Auto-scroll control state - tracks which models have auto-scroll paused by user
  const autoScrollPausedRef = useRef<Set<string>>(new Set()); // Ref for immediate access without state delay
  const scrollListenersRef = useRef<Map<string, { scroll: () => void; wheel: (e: WheelEvent) => void; touchstart: () => void; mousedown: () => void }>>(new Map());
  const userInteractingRef = useRef<Set<string>>(new Set()); // Track which models user is actively interacting with
  const lastScrollTopRef = useRef<Map<string, number>>(new Map()); // Track last scroll position to detect user scrolling

  // Freemium usage tracking state
  const [usageCount, setUsageCount] = useState(0);
  const [extendedUsageCount, setExtendedUsageCount] = useState(0);
  const [browserFingerprint, setBrowserFingerprint] = useState('');
  const [isModelsHidden, setIsModelsHidden] = useState(false);

  // Tab switching state - tracks active tab for each conversation
  const [activeResultTabs, setActiveResultTabs] = useState<{ [modelId: string]: 'formatted' | 'raw' }>({});

  // Scroll lock state - when enabled, all model result cards scroll together
  const [isScrollLocked, setIsScrollLocked] = useState(false);
  const isScrollLockedRef = useRef(false); // Ref to allow listeners to access current state without closure issues
  const syncingFromElementRef = useRef<HTMLElement | null>(null); // Element currently initiating a sync (prevents infinite scroll loops)
  const lastSyncTimeRef = useRef<number>(0); // Timestamp of last sync to differentiate user scrolls from programmatic scrolls

  // Keep ref in sync with state
  useEffect(() => {
    isScrollLockedRef.current = isScrollLocked;

    // When scroll lock is enabled, align all cards to the first card's scroll position
    if (isScrollLocked && conversations.length > 0) {
      const allConversations = document.querySelectorAll('[id^="conversation-content-"]');
      if (allConversations.length > 0) {
        const firstCard = allConversations[0] as HTMLElement;

        // Mark the first card as the sync source
        syncingFromElementRef.current = firstCard;

        const firstScrollHeight = firstCard.scrollHeight - firstCard.clientHeight;
        const scrollPercentage = firstScrollHeight > 0 ? firstCard.scrollTop / firstScrollHeight : 0;

        // Sync all other cards to the first card's scroll percentage
        allConversations.forEach((element, index) => {
          if (index > 0) {
            const el = element as HTMLElement;
            const targetScrollHeight = el.scrollHeight - el.clientHeight;
            if (targetScrollHeight > 0) {
              const targetScrollTop = scrollPercentage * targetScrollHeight;
              el.scrollTop = targetScrollTop;
            }
          }
        });

        // Reset after alignment is complete
        setTimeout(() => {
          syncingFromElementRef.current = null;
        }, 100);
      }
    }
  }, [isScrollLocked, conversations]);

  // Setup scroll listeners when conversations are rendered
  useEffect(() => {
    conversations.forEach((conversation) => {
      // Check if listener is already set up
      if (!scrollListenersRef.current.has(conversation.modelId)) {
        const maxAttempts = 5;
        let attempt = 0;

        const trySetup = () => {
          attempt++;
          const success = setupScrollListener(conversation.modelId);
          if (!success && attempt < maxAttempts) {
            setTimeout(trySetup, 100 * attempt);
          }
        };

        // Try immediately
        trySetup();
      }
    });

    // Clean up listeners for models that are no longer in conversations
    const activeModelIds = new Set(conversations.map(c => c.modelId));
    scrollListenersRef.current.forEach((_, modelId) => {
      if (!activeModelIds.has(modelId)) {
        cleanupScrollListener(modelId);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations]);

  // Developer reset function
  const resetUsage = async () => {
    try {
      // Save currently displayed conversations to preserve them after reset
      const currentDisplayedConversations = [...conversations];
      const currentDisplayedComparisonId = currentVisibleComparisonId;

      // Reset backend rate limits (dev only)
      const url = browserFingerprint
        ? `${API_URL}/dev/reset-rate-limit?fingerprint=${encodeURIComponent(browserFingerprint)}`
        : `${API_URL}/dev/reset-rate-limit`;

      // Prepare headers with auth token if available
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const accessToken = localStorage.getItem('access_token');
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers
      });

      if (response.ok) {
        setError(null);

        if (isAuthenticated) {
          // Authenticated user: backend handles database cleanup
          // Clear history but preserve currently displayed results
          setConversationHistory([]);
          // Restore the currently displayed conversations
          setConversations(currentDisplayedConversations);
          // Keep the current visible comparison ID if there's a visible comparison
          if (currentDisplayedConversations.length > 0 && currentDisplayedComparisonId) {
            setCurrentVisibleComparisonId(currentDisplayedComparisonId);
          } else {
            setCurrentVisibleComparisonId(null);
          }

          // Refresh user data to show updated usage from backend
          await refreshUser();
        } else {
          // Anonymous user: clear localStorage and reset UI state
          // Reset usage counts
          setUsageCount(0);
          setExtendedUsageCount(0);
          localStorage.removeItem('compareai_usage');
          localStorage.removeItem('compareai_extended_usage');

          // Clear all conversation history from localStorage
          localStorage.removeItem('compareai_conversation_history');
          // Clear all individual conversation data
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('compareai_conversation_')) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key));

          // Clear history but preserve currently displayed results
          setConversationHistory([]);
          // Restore the currently displayed conversations
          setConversations(currentDisplayedConversations);
          // Keep the current visible comparison ID if there's a visible comparison
          if (currentDisplayedConversations.length > 0 && currentDisplayedComparisonId) {
            setCurrentVisibleComparisonId(currentDisplayedComparisonId);
          } else {
            setCurrentVisibleComparisonId(null);
          }
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error(`Failed to reset: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Reset error:', error);
      console.error('Failed to reset rate limits. Make sure the backend is running.');
    }
  };

  // Sync extendedUsageCount with user data when user changes
  useEffect(() => {
    if (isAuthenticated && user) {
      setExtendedUsageCount(user.daily_extended_usage || 0);
    }
  }, [isAuthenticated, user]);

  // Automatically disable extended mode when limits are reached
  useEffect(() => {
    if (!isExtendedMode) return; // Only check if extended mode is on

    // Define regular limits for each tier
    const REGULAR_LIMITS: { [key: string]: number } = {
      anonymous: 10,
      free: 20,
      starter: 50,
      starter_plus: 100,
      pro: 200,
      pro_plus: 400
    };

    const userTier = isAuthenticated ? user?.subscription_tier || 'free' : 'anonymous';
    const regularLimit = REGULAR_LIMITS[userTier] || REGULAR_LIMITS.anonymous;
    const extendedLimit = EXTENDED_TIER_LIMITS[userTier] || EXTENDED_TIER_LIMITS.anonymous;

    // Calculate current usage
    const currentRegularUsage = isAuthenticated && user
      ? user.daily_usage_count
      : usageCount;
    const currentExtendedUsage = isAuthenticated && user
      ? user.daily_extended_usage
      : extendedUsageCount;

    const regularRemaining = regularLimit - currentRegularUsage;
    const hasReachedExtendedLimit = currentExtendedUsage >= extendedLimit;
    const hasNoRemainingRegularResponses = regularRemaining <= 0;

    // Auto-disable if limits reached
    if (hasNoRemainingRegularResponses || hasReachedExtendedLimit) {
      setIsExtendedMode(false);
    }
  }, [isExtendedMode, isAuthenticated, user, usageCount, extendedUsageCount]);

  // Tier recommendation function
  const getExtendedRecommendation = (inputText: string): boolean => {
    if (!inputText.trim()) return false;

    const text = inputText.toLowerCase();
    const length = inputText.length;

    const extendedKeywords = [
      'detailed', 'comprehensive', 'thorough', 'complete', 'full analysis', 'deep dive',
      'explain in detail', 'comprehensive analysis', 'thorough explanation', 'complete guide',
      'step by step', 'tutorial', 'guide', 'documentation', 'research', 'analysis',
      'compare and contrast', 'pros and cons', 'advantages and disadvantages',
      'code review', 'debug', 'optimize', 'refactor', 'architecture', 'design pattern'
    ];

    const hasExtendedKeywords = extendedKeywords.some(keyword => text.includes(keyword));

    return length > 3000 || hasExtendedKeywords;
  };

  // Get all models in a flat array for compatibility
  const allModels = Object.values(modelsByProvider).flat();

  // Load conversation history from localStorage (anonymous users)
  const loadHistoryFromLocalStorage = useCallback((): ConversationSummary[] => {
    try {
      const stored = localStorage.getItem('compareai_conversation_history');
      if (stored) {
        const history = JSON.parse(stored) as ConversationSummary[];
        // Sort by created_at DESC
        // Don't limit here - let the dropdown filtering and slicing handle the limit
        // This ensures we have enough items even after filtering out the active conversation
        return history
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
    } catch (e) {
      console.error('Failed to load conversation history from localStorage:', e);
    }
    return [];
  }, []);

  // Save conversation to localStorage (anonymous users)
  // Returns the conversationId of the saved conversation
  const saveConversationToLocalStorage = (inputData: string, modelsUsed: string[], conversationsToSave: ModelConversation[], isUpdate: boolean = false): string => {
    try {
      const history = loadHistoryFromLocalStorage();

      // Count total messages across all conversations
      const totalMessages = conversationsToSave.reduce((sum, conv) => sum + conv.messages.length, 0);

      let conversationId: string;
      let existingConversation: ConversationSummary | undefined;

      if (isUpdate) {
        // Find existing conversation by matching first user message and models
        existingConversation = history.find(conv => {
          const modelsMatch = JSON.stringify(conv.models_used.sort()) === JSON.stringify(modelsUsed.sort());
          // Check if the input_data matches (first query)
          // OR check if any stored conversation has a first user message matching this inputData
          if (modelsMatch) {
            // Load the conversation to check its first user message
            try {
              const storedData = localStorage.getItem(`compareai_conversation_${conv.id}`);
              if (storedData) {
                const parsed = JSON.parse(storedData) as { messages?: StoredMessage[]; input_data?: string };
                // Check if the first user message in stored data matches our inputData
                const firstStoredUserMsg = parsed.messages?.find((m: StoredMessage) => m.role === 'user');
                if (firstStoredUserMsg && firstStoredUserMsg.content === inputData) {
                  return true;
                }
                // Also check if input_data field matches
                if (parsed.input_data === inputData) {
                  return true;
                }
              }
            } catch {
              // If we can't parse, fall back to input_data match
              return conv.input_data === inputData;
            }
          }
          return false;
        });

        if (existingConversation) {
          conversationId = String(existingConversation.id);
        } else {
          // Couldn't find existing, create new (shouldn't happen)
          conversationId = Date.now().toString();
          isUpdate = false;
        }
      } else {
        // Create new conversation
        conversationId = Date.now().toString();
      }

      // Create or update conversation summary
      const conversationSummary: ConversationSummary = existingConversation ? {
        ...existingConversation,
        message_count: totalMessages,
        // Keep original created_at for existing conversations
      } : {
        id: conversationId,
        input_data: inputData,
        models_used: modelsUsed,
        created_at: new Date().toISOString(),
        message_count: totalMessages,
      };

      // Update history list
      let updatedHistory: ConversationSummary[];
      if (isUpdate && existingConversation) {
        // Update existing entry in place
        updatedHistory = history.map(conv =>
          conv.id === conversationId ? conversationSummary : conv
        );
      } else {
        // Remove any existing conversation with the same input and models (to prevent duplicates)
        const filteredHistory = history.filter(conv =>
          !(conv.input_data === inputData &&
            JSON.stringify(conv.models_used.sort()) === JSON.stringify(modelsUsed.sort()))
        );

        // For new conversations: add the new one and limit to 2 most recent after sorting
        // When user has A & B and runs C, comparison C appears at top and A is deleted
        // Always add the new conversation - we'll limit to 2 most recent after sorting
        filteredHistory.unshift(conversationSummary);
        updatedHistory = filteredHistory;
      }

      // Sort by created_at DESC
      const sorted = updatedHistory.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // For anonymous users, save maximum of 2 conversations
      // When comparison 3 is made, comparison 1 is deleted and comparison 3 appears at the top
      // Keep only the 2 most recent conversations
      const limited = sorted.slice(0, 2);

      // Store summary list (save maximum 2 in localStorage)
      localStorage.setItem('compareai_conversation_history', JSON.stringify(limited));

      // Store full conversation data with ID as key
      // Format: messages with role and model_id for proper reconstruction
      const conversationMessages: StoredMessage[] = [];
      const seenUserMessages = new Set<string>(); // Track user messages to avoid duplicates

      // Group messages from conversations by model
      conversationsToSave.forEach(conv => {
        conv.messages.forEach(msg => {
          if (msg.type === 'user') {
            // Deduplicate user messages - same content and timestamp (within 1 second) = same message
            const userKey = `${msg.content}-${new Date(msg.timestamp).getTime()}`;
            if (!seenUserMessages.has(userKey)) {
              seenUserMessages.add(userKey);
              conversationMessages.push({
                role: 'user',
                content: msg.content,
                created_at: msg.timestamp,
              });
            }
          } else {
            conversationMessages.push({
              role: 'assistant',
              model_id: conv.modelId,
              content: msg.content,
              created_at: msg.timestamp,
            });
          }
        });
      });

      // Get existing conversation data to preserve created_at if updating
      const existingData = isUpdate && existingConversation
        ? JSON.parse(localStorage.getItem(`compareai_conversation_${conversationId}`) || '{}')
        : null;

      localStorage.setItem(`compareai_conversation_${conversationId}`, JSON.stringify({
        input_data: inputData, // Always keep first query as input_data
        models_used: modelsUsed,
        created_at: existingData?.created_at || conversationSummary.created_at,
        messages: conversationMessages,
      }));

      // Delete full conversation data for any conversations that are no longer in the limited list
      // This ensures we only keep data for the 2 most recent comparisons
      const limitedIds = new Set(limited.map(conv => conv.id));
      const keysToDelete: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('compareai_conversation_') && key !== 'compareai_conversation_history') {
          // Extract the conversation ID from the key (format: compareai_conversation_{id})
          const convId = key.replace('compareai_conversation_', '');
          if (!limitedIds.has(convId)) {
            keysToDelete.push(key);
          }
        }
      }
      // Delete the old conversation data
      keysToDelete.forEach(key => {
        localStorage.removeItem(key);
        console.log(`🗑️ Deleted old conversation data: ${key}`);
      });

      // Reload all saved conversations from localStorage to state
      // This ensures dropdown can show all saved conversations, and filtering/slicing handles the display limit
      const reloadedHistory = loadHistoryFromLocalStorage();
      setConversationHistory(reloadedHistory);

      return conversationId;
    } catch (e) {
      console.error('Failed to save conversation to localStorage:', e);
      return '';
    }
  };

  // Load conversation history from API (authenticated users)
  const loadHistoryFromAPI = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoadingHistory(true);
    try {
      const accessToken = localStorage.getItem('access_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch(`${API_URL}/conversations`, {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        // Ensure created_at is a string if it's not already, and models_used is always an array
        const formattedData: ConversationSummary[] = Array.isArray(data) ? data.map((item) => {
          const summary: ConversationSummary = {
            ...item,
            created_at: typeof item.created_at === 'string' ? item.created_at : new Date(item.created_at).toISOString(),
            models_used: Array.isArray(item.models_used) ? item.models_used : [],
          };
          return summary;
        }) : [];
        setConversationHistory(formattedData);
      } else {
        const errorText = await response.text();
        console.error('Failed to load conversation history:', response.status, response.statusText, errorText);
        setConversationHistory([]);
      }
    } catch (e) {
      console.error('Failed to load conversation history from API:', e);
      setConversationHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [isAuthenticated]);

  // Delete conversation from API (authenticated users) or localStorage (anonymous users)
  const deleteConversation = useCallback(async (summary: ConversationSummary, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the loadConversation onClick

    // Check if the deleted item is the currently active comparison
    const isActiveItem = currentVisibleComparisonId && String(summary.id) === currentVisibleComparisonId;

    if (isAuthenticated && typeof summary.id === 'number') {
      // Delete from API
      try {
        const accessToken = localStorage.getItem('access_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`;
        }

        const response = await fetch(`${API_URL}/conversations/${summary.id}`, {
          method: 'DELETE',
          headers,
        });

        if (response.ok) {
          // If this was the active item, reset screen to default BEFORE reloading history
          // This prevents any auto-loading logic from triggering
          if (isActiveItem) {
            setIsFollowUpMode(false);
            setInput('');
            setConversations([]);
            setResponse(null);
            setClosedCards(new Set());
            setError(null);
            setSelectedModels([]); // Unselect all models
            setOriginalSelectedModels([]);
            setIsModelsHidden(false);
            setOpenDropdowns(new Set()); // Close all provider dropdowns
            setCurrentVisibleComparisonId(null);
          }

          // Reload history from API after reset
          await loadHistoryFromAPI();
        } else {
          console.error('Failed to delete conversation:', response.statusText);
        }
      } catch (e) {
        console.error('Failed to delete conversation from API:', e);
      }
    } else if (!isAuthenticated && typeof summary.id === 'string') {
      // Delete from localStorage
      try {
        // Remove the conversation data
        localStorage.removeItem(`compareai_conversation_${summary.id}`);

        // If this was the active item, reset screen to default BEFORE updating history
        // This prevents any auto-loading logic from triggering
        if (isActiveItem) {
          setIsFollowUpMode(false);
          setInput('');
          setConversations([]);
          setResponse(null);
          setClosedCards(new Set());
          setError(null);
          setSelectedModels([]); // Unselect all models
          setOriginalSelectedModels([]);
          setIsModelsHidden(false);
          setOpenDropdowns(new Set()); // Close all provider dropdowns
          setCurrentVisibleComparisonId(null);
        }

        // Update state using functional update to ensure we work with latest state
        setConversationHistory((prevHistory) => {
          const updatedHistory = prevHistory.filter(conv => conv.id !== summary.id);
          // Sync localStorage with the updated state
          localStorage.setItem('compareai_conversation_history', JSON.stringify(updatedHistory));
          return updatedHistory;
        });
      } catch (e) {
        console.error('Failed to delete conversation from localStorage:', e);
      }
    }
  }, [isAuthenticated, loadHistoryFromAPI, currentVisibleComparisonId]);

  // Load full conversation from localStorage (anonymous users)
  const loadConversationFromLocalStorage = (id: string): { input_data: string; models_used: string[]; messages: StoredMessage[] } | null => {
    try {
      const stored = localStorage.getItem(`compareai_conversation_${id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed;
      } else {
        console.warn('No conversation found in localStorage for id:', id);
      }
    } catch (e) {
      console.error('Failed to load conversation from localStorage:', e, { id });
    }
    return null;
  };

  // Load full conversation from API (authenticated users)
  const loadConversationFromAPI = async (id: number): Promise<{ input_data: string; models_used: string[]; messages: StoredMessage[] } | null> => {
    if (!isAuthenticated) return null;

    try {
      const accessToken = localStorage.getItem('access_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch(`${API_URL}/conversations/${id}`, {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        return {
          input_data: data.input_data,
          models_used: data.models_used,
          messages: data.messages,
        };
      } else {
        console.error('Failed to load conversation:', response.statusText);
      }
    } catch (e) {
      console.error('Failed to load conversation from API:', e);
    }
    return null;
  };

  // Load a conversation from history
  const loadConversation = async (summary: ConversationSummary) => {
    setIsLoadingHistory(true);
    try {
      let conversationData: { input_data: string; models_used: string[]; messages: StoredMessage[] } | null = null;

      if (isAuthenticated && typeof summary.id === 'number') {
        conversationData = await loadConversationFromAPI(summary.id);
      } else if (!isAuthenticated && typeof summary.id === 'string') {
        conversationData = loadConversationFromLocalStorage(summary.id);
      }

      if (!conversationData) {
        console.error('Failed to load conversation data', { summary, isAuthenticated });
        return;
      }

      // Store models_used in a local variable to satisfy TypeScript null checks in callbacks
      const modelsUsed = conversationData.models_used;

      // Group messages by model_id
      const messagesByModel: { [key: string]: ConversationMessage[] } = {};

      // Initialize empty arrays for all models
      modelsUsed.forEach((modelId: string) => {
        messagesByModel[modelId] = [];
      });

      // Process messages in strict alternating order: user, then assistant responses for each model
      // Messages are saved grouped by model conversation, so we need to reconstruct the round-based structure

      // Sort all messages by timestamp to ensure proper chronological order
      const sortedMessages = [...conversationData.messages].sort((a, b) =>
        new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      );

      // Group messages into conversation rounds (user message + all assistant responses)
      // User messages should already be deduplicated when saved, so we can process in order
      interface ConversationRound {
        user: StoredMessage;
        assistants: StoredMessage[];
      }
      const rounds: ConversationRound[] = [];
      let currentRound: ConversationRound | null = null;

      sortedMessages.forEach((msg: StoredMessage) => {
        if (msg.role === 'user') {
          // If we have a current round, save it
          if (currentRound && currentRound.user) {
            rounds.push(currentRound);
          }
          // Start a new round - user messages should be deduplicated already when saved
          currentRound = { user: msg, assistants: [] };
        } else if (msg.role === 'assistant' && msg.model_id) {
          // Add assistant message to current round
          if (currentRound) {
            // Check for duplicate assistant messages (same model, content, and timestamp within 1 second)
            const isDuplicate = currentRound.assistants.some(asm =>
              asm.model_id === msg.model_id &&
              asm.content === msg.content &&
              Math.abs(new Date(asm.created_at).getTime() - new Date(msg.created_at).getTime()) < 1000
            );

            if (!isDuplicate) {
              currentRound.assistants.push(msg);
            }
          } else {
            // Edge case: assistant without preceding user message
            // This shouldn't happen, but handle it gracefully
            console.warn('Assistant message without preceding user message:', msg);
          }
        }
      });

      // Don't forget the last round
      if (currentRound) {
        rounds.push(currentRound);
      }

      // Now reconstruct messages for each model based on rounds
      rounds.forEach(round => {
        // Add user message to all models
        modelsUsed.forEach((modelId: string) => {
          messagesByModel[modelId].push({
            id: round.user.id?.toString() || `${Date.now()}-user-${Math.random()}`,
            type: 'user' as const,
            content: round.user.content,
            timestamp: round.user.created_at || new Date().toISOString(),
          });

          // Add assistant message for this specific model if it exists in this round
          const modelAssistant = round.assistants.find(asm => asm.model_id === modelId);
          if (modelAssistant) {
            messagesByModel[modelId].push({
              id: modelAssistant.id?.toString() || `${Date.now()}-${Math.random()}`,
              type: 'assistant' as const,
              content: modelAssistant.content,
              timestamp: modelAssistant.created_at || new Date().toISOString(),
            });
          }
        });
      });

      // Convert to ModelConversation format
      const loadedConversations: ModelConversation[] = modelsUsed.map((modelId: string) => ({
        modelId,
        messages: messagesByModel[modelId] || [],
      }));

      // Set state
      setConversations(loadedConversations);
      // Set selected models - only the models from this conversation, clear all others
      setSelectedModels([...modelsUsed]);

      // Use the first user message as the input reference, but clear textarea for new follow-up
      // The conversation will be referenced by this first query in history
      setInput(''); // Clear textarea so user can type a new follow-up
      setIsFollowUpMode(loadedConversations.some(conv => conv.messages.length > 0));
      setClosedCards(new Set()); // Ensure all result cards are open/visible
      setResponse(null); // Clear any previous response state
      setShowHistoryDropdown(false);
      setIsModelsHidden(true); // Collapse the models section when selecting from history

      // Scroll to results section and reset all conversation cards to top
      // Use requestAnimationFrame to ensure DOM is rendered before scrolling
      requestAnimationFrame(() => {
        setTimeout(() => {
          const resultsSection = document.querySelector('.results-section');
          if (resultsSection) {
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }

          // Scroll all conversation content divs to the top
          modelsUsed.forEach((modelId: string) => {
            const safeId = modelId.replace(/[^a-zA-Z0-9_-]/g, '-');
            const conversationContent = document.querySelector(`#conversation-content-${safeId}`) as HTMLElement;
            if (conversationContent) {
              conversationContent.scrollTop = 0;
            }
          });
        }, 200); // Delay to ensure DOM is fully rendered
      });

      // Track this conversation as currently visible so it shows as active in history dropdown
      setCurrentVisibleComparisonId(String(summary.id));

    } catch (e) {
      console.error('Failed to load conversation:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Load history on mount
  useEffect(() => {
    // Clear currently visible comparison ID on mount/login/logout (page refresh or auth change)
    // This ensures saved comparisons appear in history after refresh/login
    setCurrentVisibleComparisonId(null);

    if (isAuthenticated) {
      loadHistoryFromAPI();
    } else {
      const history = loadHistoryFromLocalStorage();
      setConversationHistory(history);
    }
  }, [isAuthenticated, loadHistoryFromAPI, loadHistoryFromLocalStorage]);

  // Refresh history when dropdown is opened for authenticated users
  useEffect(() => {
    if (showHistoryDropdown && isAuthenticated) {
      loadHistoryFromAPI();
    } else if (showHistoryDropdown && !isAuthenticated) {
      const history = loadHistoryFromLocalStorage();
      setConversationHistory(history);
    }
  }, [showHistoryDropdown, isAuthenticated, loadHistoryFromAPI, loadHistoryFromLocalStorage]);

  // Track currently visible comparison ID for authenticated users after history loads
  // This ensures the visible comparison is highlighted in the history dropdown
  // Always try to match and set the ID when history or conversations change
  // BUT: Skip if currentVisibleComparisonId is null and conversations are empty (screen was reset)
  useEffect(() => {
    // Skip auto-matching if we just reset the screen (conversations empty and no current ID)
    if (conversations.length === 0 && !currentVisibleComparisonId) {
      return;
    }

    if (isAuthenticated && conversationHistory.length > 0 && conversations.length > 0) {
      const firstUserMessage = conversations
        .flatMap(conv => conv.messages)
        .filter(msg => msg.type === 'user')
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0];

      if (firstUserMessage && firstUserMessage.content) {
        const matchingConversation = conversationHistory.find(summary => {
          const modelsMatch = JSON.stringify([...summary.models_used].sort()) === JSON.stringify([...selectedModels].sort());
          const inputMatches = summary.input_data === firstUserMessage.content;
          return modelsMatch && inputMatches;
        });

        if (matchingConversation) {
          const matchingId = String(matchingConversation.id);
          // Only update if it's different or not set - this ensures we always track the current visible comparison
          if (currentVisibleComparisonId !== matchingId) {
            setCurrentVisibleComparisonId(matchingId);
          }
        }
      }
    }
  }, [isAuthenticated, conversationHistory, conversations, selectedModels, currentVisibleComparisonId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showHistoryDropdown && !target.closest('.history-toggle-wrapper') && !target.closest('.history-inline-list')) {
        setShowHistoryDropdown(false);
      }
    };

    if (showHistoryDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showHistoryDropdown]);

  // Helper function to create a conversation message
  const createMessage = (type: 'user' | 'assistant', content: string, customTimestamp?: string): ConversationMessage => ({
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    content,
    timestamp: customTimestamp || new Date().toISOString()
  });

  // Helper function to switch tabs for a specific conversation
  const switchResultTab = (modelId: string, tab: 'formatted' | 'raw') => {
    setActiveResultTabs((prev: { [key: string]: 'formatted' | 'raw' }) => ({
      ...prev,
      [modelId]: tab
    }));
  };

  // Scroll to loading section when loading starts
  useEffect(() => {
    if (isLoading) {
      // Small delay to ensure the loading section is rendered
      setTimeout(() => {
        const loadingSection = document.querySelector('.loading-section');
        if (loadingSection) {
          loadingSection.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      }, 100);
    }
  }, [isLoading]);

  // Clear verification-related errors when user becomes verified
  useEffect(() => {
    if (user?.is_verified && error?.includes('verify your email')) {
      setError(null);
    }
  }, [user?.is_verified, error]);

  // Scroll to results section when results are loaded (only once per comparison)
  useEffect(() => {
    if (response && !isFollowUpMode && !hasScrolledToResultsRef.current) {
      // Mark that we've scrolled for this comparison
      hasScrolledToResultsRef.current = true;

      // Longer delay to ensure the results section is fully rendered
      setTimeout(() => {
        const resultsSection = document.querySelector('.results-section');
        if (resultsSection) {
          // Scroll to the results section header specifically
          resultsSection.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }, 300);
    }
  }, [response, isFollowUpMode]);

  // Note: Scroll handling moved to handleFollowUp function for better control

  // Scroll to results section when conversations are updated (follow-up mode)
  useEffect(() => {
    if (conversations.length > 0 && isFollowUpMode && !followUpJustActivatedRef.current) {
      // Scroll to results section after follow-up is submitted
      setTimeout(() => {
        const resultsSection = document.querySelector('.results-section');
        if (resultsSection) {
          resultsSection.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }, 400);
    }
  }, [conversations, isFollowUpMode]);

  // Immediately hide card when all models are deselected
  useEffect(() => {
    if (selectedModels.length === 0) {
      setShowDoneSelectingCard(false);
    }
  }, [selectedModels.length]);

  // Trigger card visibility check when models are selected (especially for mobile)
  useEffect(() => {
    if (selectedModels.length > 0 && !isModelsHidden && !isFollowUpMode) {
      // Simply show the card when models are selected and section is visible and not in follow-up mode
      setShowDoneSelectingCard(true);
    } else if (isFollowUpMode || selectedModels.length === 0) {
      // Hide the card when entering follow-up mode or when no models are selected
      setShowDoneSelectingCard(false);
    }
  }, [selectedModels.length, isModelsHidden, isFollowUpMode]);

  // Cleanup scroll listeners on unmount
  useEffect(() => {
    // Capture ref values at mount time
    const scrollListeners = scrollListenersRef.current;
    const userInteracting = userInteractingRef.current;
    const lastScrollTop = lastScrollTopRef.current;

    return () => {
      // Clean up all scroll listeners when component unmounts
      scrollListeners.forEach((_listener, modelId) => {
        const safeId = modelId.replace(/[^a-zA-Z0-9_-]/g, '-');
        const conversationContent = document.querySelector(`#conversation-content-${safeId}`) as HTMLElement;
        const listenerSet = scrollListeners.get(modelId);

        if (conversationContent && listenerSet) {
          conversationContent.removeEventListener('scroll', listenerSet.scroll);
          conversationContent.removeEventListener('wheel', listenerSet.wheel);
          conversationContent.removeEventListener('touchstart', listenerSet.touchstart);
          conversationContent.removeEventListener('mousedown', listenerSet.mousedown);
        }
      });
      scrollListeners.clear();
      userInteracting.clear();
      lastScrollTop.clear();
    };
  }, []);

  // Align "You" sections across all model cards after each round completes
  useEffect(() => {
    if (conversations.length === 0) return;

    // Get the current round number
    const firstConversation = conversations[0];
    const currentRound = firstConversation?.messages.filter(m => m.type === 'user').length || 0;

    // Check if this round has already been aligned
    if (currentRound <= lastAlignedRoundRef.current) return;

    // Check if all models have completed this round
    const allModelsComplete = conversations.every(conv => {
      const userMessages = conv.messages.filter(m => m.type === 'user').length;
      const aiMessages = conv.messages.filter(m => m.type === 'assistant').length;
      return userMessages === currentRound && aiMessages === currentRound;
    });

    if (!allModelsComplete) return;

    // Wait for DOM to settle, then align scroll positions
    setTimeout(() => {
      const cards = document.querySelectorAll('.result-card.conversation-card');
      if (cards.length === 0) return;

      // Find the maximum offsetTop for the latest "You" section across all cards
      let maxOffsetTop = 0;
      const scrollData: { element: HTMLElement; targetOffsetTop: number }[] = [];

      cards.forEach((card) => {
        const conversationContent = card.querySelector('.conversation-content') as HTMLElement;
        if (!conversationContent) return;

        const userMessages = conversationContent.querySelectorAll('.conversation-message.user');
        if (userMessages.length === 0) return;

        const lastUserMessage = userMessages[userMessages.length - 1] as HTMLElement;
        const offsetTop = lastUserMessage.offsetTop;

        maxOffsetTop = Math.max(maxOffsetTop, offsetTop);
        scrollData.push({ element: conversationContent, targetOffsetTop: offsetTop });
      });

      // Scroll all cards to align the "You" section at the same position
      scrollData.forEach(({ element }) => {
        element.scrollTo({
          top: maxOffsetTop,
          behavior: 'smooth'
        });
      });

      // Mark this round as aligned
      lastAlignedRoundRef.current = currentRound;
    }, 500); // Wait for content to settle
  }, [conversations]);

  // Track mouse position over models section with throttling for better performance
  useEffect(() => {
    let rafId: number | null = null;
    let lastShowState = false;
    let lastMouseY = 0;
    let lastMouseX = 0;

    const checkCardVisibility = (mouseY: number, mouseX: number) => {
      if (!modelsSectionRef.current) return;

      const rect = modelsSectionRef.current.getBoundingClientRect();

      // Check if mouse is over the section
      const isOver = mouseY >= rect.top && mouseY <= rect.bottom &&
        mouseX >= rect.left && mouseX <= rect.right;

      // Show card only if:
      // 1. Mouse is over the section
      // 2. At least one model is selected
      // 3. Models section is not collapsed
      // 4. Not in follow-up mode
      const shouldShow = isOver && selectedModels.length > 0 && !isModelsHidden && !isFollowUpMode;

      // Only update state if it changed to avoid unnecessary re-renders
      if (shouldShow !== lastShowState) {
        lastShowState = shouldShow;
        setShowDoneSelectingCard(shouldShow);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      lastMouseY = e.clientY;
      lastMouseX = e.clientX;

      // Use requestAnimationFrame for smoother updates
      if (rafId) return;

      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        checkCardVisibility(lastMouseY, lastMouseX);
      });
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Handle touch events for mobile devices
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        lastMouseY = touch.clientY;
        lastMouseX = touch.clientX;

        // Use requestAnimationFrame for smoother updates
        if (rafId) return;

        rafId = window.requestAnimationFrame(() => {
          rafId = null;
          checkCardVisibility(lastMouseY, lastMouseX);
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [selectedModels.length, isModelsHidden, isFollowUpMode]);

  // Hide Done Selecting?" card when switching modes
  useEffect(() => {
    setShowDoneSelectingCard(false);
  }, [isFollowUpMode]);

  // Hide "Done Selecting?" card when models section is collapsed
  useEffect(() => {
    if (isModelsHidden) {
      setShowDoneSelectingCard(false);
    }
  }, [isModelsHidden]);

  // Handle scroll tracking to stop animations
  useEffect(() => {
    const handleScroll = () => {
      if (animationTimeoutRef.current !== null) {
        window.clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }
      setIsAnimatingButton(false);
      setIsAnimatingTextarea(false);

      // Check if user is scrolling down to models section
      if (modelsSectionRef.current) {
        const rect = modelsSectionRef.current.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          // User is scrolling to models section, stop animations
          setIsAnimatingButton(false);
          setIsAnimatingTextarea(false);
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle input change to stop animations
  useEffect(() => {
    if (input.length > 0 && (isAnimatingButton || isAnimatingTextarea)) {
      if (animationTimeoutRef.current !== null) {
        window.clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }
      setIsAnimatingButton(false);
      setIsAnimatingTextarea(false);
    }
  }, [input, isAnimatingButton, isAnimatingTextarea]);

  // Clear textarea-related errors when user starts typing
  useEffect(() => {
    if (input.trim().length > 0 && error && (
      error === 'Please enter some text to compare' ||
      error === 'Please enter a follow-up question or code'
    )) {
      setError(null);
    }
  }, [input, error]);

  // Load usage data and fetch models on component mount
  useEffect(() => {
    // Generate browser fingerprint for anti-abuse tracking
    const initFingerprint = async () => {
      const fingerprint = await generateBrowserFingerprint();
      setBrowserFingerprint(fingerprint);

      // Sync usage count with backend (only for anonymous users)
      try {
        if (isAuthenticated && user) {
          // For authenticated users, use the user object directly
          setUsageCount(user.daily_usage_count);
        } else {
          const response = await fetch(`${API_URL}/rate-limit-status?fingerprint=${encodeURIComponent(fingerprint)}`);
          if (response.ok) {
            const data = await response.json();
            // Backend returns 'daily_usage' for authenticated, 'fingerprint_usage' or 'ip_usage' for anonymous
            const usageCount = data.daily_usage || data.fingerprint_usage || data.ip_usage || 0;
            setUsageCount(usageCount);

            // Sync extended usage from backend if available
            const extendedCount = data.fingerprint_extended_usage || data.daily_extended_usage;
            if (extendedCount !== undefined) {
              setExtendedUsageCount(extendedCount);
            }

            // Update localStorage to match backend
            const today = new Date().toDateString();
            localStorage.setItem('compareai_usage', JSON.stringify({
              count: usageCount,
              date: today
            }));

            // Update extended usage in localStorage if synced from backend
            if (extendedCount !== undefined) {
              localStorage.setItem('compareai_extended_usage', JSON.stringify({
                count: extendedCount,
                date: today
              }));
            }
          } else {
            // Fallback to localStorage if backend is unavailable
            const savedUsage = localStorage.getItem('compareai_usage');
            const today = new Date().toDateString();

            if (savedUsage) {
              const usage = JSON.parse(savedUsage);
              if (usage.date === today) {
                setUsageCount(usage.count || 0);
              } else {
                // New day, reset usage
                setUsageCount(0);
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to sync usage count with backend:', error);
        // Fallback to localStorage
        const savedUsage = localStorage.getItem('compareai_usage');
        const today = new Date().toDateString();

        if (savedUsage) {
          const usage = JSON.parse(savedUsage);
          if (usage.date === today) {
            setUsageCount(usage.count || 0);
          } else {
            setUsageCount(0);
          }
        }

        // Initialize Extended usage from localStorage
        const savedExtendedUsage = localStorage.getItem('compareai_extended_usage');
        if (savedExtendedUsage) {
          const extendedUsage = JSON.parse(savedExtendedUsage);
          if (extendedUsage.date === today) {
            setExtendedUsageCount(extendedUsage.count || 0);
          } else {
            setExtendedUsageCount(0);
          }
        }
      }
    };

    initFingerprint();

    const fetchModels = async () => {
      try {
        const res = await fetch(`${API_URL}/models`);

        if (res.ok) {
          const data = await res.json();

          if (data.models_by_provider && Object.keys(data.models_by_provider).length > 0) {
            setModelsByProvider(data.models_by_provider);
          } else {
            console.error('No models_by_provider data received');
            setError('No model data received from server');
          }
        } else {
          console.error('Failed to fetch models, status:', res.status);
          setError(`Failed to fetch models: ${res.status}`);
        }
      } catch (err) {
        console.error('Failed to fetch models:', err instanceof Error ? err.message : String(err));
        setError(`Failed to fetch models: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsLoadingModels(false);
      }
    };

    fetchModels();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- Initializes on mount; auth changes handled separately

  // Setup scroll chaining for selected models grid
  useEffect(() => {
    const grid = selectedModelsGridRef.current;
    if (!grid) return;

    const handleWheel = (e: WheelEvent) => {
      const isAtTop = grid.scrollTop === 0;
      const isAtBottom = grid.scrollHeight - grid.scrollTop - grid.clientHeight < 1;

      // If at top and scrolling up, or at bottom and scrolling down, manually scroll the window
      if ((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0)) {
        // Prevent default to stop the grid from trying to scroll
        e.preventDefault();
        // Manually scroll the window to allow continuation of scrolling beyond grid boundaries
        window.scrollBy({
          top: e.deltaY * 0.5, // Scale down the scroll amount slightly for smoother UX
          left: 0,
          behavior: 'auto'
        });
        return;
      }
    };

    grid.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      grid.removeEventListener('wheel', handleWheel);
    };
  }, [selectedModels.length]); // Re-run when selected models change

  // Track previous authentication state to detect transitions
  const prevIsAuthenticatedRef = useRef<boolean | null>(null);

  // Handle authentication state changes (logout and sign-in from anonymous)
  useEffect(() => {
    // Only process transitions if we have a previous state (not initial mount)
    if (prevIsAuthenticatedRef.current === null) {
      // Initial mount - just record the current state and don't clear anything
      prevIsAuthenticatedRef.current = isAuthenticated;
      return;
    }

    const wasAnonymous = prevIsAuthenticatedRef.current === false;
    const isNowAuthenticated = isAuthenticated === true;
    const wasAuthenticated = prevIsAuthenticatedRef.current === true;
    const isNowAnonymous = isAuthenticated === false;

    // Clear all state when signing in from anonymous mode
    if (wasAnonymous && isNowAuthenticated) {
      // Clear all prompts, model choices, results, and related state
      setInput('');
      setResponse(null);
      setError(null);
      setIsLoading(false);
      setConversations([]);
      setProcessingTime(null);
      setIsFollowUpMode(false);
      setCurrentVisibleComparisonId(null);
      setSelectedModels([]); // Clear model choices when signing in
      setOriginalSelectedModels([]);
      setClosedCards(new Set());
      setActiveResultTabs({});
      setIsExtendedMode(false);
      setShowDoneSelectingCard(false);
      setIsModelsHidden(false);
      setIsScrollLocked(false);
      setOpenDropdowns(new Set());
      // Clear any ongoing requests
      if (currentAbortController) {
        currentAbortController.abort();
        setCurrentAbortController(null);
      }
      // Clear scroll refs
      hasScrolledToResultsRef.current = false;
    }

    // Reset page state when user logs out
    if (wasAuthenticated && isNowAnonymous) {
      // Reset all state to default
      setInput('');
      setResponse(null);
      setError(null);
      setIsLoading(false);
      setConversations([]);
      setProcessingTime(null);
      setIsFollowUpMode(false);
      // Clear currently visible comparison ID on logout so saved comparisons appear in history
      setCurrentVisibleComparisonId(null);
      // Don't reset selectedModels or usage count - let them keep their selections
    }

    // Update the ref to track current state for next render
    prevIsAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated, currentAbortController]);

  const toggleDropdown = (provider: string) => {
    setOpenDropdowns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(provider)) {
        newSet.delete(provider);
      } else {
        newSet.add(provider);
      }
      return newSet;
    });
  };

  // Helper function to check extended interaction limits
  const checkExtendedInteractionLimit = async (): Promise<{ canProceed: boolean; errorMessage?: string }> => {
    const userTier = isAuthenticated ? user?.subscription_tier || 'free' : 'anonymous';
    const extendedLimit = EXTENDED_TIER_LIMITS[userTier] || EXTENDED_TIER_LIMITS.anonymous;

    // Get current extended usage
    let currentExtendedUsage = isAuthenticated && user
      ? user.daily_extended_usage
      : extendedUsageCount;

    // For anonymous users, try to sync from backend
    if (!isAuthenticated && browserFingerprint) {
      try {
        const response = await fetch(`${API_URL}/rate-limit-status?fingerprint=${encodeURIComponent(browserFingerprint)}`);
        if (response.ok) {
          const data = await response.json();
          const latestExtendedCount = data.fingerprint_extended_usage || data.daily_extended_usage;
          if (latestExtendedCount !== undefined) {
            currentExtendedUsage = latestExtendedCount;
            setExtendedUsageCount(latestExtendedCount);
            const today = new Date().toDateString();
            localStorage.setItem('compareai_extended_usage', JSON.stringify({
              count: latestExtendedCount,
              date: today
            }));
          }
        }
      } catch (error) {
        console.error('Failed to sync extended usage count:', error);
      }
    }

    // For authenticated users, refresh to get latest usage
    if (isAuthenticated) {
      try {
        await refreshUser();
        currentExtendedUsage = user?.daily_extended_usage || 0;
      } catch (error) {
        console.error('Failed to refresh user data:', error);
      }
    }

    // Check if the request would exceed the limit (1 extended interaction per request)
    if (currentExtendedUsage + 1 > extendedLimit) {
      const remaining = extendedLimit - currentExtendedUsage;
      const errorMsg = `You have ${remaining} Extended interaction${remaining !== 1 ? 's' : ''} remaining today. ${userTier === 'free' ? 'Upgrade to a paid tier for more Extended interactions.' : `Upgrade to a higher tier for more Extended interactions.`}`;
      return { canProceed: false, errorMessage: errorMsg };
    }

    return { canProceed: true };
  };

  const collapseAllDropdowns = () => {
    setOpenDropdowns(new Set());
  };

  const toggleAllForProvider = async (provider: string) => {
    const providerModels = modelsByProvider[provider] || [];
    // Filter out unavailable models (where available === false)
    const availableProviderModels = providerModels.filter(model => model.available !== false);
    const providerModelIds = availableProviderModels.map(model => model.id);

    // Check if all provider models are currently selected
    const allProviderModelsSelected = providerModelIds.every(id => selectedModels.includes(id));

    if (allProviderModelsSelected) {
      // Deselecting - check if this would leave us with no models
      const modelsAfterDeselect = selectedModels.filter(id => !providerModelIds.includes(id));

      // In follow-up mode, show error if deselecting would leave zero models total
      if (isFollowUpMode && modelsAfterDeselect.length === 0) {
        setError('Must have at least one model to process');
        setTimeout(() => {
          setError(null);
        }, 5000);
        return;
      }
    } else {
      // Check extended interaction limit if extended mode is on and we're selecting
      if (isExtendedMode && !allProviderModelsSelected && !isFollowUpMode) {
        const check = await checkExtendedInteractionLimit();
        if (!check.canProceed) {
          setError(check.errorMessage!);
          setTimeout(() => {
            setError(null);
          }, 10000);
          return;
        }
      }
    }

    // Track if we couldn't select all models for the provider
    let couldNotSelectAll = false;

    if (!allProviderModelsSelected && !isFollowUpMode) {
      // Calculate how many models we can actually add
      const alreadySelectedFromProvider = providerModelIds.filter(id => selectedModels.includes(id)).length;
      const remainingSlots = maxModelsLimit - (selectedModels.length - alreadySelectedFromProvider);
      const modelsToAdd = providerModelIds.slice(0, remainingSlots);
      couldNotSelectAll = modelsToAdd.length < providerModelIds.length;
    }

    setSelectedModels(prev => {
      const newSelection = new Set(prev);

      if (allProviderModelsSelected) {
        // Deselect all provider models
        providerModelIds.forEach(id => newSelection.delete(id));
      } else {
        // In follow-up mode, only allow selecting models that were originally selected
        if (isFollowUpMode) {
          const modelsToAdd = providerModelIds.filter(id =>
            originalSelectedModels.includes(id) && !prev.includes(id)
          );
          modelsToAdd.forEach(id => newSelection.add(id));
        } else {
          // Select all provider models, but respect the limit
          // Count how many models from this provider are already selected
          const alreadySelectedFromProvider = providerModelIds.filter(id => prev.includes(id)).length;
          // Calculate remaining slots excluding already selected models from this provider
          const remainingSlots = maxModelsLimit - (prev.length - alreadySelectedFromProvider);
          const modelsToAdd = providerModelIds.slice(0, remainingSlots);

          modelsToAdd.forEach(id => newSelection.add(id));
        }
      }

      return Array.from(newSelection);
    });

    // Show warning if not all models could be selected due to tier limit
    if (couldNotSelectAll && !allProviderModelsSelected && !isFollowUpMode) {
      const tierName = !isAuthenticated ? 'Anonymous' : user?.subscription_tier || 'free';
      setError(`Your ${tierName} tier allows a maximum of ${maxModelsLimit} models per comparison. Not all models from ${provider} could be selected.`);
      setTimeout(() => {
        setError(null);
      }, 10000);
      return;
    }

    // Clear any previous error when successfully adding models (only when selecting, not deselecting)
    if (!allProviderModelsSelected && error && (error.includes('Maximum') || error.includes('Must have at least one model') || error.includes('Please select at least one model'))) {
      setError(null);
    }
  };


  const handleExtendedModeToggle = async () => {
    // If toggling ON, check if current model selection would exceed extended interaction limit
    if (!isExtendedMode && selectedModels.length > 0) {
      const check = await checkExtendedInteractionLimit();
      if (!check.canProceed) {
        setError(check.errorMessage!);
        setTimeout(() => {
          setError(null);
        }, 10000);
        return;
      }
    }

    // Toggle extended mode
    setIsExtendedMode(!isExtendedMode);
  };

  const handleModelToggle = async (modelId: string) => {
    if (selectedModels.includes(modelId)) {
      // Check if this is the last selected model - only prevent in follow-up mode
      if (selectedModels.length === 1 && isFollowUpMode) {
        setError('Must have at least one model to process');
        // Clear the error after 5 seconds
        setTimeout(() => {
          setError(null);
        }, 5000);
        return;
      }

      // Allow deselection in both normal and follow-up mode
      setSelectedModels(prev => prev.filter(id => id !== modelId));
      // Clear any previous error when deselecting a model
      if (error && error.includes('Maximum')) {
        setError(null);
      }
    } else {
      // In follow-up mode, only allow reselecting models that were originally selected
      if (isFollowUpMode) {
        if (originalSelectedModels.includes(modelId)) {
          // Allow reselection of previously selected model
          setSelectedModels(prev => [...prev, modelId]);
          // Clear any previous error when successfully adding a model
          if (error && (error.includes('Maximum') || error.includes('Must have at least one model') || error.includes('Please select at least one model'))) {
            setError(null);
          }
        } else {
          // Prevent adding new models during follow-up mode
          setError('Cannot add new models during follow-up. Please start a new comparison to select different models.');
          // Clear the error after 5 seconds
          setTimeout(() => {
            setError(null);
          }, 5000);
        }
        return;
      }

      // Check limit before adding (only in normal mode)
      if (selectedModels.length >= maxModelsLimit) {
        const tierName = !isAuthenticated ? 'Anonymous' : user?.subscription_tier || 'free';
        const upgradeMsg = tierName === 'Anonymous' ? ' Sign up for a free account to get 3 models.' :
          tierName === 'free' ? ' Upgrade to Starter for 6 models or Pro for 9 models.' :
            (tierName === 'starter' || tierName === 'starter_plus') ? ' Upgrade to Pro for 9 models.' : '';
        setError(`Your ${tierName} tier allows maximum ${maxModelsLimit} models per comparison.${upgradeMsg}`);
        return;
      }

      // Check extended interaction limit if extended mode is on
      if (isExtendedMode) {
        const check = await checkExtendedInteractionLimit();
        if (!check.canProceed) {
          setError(check.errorMessage!);
          setTimeout(() => {
            setError(null);
          }, 10000);
          return;
        }
      }

      setSelectedModels(prev => [...prev, modelId]);
      // Clear any previous error when successfully adding a model
      if (error && (error.includes('Maximum') || error.includes('Must have at least one model') || error.includes('Please select at least one model'))) {
        setError(null);
      }
    }
  };

  const handleCancel = () => {
    if (currentAbortController) {
      userCancelledRef.current = true;
      currentAbortController.abort();
      setCurrentAbortController(null);
      setIsLoading(false);
      // Don't set error here - we'll handle it in the catch block
    }
  };

  const closeResultCard = (modelId: string) => {
    setClosedCards(prev => new Set(prev).add(modelId));
  };

  const showAllResults = () => {
    setClosedCards(new Set());
  };

  // Helper function to check if follow-up should be disabled based on model selection changes
  const isFollowUpDisabled = () => {
    if (originalSelectedModels.length === 0) {
      return false; // No original comparison yet, so follow-up is not applicable
    }

    // Check if any new models have been added (models in selectedModels that weren't in originalSelectedModels)
    const hasNewModels = selectedModels.some(model => !originalSelectedModels.includes(model));

    // If new models were added, disable follow-up
    // If only models were deselected (subset of original), allow follow-up
    return hasNewModels;
  };

  const handleFollowUp = () => {
    followUpJustActivatedRef.current = true;
    setIsFollowUpMode(true);
    setInput('');
    setIsModelsHidden(true); // Collapse the models section when entering follow-up mode

    // Scroll to top of page smoothly
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

    // Wait for state to update, then scroll to the input section
    setTimeout(() => {
      const inputSection = document.querySelector('.input-section');
      if (inputSection) {
        // Get the h2 heading inside the input section
        const heading = inputSection.querySelector('h2');
        if (heading) {
          heading.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        } else {
          // Fallback to scrolling to the section itself
          inputSection.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }
      // Reset the flag after scrolling
      followUpJustActivatedRef.current = false;
    }, 250); // Increased delay to ensure DOM updates

    // Focus the textarea after scroll completes
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 650); // Wait for scroll to complete
  };

  const handleContinueConversation = () => {
    if (!input.trim()) {
      setError('Please enter a follow-up question or code');
      return;
    }
    handleSubmit();
  };

  const handleNewComparison = () => {
    setIsFollowUpMode(false);
    setInput('');
    setConversations([]);
    setResponse(null);
    setClosedCards(new Set());
    setError(null);
    setOriginalSelectedModels([]); // Reset original models for new comparison
    setIsModelsHidden(false); // Show models section again for new comparison
    // Clear currently visible comparison ID
    setCurrentVisibleComparisonId(null);
  };

  // Function to scroll all conversation content areas to the last user message
  const scrollConversationsToBottom = () => {
    // Use a small delay to ensure DOM has updated
    setTimeout(() => {
      const conversationContents = document.querySelectorAll('.conversation-content');
      conversationContents.forEach((content) => {
        // Find all user messages in this conversation
        const userMessages = content.querySelectorAll('.conversation-message.user');
        if (userMessages.length > 0) {
          // Get the last user message
          const lastUserMessage = userMessages[userMessages.length - 1];

          // Calculate the position of the last user message relative to the conversation content
          const messageRect = lastUserMessage.getBoundingClientRect();
          const containerRect = content.getBoundingClientRect();
          const relativeTop = messageRect.top - containerRect.top + content.scrollTop;

          // Scroll to position the last user message at the top of the conversation container
          content.scrollTo({
            top: relativeTop,
            behavior: 'smooth'
          });
        } else {
          // Fallback to scrolling to bottom if no user message found
          content.scrollTop = content.scrollHeight;
        }
      });
    }, 100);
  };

  // Handler for "Done Selecting" button click
  const handleDoneSelecting = () => {
    // Hide the card
    setShowDoneSelectingCard(false);

    // Collapse all expanded model-provider dropdowns
    collapseAllDropdowns();

    // Collapse the models section
    setIsModelsHidden(true);

    // Scroll to the very top
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

    // Wait for scroll to complete, then focus
    window.setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 800); // Wait for scroll animation to complete
  };

  // Handler for submit button that provides helpful validation messages
  const handleSubmitClick = () => {
    // Clear animations when submitting
    if (animationTimeoutRef.current !== null) {
      window.clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }
    setIsAnimatingButton(false);
    setIsAnimatingTextarea(false);

    // Check if user is logged in but not verified
    if (user && !user.is_verified) {
      setError('Please verify your email address before making comparisons. Check your inbox for a verification link from CompareIntel.');
      // Scroll to the top to show the verification banner
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (selectedModels.length === 0) {
      setError('Please select at least one model below to compare responses');
      // Scroll to the models section to help the user
      window.setTimeout(() => {
        const modelsSection = document.querySelector('.models-section');
        if (modelsSection) {
          modelsSection.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }, 100);
      return;
    }

    if (!input.trim()) {
      setError('Please enter some text to compare');
      return;
    }

    handleSubmit();
  };

  const handleSubmit = async () => {
    // Check if user is logged in but not verified
    if (user && !user.is_verified) {
      setError('Please verify your email address before making comparisons. Check your inbox for a verification link from CompareIntel.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Check input length against tier limits
    const messageCount = conversations.length > 0 ? conversations[0]?.messages.length || 0 : 0;
    const userTier = isAuthenticated ? user?.subscription_tier || 'free' : 'anonymous';
    const shouldUseExtendedTier = isExtendedMode; // Only use extended mode if explicitly enabled by user
    const tierLimit = shouldUseExtendedTier ? 15000 : 5000; // Extended: 15K chars, Standard: 5K chars

    if (input.length > tierLimit) {
      const tierName = shouldUseExtendedTier ? 'Extended' : 'Standard';
      const upgradeMsg = shouldUseExtendedTier
        ? ' Your input has exceeded the Extended tier limit.'
        : ' Enable Extended mode for up to 15,000 characters, or reduce your input.';
      setError(`${tierName} tier limit exceeded. Maximum ${tierLimit.toLocaleString()} characters allowed, but your input has ${input.length.toLocaleString()} characters.${upgradeMsg}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Hard limit: Prevent submissions with conversations that are too long
    // Industry best practice 2025: Enforce maximum context window to protect costs and maintain quality
    if (isFollowUpMode && conversations.length > 0) {
      if (messageCount >= 24) {
        setError('This conversation has reached the maximum length (24 messages). Please start a new comparison to continue.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    // Check daily usage limit (model-based)
    // First, sync with backend to ensure we have the latest usage count
    let currentUsageCount = usageCount;

    // For authenticated users, use the user object's daily_usage_count
    if (isAuthenticated && user) {
      currentUsageCount = user.daily_usage_count;
    } else if (browserFingerprint) {
      // For anonymous users, sync from backend
      try {
        const response = await fetch(`${API_URL}/rate-limit-status?fingerprint=${encodeURIComponent(browserFingerprint)}`);
        if (response.ok) {
          const data = await response.json();
          // Backend returns 'daily_usage' for authenticated, 'fingerprint_usage' or 'ip_usage' for anonymous
          const latestCount = data.daily_usage || data.fingerprint_usage || data.ip_usage || 0;
          currentUsageCount = latestCount;
          // Update state to keep it in sync - will update banner and localStorage below if needed
          if (latestCount !== usageCount) {
            setUsageCount(latestCount);
          }
        }
      } catch (error) {
        console.error('Failed to sync usage count before check:', error);
        // Continue with current state if fetch fails
      }
    }

    const modelsNeeded = selectedModels.length;

    // Determine user tier and their regular limit (userTier already declared above)
    const REGULAR_LIMITS: { [key: string]: number } = {
      anonymous: 10,
      free: 20,
      starter: 50,
      starter_plus: 100,
      pro: 200,
      pro_plus: 400
    };
    const regularLimit = REGULAR_LIMITS[userTier] || REGULAR_LIMITS.anonymous;

    if (currentUsageCount >= regularLimit) {
      // Use the synced count for the error message to match what we just set in state
      setError(`You've reached your daily limit of ${regularLimit} model responses.${userTier === 'anonymous' ? ' Sign up for a free account to get 20 model responses per day!' : ' Paid tiers with higher limits will be available soon!'}`);
      return;
    }

    // Check if this comparison would exceed the limit
    if (currentUsageCount + modelsNeeded > regularLimit) {
      const remaining = regularLimit - currentUsageCount;
      // If we updated the usage count, ensure state propagates before showing error
      if (currentUsageCount !== usageCount) {
        // Update localStorage synchronously so banner can read it
        localStorage.setItem('compareai_usage', JSON.stringify({
          count: currentUsageCount,
          date: new Date().toDateString()
        }));
        // Wait for React to process the state update
        await new Promise(resolve => requestAnimationFrame(resolve));
        await new Promise(resolve => requestAnimationFrame(resolve)); // Double RAF to ensure render
      }
      // IMPORTANT: The state and localStorage are now updated with currentUsageCount
      setError(`You have ${remaining} model responses remaining today, but selected ${modelsNeeded} for this comparison.${userTier === 'anonymous' ? ' Sign up for a free account to get 20 model responses per day!' : ' Paid tiers with higher limits will be available soon!'}`);
      return;
    }

    // Check Extended tier limit if using Extended tier (only when user explicitly enables it)
    // Extended mode doubles token limits (5K→15K chars, 4K→8K tokens), equivalent to ~2 messages
    // Reuse messageCount, userTier, and shouldUseExtendedTier declared above

    if (shouldUseExtendedTier) {
      const extendedLimit = EXTENDED_TIER_LIMITS[userTier] || EXTENDED_TIER_LIMITS.anonymous;

      // Sync extended usage from backend before checking limit
      let currentExtendedUsage = isAuthenticated && user
        ? user.daily_extended_usage
        : extendedUsageCount;

      // For anonymous users, try to sync from backend
      if (!isAuthenticated && browserFingerprint) {
        try {
          const response = await fetch(`${API_URL}/rate-limit-status?fingerprint=${encodeURIComponent(browserFingerprint)}`);
          if (response.ok) {
            const data = await response.json();
            const latestExtendedCount = data.fingerprint_extended_usage || data.daily_extended_usage;
            if (latestExtendedCount !== undefined) {
              currentExtendedUsage = latestExtendedCount;
              // Update state to keep it in sync
              setExtendedUsageCount(latestExtendedCount);
              const today = new Date().toDateString();
              localStorage.setItem('compareai_extended_usage', JSON.stringify({
                count: latestExtendedCount,
                date: today
              }));
            }
          }
        } catch (error) {
          console.error('Failed to sync extended usage count before check:', error);
          // Continue with current state if fetch fails
        }
      }

      // Extended interactions needed = 1 per request (regardless of number of models)
      const extendedInteractionsNeeded = 1;

      if (currentExtendedUsage >= extendedLimit) {
        setError(`You've reached your daily Extended tier limit of ${extendedLimit} interactions.`);
        return;
      }

      // Check if this would exceed the Extended limit
      if (currentExtendedUsage + extendedInteractionsNeeded > extendedLimit) {
        const remaining = extendedLimit - currentExtendedUsage;
        // If we updated the extended usage count, ensure state propagates before showing error
        if (!isAuthenticated && currentExtendedUsage !== extendedUsageCount) {
          // Update localStorage synchronously
          localStorage.setItem('compareai_extended_usage', JSON.stringify({
            count: currentExtendedUsage,
            date: new Date().toDateString()
          }));
          // Wait for React to process the state update
          await new Promise(resolve => requestAnimationFrame(resolve));
          await new Promise(resolve => requestAnimationFrame(resolve)); // Double RAF to ensure render
        }
        setError(`You have ${remaining} Extended interaction${remaining !== 1 ? 's' : ''} remaining today, but need ${extendedInteractionsNeeded} for this comparison.`);
        return;
      }
    }

    if (!input.trim()) {
      setError('Please enter some text to compare');
      return;
    }

    if (selectedModels.length === 0) {
      setError('Please select at least one model');
      return;
    }

    // Store original selected models for follow-up comparison logic (only for new comparisons, not follow-ups)
    if (!isFollowUpMode) {
      // Clear the currently visible comparison ID so the previous one will appear in history
      // This allows the previously visible comparison to show in the dropdown when user starts a new one
      setCurrentVisibleComparisonId(null);

      setOriginalSelectedModels([...selectedModels]);

      // If there's an active conversation and we're starting a new one, save the previous one first
      // This ensures when user has A & B, runs C, then starts D, we save C and show B & C in history
      if (!isAuthenticated && conversations.length > 0) {
        // Use originalSelectedModels for the previous conversation, or fall back to current conversations' models
        const previousModels = originalSelectedModels.length > 0
          ? originalSelectedModels
          : [...new Set(conversations.map(conv => conv.modelId))];

        const conversationsWithMessages = conversations.filter(conv =>
          previousModels.includes(conv.modelId) && conv.messages.length > 0
        );

        // Only save if we have conversations with complete assistant messages
        const hasCompleteMessages = conversationsWithMessages.some(conv => {
          const assistantMessages = conv.messages.filter(msg => msg.type === 'assistant');
          return assistantMessages.length > 0 && assistantMessages.some(msg => msg.content.trim().length > 0);
        });

        if (hasCompleteMessages && conversationsWithMessages.length > 0) {
          // Get the FIRST user message from the conversation
          const allUserMessages = conversationsWithMessages
            .flatMap(conv => conv.messages)
            .filter(msg => msg.type === 'user')
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

          const firstUserMessage = allUserMessages[0];

          if (firstUserMessage) {
            const inputData = firstUserMessage.content;
            // Save the previous conversation before starting the new one
            // Use isUpdate=false since this is the first time saving this conversation
            saveConversationToLocalStorage(inputData, previousModels, conversationsWithMessages, false);
          }
        }
      }
    }

    setIsLoading(true);
    setError(null);
    setIsModelsHidden(true); // Hide models section after clicking Compare
    setShowDoneSelectingCard(false); // Hide "Done Selecting" card after clicking Compare

    // Capture user timestamp when they actually submit
    const userTimestamp = new Date().toISOString();
    setUserMessageTimestamp(userTimestamp);

    // Original input functionality removed - not needed

    setResponse(null); // Clear previous results
    setClosedCards(new Set()); // Clear closed cards for new results
    setProcessingTime(null);
    userCancelledRef.current = false;
    hasScrolledToResultsRef.current = false; // Reset scroll tracking for new comparison
    autoScrollPausedRef.current.clear(); // Clear auto-scroll pause ref
    userInteractingRef.current.clear(); // Clear user interaction tracking
    lastScrollTopRef.current.clear(); // Clear scroll position tracking
    lastAlignedRoundRef.current = 0; // Reset round alignment tracking
    setIsScrollLocked(false); // Reset scroll lock for new comparison

    // Clean up any existing scroll listeners from previous comparison
    scrollListenersRef.current.forEach((_listener, modelId) => {
      cleanupScrollListener(modelId);
    });

    const startTime = Date.now();

    // Dynamic timeout based on number of models selected
    // For large selections (50+ models), allow up to 8 minutes
    const baseTimeout = 60000; // 1 minute base
    const additionalTime = Math.floor(selectedModels.length / 5) * 15000; // 15s per 5 models
    const maxTimeout = selectedModels.length > 40 ? 480000 : 300000; // 8 minutes for 40+ models, 5 minutes otherwise
    const dynamicTimeout = Math.min(baseTimeout + additionalTime, maxTimeout);

    try {
      const controller = new AbortController();
      setCurrentAbortController(controller);

      const timeoutId = setTimeout(() => controller.abort(), dynamicTimeout);

      // Prepare conversation history for the API
      // For follow-up mode, we send the complete conversation history (both user and assistant messages)
      // This matches how official AI chat interfaces work and provides proper context
      const conversationHistory = isFollowUpMode && conversations.length > 0
        ? (() => {
          // Get the first conversation that has messages and is for a selected model
          const selectedConversations = conversations.filter(conv =>
            selectedModels.includes(conv.modelId) && conv.messages.length > 0
          );
          if (selectedConversations.length === 0) return [];

          // Use the first selected conversation's messages
          return selectedConversations[0].messages.map(msg => ({
            role: msg.type === 'user' ? 'user' : 'assistant',
            content: msg.content
          }));
        })()
        : [];

      // Prepare headers with auth token if available
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const accessToken = localStorage.getItem('access_token');
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      // Determine tier: Extended if manually toggled OR if conversation exceeds 6 messages
      // Extended mode doubles token limits (5K→15K chars, 4K→8K tokens), equivalent to ~2 messages
      // So 6+ messages is a more reasonable threshold for context-heavy requests
      // Reuse messageCount and shouldUseExtendedTier declared above

      // Use streaming endpoint for faster perceived response time
      const res = await fetch(`${API_URL}/compare-stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          input_data: input,
          models: selectedModels,
          conversation_history: conversationHistory,
          browser_fingerprint: browserFingerprint,
          tier: shouldUseExtendedTier ? 'extended' : 'standard'
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));

        // Special handling for rate limit errors (429)
        if (res.status === 429) {
          throw new Error(errorData.detail || 'Daily comparison limit reached. Please try again tomorrow.');
        }

        throw new Error(errorData.detail || `HTTP error! status: ${res.status}`);
      }

      // Handle streaming response with Server-Sent Events
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      // Initialize results object for streaming updates
      const streamingResults: { [key: string]: string } = {};
      const completedModels = new Set<string>(); // Track which models have finished
      const modelStartTimes: { [key: string]: string } = {}; // Track when each model starts
      const modelCompletionTimes: { [key: string]: string } = {}; // Track when each model completes
      let streamingMetadata: CompareResponse['metadata'] | null = null;
      let lastUpdateTime = Date.now();
      const UPDATE_THROTTLE_MS = 50; // Update UI every 50ms max for smooth streaming

      // Set all selected models to 'raw' tab to show streaming content immediately
      const rawTabs: { [modelId: string]: 'raw' } = {};
      selectedModels.forEach(modelId => {
        rawTabs[modelId] = 'raw';
      });
      setActiveResultTabs(rawTabs);

      // Initialize empty conversations immediately so cards appear during streaming
      if (!isFollowUpMode) {
        const emptyConversations: ModelConversation[] = selectedModels.map(modelId => ({
          modelId,
          messages: [
            createMessage('user', input, userTimestamp), // Placeholder user timestamp, will be updated when model starts
            createMessage('assistant', '', userTimestamp) // Placeholder AI timestamp, will be updated when model completes
          ]
        }));
        setConversations(emptyConversations);
      }

      // Track which models have had listeners set up (to avoid duplicates)
      const listenersSetUp = new Set<string>();

      if (reader) {
        try {
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            // Decode the chunk and add to buffer
            buffer += decoder.decode(value, { stream: true });

            // Process complete SSE messages (separated by \n\n)
            const messages = buffer.split('\n\n');
            buffer = messages.pop() || ''; // Keep incomplete message in buffer

            let shouldUpdate = false;

            for (const message of messages) {
              if (!message.trim() || !message.startsWith('data: ')) continue;

              try {
                const jsonStr = message.replace(/^data: /, '');
                const event = JSON.parse(jsonStr);

                if (event.type === 'start') {
                  // Model starting - initialize empty result and track start time
                  if (!streamingResults[event.model]) {
                    streamingResults[event.model] = '';
                  }
                  // Record when this specific model started processing (when query was sent to OpenRouter)
                  modelStartTimes[event.model] = new Date().toISOString();
                  shouldUpdate = true;
                } else if (event.type === 'chunk') {
                  // Content chunk arrived - append to result
                  streamingResults[event.model] = (streamingResults[event.model] || '') + event.content;
                  shouldUpdate = true;

                  // Set up scroll listener on first chunk (DOM should be ready by now)
                  if (!listenersSetUp.has(event.model)) {
                    listenersSetUp.add(event.model);

                    // Retry setup with increasing delays until successful
                    const trySetup = (attempt: number, maxAttempts: number) => {
                      const delay = attempt * 50; // 50ms, 100ms, 150ms, 200ms
                      requestAnimationFrame(() => {
                        setTimeout(() => {
                          const success = setupScrollListener(event.model);
                          if (!success && attempt < maxAttempts) {
                            trySetup(attempt + 1, maxAttempts);
                          }
                        }, delay);
                      });
                    };

                    // Try up to 4 times with increasing delays
                    trySetup(1, 4);
                  }
                } else if (event.type === 'done') {
                  // Model completed - track it and record completion time
                  completedModels.add(event.model);
                  modelCompletionTimes[event.model] = new Date().toISOString();
                  shouldUpdate = true;

                  // Clean up pause state for this model (but keep scroll listeners for scroll lock feature)
                  autoScrollPausedRef.current.delete(event.model);

                  // Check if ALL models are done - if so, switch to formatted view
                  if (completedModels.size === selectedModels.length) {
                    const formattedTabs: { [modelId: string]: 'formatted' } = {};
                    selectedModels.forEach(modelId => {
                      formattedTabs[modelId] = 'formatted';
                    });
                    setActiveResultTabs(formattedTabs);
                  }
                } else if (event.type === 'complete') {
                  // All models complete - save metadata
                  streamingMetadata = event.metadata;
                  const endTime = Date.now();
                  setProcessingTime(endTime - startTime);
                  shouldUpdate = true;

                  // Note: Conversation saving will happen after final state update
                  // For authenticated users: backend handles it, refresh history after a delay
                  if (isAuthenticated && !isFollowUpMode) {
                    // Refresh history from API after a short delay to allow backend to save
                    setTimeout(() => {
                      loadHistoryFromAPI();
                    }, 1000);
                  }
                } else if (event.type === 'error') {
                  throw new Error(event.message || 'Streaming error occurred');
                }
              } catch (parseError) {
                console.error('Error parsing SSE message:', parseError, message);
              }
            }

            // Throttled UI update - update at most every 50ms for smooth streaming
            const now = Date.now();
            if (shouldUpdate && (now - lastUpdateTime >= UPDATE_THROTTLE_MS)) {
              lastUpdateTime = now;

              // Use regular state update instead of flushSync to allow smooth scrolling
              // React 18 will batch these updates automatically for better performance
              // Update response state
              setResponse({
                results: { ...streamingResults },
                metadata: {
                  input_length: input.length,
                  models_requested: selectedModels.length,
                  models_successful: 0, // Will be updated on complete
                  models_failed: 0,
                  timestamp: new Date().toISOString(),
                  processing_time_ms: Date.now() - startTime
                }
              });

              // Update conversations to show streaming text in cards
              if (!isFollowUpMode) {
                setConversations(prevConversations =>
                  prevConversations.map(conv => {
                    const content = streamingResults[conv.modelId] || '';
                    const startTime = modelStartTimes[conv.modelId];
                    const completionTime = modelCompletionTimes[conv.modelId];

                    // Update both user and assistant message timestamps with individual model times

                    return {
                      ...conv,
                      messages: conv.messages.map((msg, idx) => {
                        if (idx === 0 && msg.type === 'user') {
                          // Update user timestamp with model start time if available
                          const newTimestamp = startTime || msg.timestamp;
                          return {
                            ...msg,
                            timestamp: newTimestamp
                          };
                        } else if (idx === 1 && msg.type === 'assistant') {
                          // Update assistant message content and timestamp
                          const newTimestamp = completionTime || msg.timestamp;
                          return {
                            ...msg,
                            content,
                            timestamp: newTimestamp
                          };
                        }
                        return msg;
                      })
                    };
                  })
                );
              } else {
                // For follow-up mode, append streaming content to existing conversations
                setConversations(prevConversations =>
                  prevConversations.map(conv => {
                    const content = streamingResults[conv.modelId];
                    if (content === undefined) return conv;

                    // Check if we already added the new user message
                    // Look for the most recent user message that matches the current input
                    const hasNewUserMessage = conv.messages.some((msg, idx) =>
                      msg.type === 'user' &&
                      msg.content === input &&
                      idx >= conv.messages.length - 2 // Check last 2 messages (user + assistant)
                    );

                    if (!hasNewUserMessage) {
                      // Add user message and empty assistant message
                      const startTime = modelStartTimes[conv.modelId];
                      const completionTime = modelCompletionTimes[conv.modelId];
                      return {
                        ...conv,
                        messages: [
                          ...conv.messages,
                          createMessage('user', input, startTime || userTimestamp), // Use model start time if available
                          createMessage('assistant', content, completionTime || new Date().toISOString())
                        ]
                      };
                    } else {
                      // Update the last assistant message with completion time if available
                      const completionTime = modelCompletionTimes[conv.modelId];
                      return {
                        ...conv,
                        messages: conv.messages.map((msg, idx) =>
                          idx === conv.messages.length - 1 && msg.type === 'assistant'
                            ? {
                              ...msg,
                              content,
                              timestamp: completionTime || msg.timestamp
                            }
                            : msg
                        )
                      };
                    }
                  })
                );
              }

              // Auto-scroll each conversation card to bottom as content streams in
              // BUT only for models that are still streaming (not completed yet)
              // AND respect user's manual scroll position (pause if user scrolled up)
              // Use requestAnimationFrame for smooth scrolling
              requestAnimationFrame(() => {
                Object.keys(streamingResults).forEach(modelId => {
                  // Skip auto-scrolling for completed models so users can scroll through them
                  if (completedModels.has(modelId)) return;

                  // Skip auto-scrolling if user has manually scrolled away from bottom
                  // Use REF for immediate check without state update delay
                  if (autoScrollPausedRef.current.has(modelId)) return;

                  const safeId = modelId.replace(/[^a-zA-Z0-9_-]/g, '-');
                  const conversationContent = document.querySelector(`#conversation-content-${safeId}`) as HTMLElement;
                  if (conversationContent) {
                    conversationContent.scrollTop = conversationContent.scrollHeight;
                  }
                });
              });
            }
          }

          // Final update to ensure all content is displayed
          setResponse({
            results: { ...streamingResults },
            metadata: {
              input_length: input.length,
              models_requested: selectedModels.length,
              models_successful: Object.keys(streamingResults).filter(
                modelId => !streamingResults[modelId].startsWith('Error')
              ).length,
              models_failed: Object.keys(streamingResults).filter(
                modelId => streamingResults[modelId].startsWith('Error')
              ).length,
              timestamp: new Date().toISOString(),
              processing_time_ms: Date.now() - startTime
            }
          });

          // Final conversations update with complete content
          if (!isFollowUpMode) {
            setConversations(prevConversations => {
              const updated = prevConversations.map(conv => {
                const content = streamingResults[conv.modelId] || '';
                const startTime = modelStartTimes[conv.modelId];
                const completionTime = modelCompletionTimes[conv.modelId];

                return {
                  ...conv,
                  messages: conv.messages.map((msg, idx) => {
                    if (idx === 0 && msg.type === 'user') {
                      // Update user message timestamp with model start time
                      return { ...msg, timestamp: startTime || msg.timestamp };
                    } else if (idx === 1 && msg.type === 'assistant') {
                      // Update assistant message timestamp with model completion time
                      return {
                        ...msg,
                        content,
                        timestamp: completionTime || msg.timestamp
                      };
                    }
                    return msg;
                  })
                };
              });

              // Don't save here - will save after stream completes (see below)
              return updated;
            });
          } else {
            // For follow-up mode, ensure messages are added and update with final content
            setConversations(prevConversations => {
              const updated = prevConversations.map(conv => {
                const content = streamingResults[conv.modelId] || '';
                const completionTime = modelCompletionTimes[conv.modelId];

                // Check if we already added the new user message
                const hasNewUserMessage = conv.messages.some((msg, idx) =>
                  msg.type === 'user' &&
                  msg.content === input &&
                  idx >= conv.messages.length - 2 // Check last 2 messages (user + assistant)
                );

                if (!hasNewUserMessage) {
                  // Add user message and assistant message if they weren't added during streaming
                  const startTime = modelStartTimes[conv.modelId];
                  return {
                    ...conv,
                    messages: [
                      ...conv.messages,
                      createMessage('user', input, startTime || userTimestamp),
                      createMessage('assistant', content, completionTime || new Date().toISOString())
                    ]
                  };
                } else {
                  // Update the last assistant message with final content and timestamp
                  return {
                    ...conv,
                    messages: conv.messages.map((msg, idx) => {
                      if (idx === conv.messages.length - 1 && msg.type === 'assistant') {
                        return {
                          ...msg,
                          content: content || msg.content, // Ensure content is set
                          timestamp: completionTime || msg.timestamp
                        };
                      }
                      return msg;
                    })
                  };
                }
              });

              // Don't save here - will save after stream completes (see below)
              return updated;
            });
          }

          // Tab switching happens automatically when each model completes (see 'done' event handler above)
          // No need to switch here - it's already been done dynamically as models finished
        } finally {
          reader.releaseLock();

          // Save conversation to history AFTER stream completes
          // For anonymous users: save to localStorage
          // For registered users: reload from API (backend already saved it)
          if (!isAuthenticated && !isFollowUpMode) {
            // Use a small delay to ensure state is fully updated
            setTimeout(() => {
              // Get current conversations state (should be fully updated by now)
              setConversations(currentConversations => {
                const conversationsWithMessages = currentConversations.filter(conv =>
                  selectedModels.includes(conv.modelId) &&
                  conv.messages.length > 0
                );

                // Only save if we have conversations with complete assistant messages (not empty)
                const hasCompleteMessages = conversationsWithMessages.some(conv => {
                  const assistantMessages = conv.messages.filter(msg => msg.type === 'assistant');
                  return assistantMessages.length > 0 && assistantMessages.some(msg => msg.content.trim().length > 0);
                });

                if (hasCompleteMessages && conversationsWithMessages.length > 0) {
                  // Get the FIRST user message from the conversation (not follow-ups)
                  const allUserMessages = conversationsWithMessages
                    .flatMap(conv => conv.messages)
                    .filter(msg => msg.type === 'user')
                    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                  const firstUserMessage = allUserMessages[0];

                  if (firstUserMessage) {
                    const inputData = firstUserMessage.content;
                    // Always save the conversation - saveConversationToLocalStorage handles the 2-conversation limit
                    // by keeping only the 2 most recent conversations
                    const savedId = saveConversationToLocalStorage(inputData, selectedModels, conversationsWithMessages);
                    // Set currentVisibleComparisonId to the saved comparison ID so it shows as active in the dropdown
                    // This allows users to see their saved comparison highlighted in the dropdown right after streaming completes
                    if (savedId) {
                      setCurrentVisibleComparisonId(savedId);
                    }
                  }
                }

                return currentConversations; // Return unchanged
              });
            }, 200);
          } else if (isAuthenticated && !isFollowUpMode) {
            // For registered users, reload history from API after stream completes
            // Backend already saved the conversation, we just need to refresh the list
            setTimeout(async () => {
              await loadHistoryFromAPI();
              // After history is loaded, find the newly saved comparison and set it as active
              // Use a small delay to ensure conversationHistory state is updated
              setTimeout(() => {
                // Access conversationHistory from state using functional update
                setConversationHistory(currentHistory => {
                  setConversations(currentConversations => {
                    const conversationsWithMessages = currentConversations.filter(conv =>
                      selectedModels.includes(conv.modelId) &&
                      conv.messages.length > 0
                    );

                    if (conversationsWithMessages.length > 0) {
                      const allUserMessages = conversationsWithMessages
                        .flatMap(conv => conv.messages)
                        .filter(msg => msg.type === 'user')
                        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                      const firstUserMessage = allUserMessages[0];
                      if (firstUserMessage) {
                        const inputData = firstUserMessage.content;
                        // Find matching conversation in history (should be the most recent one)
                        const matchingConversation = currentHistory.find((summary: ConversationSummary) => {
                          const modelsMatch = JSON.stringify([...summary.models_used].sort()) === JSON.stringify([...selectedModels].sort());
                          const inputMatches = summary.input_data === inputData;
                          return modelsMatch && inputMatches;
                        });

                        if (matchingConversation) {
                          // Set this as the active comparison so it shows as highlighted in dropdown
                          setCurrentVisibleComparisonId(String(matchingConversation.id));
                        }
                      }
                    }

                    return currentConversations;
                  });
                  return currentHistory; // Return unchanged
                });
              }, 100);
            }, 1500); // Give backend more time to finish saving (background task)
          } else if (!isAuthenticated && isFollowUpMode) {
            // Save follow-up updates after stream completes (anonymous users)
            setTimeout(() => {
              setConversations(currentConversations => {
                const conversationsWithMessages = currentConversations.filter(conv =>
                  selectedModels.includes(conv.modelId) &&
                  conv.messages.length > 0
                );

                // Only save if we have conversations with complete assistant messages (not empty)
                const hasCompleteMessages = conversationsWithMessages.some(conv => {
                  const assistantMessages = conv.messages.filter(msg => msg.type === 'assistant');
                  return assistantMessages.length > 0 && assistantMessages.some(msg => msg.content.trim().length > 0);
                });

                if (hasCompleteMessages && conversationsWithMessages.length > 0) {
                  // Get the first user message (original query) to identify the conversation
                  const firstUserMessage = conversationsWithMessages
                    .flatMap(conv => conv.messages)
                    .filter(msg => msg.type === 'user')
                    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0];

                  if (firstUserMessage) {
                    const inputData = firstUserMessage.content;
                    // Update existing conversation (isUpdate = true)
                    const savedId = saveConversationToLocalStorage(inputData, selectedModels, conversationsWithMessages, true);
                    // Set currentVisibleComparisonId to the saved comparison ID so it shows as active in the dropdown
                    // This allows users to see their saved comparison highlighted in the dropdown right after streaming completes
                    if (savedId) {
                      setCurrentVisibleComparisonId(savedId);
                    }
                  }
                }

                return currentConversations; // Return unchanged
              });
            }, 200);
          } else if (isAuthenticated && isFollowUpMode) {
            // For registered users, reload history from API after follow-up completes
            // Backend already saved the conversation update, we just need to refresh the list
            setTimeout(async () => {
              await loadHistoryFromAPI();
              // After history is loaded, find the updated comparison and set it as active
              setTimeout(() => {
                // Access conversationHistory from state using functional update
                setConversationHistory((currentHistory: ConversationSummary[]) => {
                  setConversations(currentConversations => {
                    const conversationsWithMessages = currentConversations.filter(conv =>
                      selectedModels.includes(conv.modelId) &&
                      conv.messages.length > 0
                    );

                    if (conversationsWithMessages.length > 0) {
                      const allUserMessages = conversationsWithMessages
                        .flatMap(conv => conv.messages)
                        .filter(msg => msg.type === 'user')
                        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                      const firstUserMessage = allUserMessages[0];
                      if (firstUserMessage) {
                        const inputData = firstUserMessage.content;
                        // Find matching conversation in history
                        const matchingConversation = currentHistory.find((summary: ConversationSummary) => {
                          const modelsMatch = JSON.stringify([...summary.models_used].sort()) === JSON.stringify([...selectedModels].sort());
                          const inputMatches = summary.input_data === inputData;
                          return modelsMatch && inputMatches;
                        });

                        if (matchingConversation) {
                          // Set this as the active comparison so it shows as highlighted in dropdown
                          setCurrentVisibleComparisonId(String(matchingConversation.id));
                        }
                      }
                    }

                    return currentConversations;
                  });
                  return currentHistory; // Return unchanged
                });
              }, 100);
            }, 1500); // Give backend more time to finish saving (background task)
          }
        }
      }

      // Set final response with metadata
      const filteredData = {
        results: streamingResults,
        metadata: streamingMetadata || {
          input_length: input.length,
          models_requested: selectedModels.length,
          models_successful: Object.keys(streamingResults).filter(
            modelId => !streamingResults[modelId].startsWith('Error')
          ).length,
          models_failed: Object.keys(streamingResults).filter(
            modelId => streamingResults[modelId].startsWith('Error')
          ).length,
          timestamp: new Date().toISOString(),
          processing_time_ms: Date.now() - startTime
        }
      };

      setResponse(filteredData);

      // Deselect Extended mode after successful Extended request
      if (isExtendedMode) {
        setIsExtendedMode(false);
      }

      // Clear input field only if at least one model succeeded
      // Keep input if all models failed so user can retry without retyping
      if (filteredData.metadata.models_successful > 0) {
        setInput('');
      }

      // Track usage only if at least one model succeeded
      // Don't count failed comparisons where all models had errors
      if (filteredData.metadata.models_successful > 0) {
        // Refresh user data if authenticated to update usage count
        if (isAuthenticated) {
          try {
            await refreshUser();
          } catch (error) {
            console.error('Failed to refresh user data:', error);
          }
        }

        // Sync with backend to get the actual count (backend now counts after success)
        try {
          const response = await fetch(`${API_URL}/rate-limit-status?fingerprint=${encodeURIComponent(browserFingerprint)}`);
          if (response.ok) {
            const data = await response.json();
            // Backend returns 'fingerprint_usage' or 'daily_usage' for anonymous users
            const newCount = data.fingerprint_usage || data.daily_usage || 0;
            setUsageCount(newCount);

            // Sync extended usage from backend if available
            const newExtendedCount = data.fingerprint_extended_usage || data.daily_extended_usage;
            if (newExtendedCount !== undefined) {
              setExtendedUsageCount(newExtendedCount);
            }

            // Update localStorage to match backend
            const today = new Date().toDateString();
            localStorage.setItem('compareai_usage', JSON.stringify({
              count: newCount,
              date: today
            }));

            // Update extended usage in localStorage if synced from backend
            if (newExtendedCount !== undefined) {
              localStorage.setItem('compareai_extended_usage', JSON.stringify({
                count: newExtendedCount,
                date: today
              }));
            }
          } else {
            // Fallback to local increment if backend sync fails
            const newUsageCount = usageCount + selectedModels.length;
            setUsageCount(newUsageCount);

            // Calculate if this was an extended interaction - reuse variables from above

            // Update Extended usage if using Extended tier (1 per request, not per model)
            if (shouldUseExtendedTier) {
              const newExtendedUsageCount = extendedUsageCount + 1;
              setExtendedUsageCount(newExtendedUsageCount);
            }

            const today = new Date().toDateString();
            localStorage.setItem('compareai_usage', JSON.stringify({
              count: newUsageCount,
              date: today
            }));

            // Store Extended usage separately (1 per request, not per model)
            if (shouldUseExtendedTier) {
              localStorage.setItem('compareai_extended_usage', JSON.stringify({
                count: extendedUsageCount + 1,
                date: today
              }));
            }
          }
        } catch (error) {
          console.error('Failed to sync usage count after comparison:', error);
          // Fallback to local increment (increment by number of models used)
          const newUsageCount = usageCount + selectedModels.length;
          setUsageCount(newUsageCount);

          // Calculate if this was an extended interaction - reuse variables from above

          // Update Extended usage if using Extended tier (1 per request, not per model)
          if (shouldUseExtendedTier) {
            const newExtendedUsageCount = extendedUsageCount + 1;
            setExtendedUsageCount(newExtendedUsageCount);
          }

          const today = new Date().toDateString();
          localStorage.setItem('compareai_usage', JSON.stringify({
            count: newUsageCount,
            date: today
          }));

          // Store Extended usage separately (1 per request, not per model)
          if (shouldUseExtendedTier) {
            localStorage.setItem('compareai_extended_usage', JSON.stringify({
              count: extendedUsageCount + 1,
              date: today
            }));
          }
        }
      } else {
        // All models failed - show a message but don't count it
        setError('All models failed to respond. This comparison did not count towards your daily limit. Please try again in a moment.');
        // Clear the error after 8 seconds
        setTimeout(() => {
          setError(null);
        }, 8000);
        // Note: Input is NOT cleared when all models fail - user can retry without retyping
      }

      // Initialize or update conversations
      if (isFollowUpMode) {
        // For follow-up mode, messages were already added during streaming
        // Just scroll to show the results

        // Scroll conversations to show the last user message
        setTimeout(() => {
          scrollConversationsToBottom();
        }, 600);
      } else {
        // For initial comparison (non-follow-up), conversations were already initialized during streaming
        // with individual model timestamps. Don't reinitialize here as it would override them!

        // Scroll conversations to show the last user message for initial conversations too
        setTimeout(() => {
          scrollConversationsToBottom();
        }, 500);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        if (userCancelledRef.current) {
          const elapsedTime = Date.now() - startTime;
          const elapsedSeconds = (elapsedTime / 1000).toFixed(1);
          setError(`Comparison cancelled by user after ${elapsedSeconds} seconds`);
        } else {
          const timeoutMinutes = Math.floor(dynamicTimeout / 60000);
          const timeoutSeconds = Math.floor((dynamicTimeout % 60000) / 1000);
          const modelText = selectedModels.length === 1 ? 'model' : 'models';
          const suggestionText = selectedModels.length === 1
            ? 'Please wait a moment and try again.'
            : 'Try selecting fewer models, or wait a moment and try again.';
          setError(`Request timed out after ${timeoutMinutes}:${timeoutSeconds.toString().padStart(2, '0')} (${selectedModels.length} ${modelText}). ${suggestionText}`);
        }
      } else if (err instanceof Error && err.message.includes('Failed to fetch')) {
        setError('Unable to connect to the server. Please check if the backend is running.');
      } else if (err instanceof Error) {
        setError(err.message || 'An unexpected error occurred');
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setCurrentAbortController(null);
      userCancelledRef.current = false;
      setIsLoading(false);
    }
  };

  // Helper function to render usage preview (used in both regular and follow-up modes)
  const renderUsagePreview = () => {
    const userTier = isAuthenticated ? user?.subscription_tier || 'free' : 'anonymous';

    // Define regular limits for each tier
    const REGULAR_LIMITS: { [key: string]: number } = {
      anonymous: 10,
      free: 20,
      starter: 50,
      starter_plus: 100,
      pro: 200,
      pro_plus: 400
    };

    const regularLimit = REGULAR_LIMITS[userTier] || REGULAR_LIMITS.anonymous;
    const extendedLimit = EXTENDED_TIER_LIMITS[userTier] || EXTENDED_TIER_LIMITS.anonymous;

    // Calculate current usage
    const currentRegularUsage = isAuthenticated && user
      ? user.daily_usage_count
      : usageCount;
    const currentExtendedUsage = isAuthenticated && user
      ? user.daily_extended_usage
      : extendedUsageCount;

    // Extended mode is based on isExtendedMode flag
    const isExtendedInteraction = isExtendedMode;

    // Calculate what will be used
    const regularToUse = selectedModels.length;
    const extendedToUse = isExtendedInteraction ? 1 : 0; // Extended counts as 1 per request, not per model

    // Calculate remaining
    const regularRemaining = Math.max(0, regularLimit - currentRegularUsage);
    const extendedRemaining = Math.max(0, extendedLimit - currentExtendedUsage);

    return (
      <div className={isExtendedInteraction ? "usage-preview-extended" : ""} style={{
        marginTop: '0.5rem',
        fontSize: '0.825rem',
        color: 'rgba(255, 255, 255, 0.85)'
      }}>
        <span className={isExtendedInteraction ? "usage-preview-item" : ""}>
          <strong>{regularToUse}</strong> {regularToUse === 1 ? 'model' : 'models'} selected of <strong>{regularRemaining}</strong> remaining model response{regularRemaining !== 1 ? 's' : ''}
        </span>
        {isExtendedInteraction && (
          <span className="usage-preview-item">
            <span className="usage-preview-separator"> • </span>
            <strong>{extendedToUse}</strong> extended use selected of <strong>{extendedRemaining}</strong> remaining
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="app">
      {/* Mock Mode Banner - Show when mock mode is enabled for current user */}
      {user?.mock_mode_enabled && currentView === 'main' && (
        <div className="mock-mode-banner">
          <div className="mock-mode-banner-content">
            <span className="mock-mode-icon">🎭</span>
            <span className="mock-mode-text">
              <strong>Mock Mode Active</strong> - Using test responses instead of real API calls
              {import.meta.env.DEV && <span className="dev-mode-indicator"> (Dev Mode)</span>}
            </span>
          </div>
        </div>
      )}

      {/* Anonymous Mock Mode Banner - Show when anonymous mock mode is enabled (development only) */}
      {!user && anonymousMockModeEnabled && currentView === 'main' && (
        <div className="mock-mode-banner">
          <div className="mock-mode-banner-content">
            <span className="mock-mode-icon">🎭</span>
            <span className="mock-mode-text">
              <strong>Anonymous Mock Mode Active</strong> - Using test responses instead of real API calls
              <span className="dev-mode-indicator"> (Dev Mode)</span>
            </span>
          </div>
        </div>
      )}

      {/* Admin Panel - Show if user is admin and in admin view */}
      {currentView === 'admin' && user?.is_admin ? (
        <AdminPanel onClose={() => setCurrentView('main')} />
      ) : (
        <>
          {/* Done Selecting? Floating Card - Fixed position at screen center */}
          {showDoneSelectingCard && (
            <div className="done-selecting-card">
              <div className="done-selecting-content">
                <h3>Done Selecting?</h3>
                <button
                  onClick={handleDoneSelecting}
                  className="done-selecting-button"
                  aria-label="Done selecting models"
                >
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 2L8 20L2 16" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          <header className="app-header">
            <nav className="navbar">
              <div className="nav-brand">
                <div className="brand-logo">
                  <svg className="logo-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Background circle */}
                    <circle cx="24" cy="24" r="24" fill="url(#logoGradient)" />

                    {/* AI Brain/Neural Network Pattern */}
                    <g>
                      {/* Central node */}
                      <circle cx="24" cy="24" r="3" fill="white" />

                      {/* Left side nodes */}
                      <circle cx="12" cy="18" r="2" fill="white" opacity="0.9" />
                      <circle cx="12" cy="24" r="2" fill="white" opacity="0.9" />
                      <circle cx="12" cy="30" r="2" fill="white" opacity="0.9" />

                      {/* Right side nodes */}
                      <circle cx="36" cy="18" r="2" fill="white" opacity="0.9" />
                      <circle cx="36" cy="24" r="2" fill="white" opacity="0.9" />
                      <circle cx="36" cy="30" r="2" fill="white" opacity="0.9" />

                      {/* Connection lines */}
                      <line x1="14" y1="18" x2="21" y2="21" stroke="white" strokeWidth="1.5" opacity="0.7" />
                      <line x1="14" y1="24" x2="21" y2="24" stroke="white" strokeWidth="1.5" opacity="0.7" />
                      <line x1="14" y1="30" x2="21" y2="27" stroke="white" strokeWidth="1.5" opacity="0.7" />

                      <line x1="27" y1="21" x2="34" y2="18" stroke="white" strokeWidth="1.5" opacity="0.7" />
                      <line x1="27" y1="24" x2="34" y2="24" stroke="white" strokeWidth="1.5" opacity="0.7" />
                      <line x1="27" y1="27" x2="34" y2="30" stroke="white" strokeWidth="1.5" opacity="0.7" />

                      {/* Comparison arrows */}
                      <path d="M16 15 L20 12 L20 14 L28 14 L28 12 L32 15 L28 18 L28 16 L20 16 L20 18 Z"
                        fill="white" opacity="0.8" />
                      <path d="M16 33 L20 30 L20 32 L28 32 L28 30 L32 33 L28 36 L28 34 L20 34 L20 36 Z"
                        fill="white" opacity="0.8" />
                    </g>

                    <defs>
                      <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#2563eb" />
                        <stop offset="50%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#1d4ed8" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="brand-text">
                    <h1>CompareIntel</h1>
                    <span className="brand-tagline">AI Model Comparison Platform</span>
                  </div>
                </div>
              </div>

              <div className="nav-actions">
                {isAuthenticated ? (
                  <>
                    {user?.is_admin && (
                      <button
                        className="admin-avatar-button"
                        onClick={() => setCurrentView(currentView === 'admin' ? 'main' : 'admin')}
                        title={currentView === 'admin' ? 'Back to Main App' : 'Admin Panel'}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2L2 7l10 5 10-5-10-5z" />
                          <path d="M2 17l10 5 10-5" />
                          <path d="M2 12l10 5 10-5" />
                        </svg>
                      </button>
                    )}
                    <UserMenu />
                  </>
                ) : (
                  <>
                    <button
                      className="nav-button-text"
                      onClick={() => {
                        setAuthModalMode('login');
                        setIsAuthModalOpen(true);
                      }}
                    >
                      Sign In
                    </button>
                    <button
                      className="nav-button-primary"
                      onClick={() => {
                        setAuthModalMode('register');
                        setIsAuthModalOpen(true);
                      }}
                    >
                      Sign Up
                    </button>
                  </>
                )}
              </div>
            </nav>
          </header>

          {/* Email verification banners - placed between header and main content */}
          {/* Only show VerifyEmail if we're NOT in password reset mode */}
          {!showPasswordReset && !authLoading && (
            <>
              <VerifyEmail onClose={() => { }} externalToken={verificationToken} suppressVerification={suppressVerification} />
              <VerificationBanner />
            </>
          )}

          {/* Password reset modal */}
          {showPasswordReset && (
            <ResetPassword onClose={handlePasswordResetClose} />
          )}

          <main className="app-main">
            <div className="hero-section">
              <div className="hero-content">
                <h2 className="hero-title">Compare AI Models{" "}<span className="hero-title-second-line">Side by Side</span></h2>
                <p className="hero-subtitle">Get concurrent responses from multiple AI models to find the best solution for your needs</p>

                <div className="hero-capabilities">
                  <div
                    className="capability-tile"
                    onClick={() => handleCapabilityTileTap('natural-language')}
                  >
                    <div className="capability-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                      </svg>
                    </div>
                    <h3 className="capability-title">Natural Language</h3>
                    <p className="capability-description">Compare conversational responses</p>
                    <div className={`capability-tooltip ${visibleTooltip === 'natural-language' ? 'visible' : ''}`}>
                      Natural Language: Compare conversational responses
                    </div>
                  </div>

                  <div
                    className="capability-tile"
                    onClick={() => handleCapabilityTileTap('code-generation')}
                  >
                    <div className="capability-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="16 18 22 12 16 6"></polyline>
                        <polyline points="8 6 2 12 8 18"></polyline>
                      </svg>
                    </div>
                    <h3 className="capability-title">Code Generation</h3>
                    <p className="capability-description">Evaluate programming capabilities</p>
                    <div className={`capability-tooltip ${visibleTooltip === 'code-generation' ? 'visible' : ''}`}>
                      Code Generation: Evaluate programming capabilities
                    </div>
                  </div>

                  <div
                    className="capability-tile"
                    onClick={() => handleCapabilityTileTap('formatted-math')}
                  >
                    <div className="capability-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 12h3l3 7 5-14h7"></path>
                      </svg>
                    </div>
                    <h3 className="capability-title">Formatted Math</h3>
                    <p className="capability-description">Render math equations beautifully</p>
                    <div className={`capability-tooltip ${visibleTooltip === 'formatted-math' ? 'visible' : ''}`}>
                      Formatted Math: Render mathematical equations beautifully
                    </div>
                  </div>
                </div>

                <div className="hero-input-section">
                  <div className="follow-up-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    {isFollowUpMode ? (
                      <>
                        <h2 style={{ margin: 0 }}>
                          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Follow Up Mode
                        </h2>
                        <button
                          onClick={handleNewComparison}
                          className="textarea-icon-button new-inquiry-button"
                          title="Exit follow up mode"
                          disabled={isLoading}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            minWidth: '32px',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            style={{
                              width: '22px',
                              height: '22px',
                              display: 'block',
                              margin: 0,
                              transform: 'translate(0px, 1px)'
                            }}
                          >
                            <path d="M12 2v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                          </svg>
                        </button>
                        <span style={{
                          fontSize: 'clamp(1.25rem, 3vw, 1.5rem)',
                          fontWeight: 700,
                          color: 'transparent',
                          textAlign: 'center',
                          margin: 0,
                          letterSpacing: '-0.025em',
                          textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                          background: 'linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%)',
                          WebkitBackgroundClip: 'text',
                          backgroundClip: 'text'
                        }}>
                          {conversations.length > 0 ? (conversations[0]?.messages.length || 0) + (input.trim() ? 1 : 0) : 0} message context
                        </span>
                      </>
                    ) : (
                      <h2>Enter Your Prompt</h2>
                    )}
                  </div>

                  <div className={`textarea-container ${isAnimatingTextarea ? 'animate-pulse-border' : ''}`}>
                    {/* History Toggle Button - Left side inside textarea */}
                    <div className="history-toggle-wrapper">
                      <button
                        type="button"
                        className={`history-toggle-button ${showHistoryDropdown ? 'active' : ''}`}
                        onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
                        title="Load previous conversations"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>
                    </div>

                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (isFollowUpMode) {
                            handleContinueConversation();
                          } else {
                            handleSubmitClick();
                          }
                        }
                      }}
                      placeholder={isFollowUpMode
                        ? "Enter your follow-up here"
                        : "Let's get started..."
                      }
                      className="hero-input-textarea"
                      rows={1}
                    />

                    {/* History List - Inline, extends textarea depth */}
                    {showHistoryDropdown && (() => {
                      // Show all items in history - no filtering
                      // Active comparison will be visually indicated

                      // Hide scrollbar when tier limit is 3 or less (anonymous: 2, free: 3)
                      // Show scrollbar for tiers with more than 3 saved comparisons
                      const shouldHideScrollbar = historyLimit <= 3;

                      // Calculate max-height based on tier limit:
                      // Each item is approximately: padding (1rem top + 1rem bottom) + prompt (~22px) + margin (0.5rem) + meta (~14px) ≈ ~80-85px
                      // Message is approximately: padding (0.5rem top + 0.5rem bottom) + text (~40px) ≈ ~60px
                      // Anonymous (2 items + message): ~170px + ~60px = ~230px
                      // Free (3 items + message): ~255px + ~60px = ~315px
                      // Others: 300px (shows 3 with scroll, message would be scrollable)
                      const getMaxHeight = () => {
                        // Check if we're showing the tier limit message (when at display limit)
                        const displayedCount = Math.min(conversationHistory.length, historyLimit);
                        const userTier = isAuthenticated ? user?.subscription_tier || 'free' : 'anonymous';
                        const tierLimits: { [key: string]: number } = {
                          anonymous: 2,
                          free: 3,
                          starter: 10,
                          starter_plus: 20,
                          pro: 50,
                          pro_plus: 100,
                        };
                        const tierLimit = tierLimits[userTier] || 2;
                        const isShowingMessage = displayedCount === tierLimit;

                        if (historyLimit === 2) {
                          // Anonymous: 2 items + message if at limit
                          return isShowingMessage ? '230px' : '170px';
                        }
                        if (historyLimit === 3) {
                          // Free: 3 items + message if at limit
                          return isShowingMessage ? '315px' : '255px';
                        }
                        // For higher tiers (starter, pro, etc.): Show 3 items initially, or 3 items + message if at limit
                        // The message will be visible in the scrollable area for tiers with many items
                        // For tiers with 10+ items, showing all items + message would be too tall, so scrollable is appropriate
                        return isShowingMessage ? '360px' : '300px'; // Add ~60px for message on higher tiers too
                      };

                      return (
                        <div
                          className={`history-inline-list ${shouldHideScrollbar ? 'no-scrollbar' : 'scrollable'}`}
                          style={{ maxHeight: getMaxHeight() }}
                        >
                          {isLoadingHistory ? (
                            <div className="history-loading">Loading...</div>
                          ) : conversationHistory.length === 0 ? (
                            <div className="history-empty">No conversation history</div>
                          ) : (
                            <>
                              {conversationHistory
                                .slice(0, historyLimit) // Limit to tier's maximum saved comparisons
                                .map((summary) => {
                                  const truncatePrompt = (text: string, maxLength: number = 60) => {
                                    if (text.length <= maxLength) return text;
                                    return text.substring(0, maxLength) + '...';
                                  };

                                  const formatDate = (dateString: string) => {
                                    const date = new Date(dateString);
                                    const now = new Date();
                                    const diffMs = now.getTime() - date.getTime();
                                    const diffMins = Math.floor(diffMs / 60000);
                                    const diffHours = Math.floor(diffMs / 3600000);
                                    const diffDays = Math.floor(diffMs / 86400000);

                                    if (diffMins < 1) return 'Just now';
                                    if (diffMins < 60) return `${diffMins}m ago`;
                                    if (diffHours < 24) return `${diffHours}h ago`;
                                    if (diffDays === 1) return 'Yesterday';
                                    if (diffDays < 7) return `${diffDays}d ago`;
                                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                  };

                                  // Check if this is the currently active/selected comparison
                                  const isActive = currentVisibleComparisonId && String(summary.id) === currentVisibleComparisonId;

                                  return (
                                    <div
                                      key={summary.id}
                                      className={`history-item ${isActive ? 'history-item-active' : ''}`}
                                      onClick={() => loadConversation(summary)}
                                      title={summary.input_data}
                                    >
                                      <div className="history-item-content">
                                        <div className="history-item-prompt">{truncatePrompt(summary.input_data)}</div>
                                        <div className="history-item-meta">
                                          <span className="history-item-models">{summary.models_used.length} model{summary.models_used.length !== 1 ? 's' : ''}</span>
                                          <span className="history-item-date">{formatDate(summary.created_at)}</span>
                                        </div>
                                      </div>
                                      <button
                                        className="history-item-delete"
                                        onClick={(e) => deleteConversation(summary, e)}
                                        title="Delete conversation"
                                        aria-label="Delete conversation"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  );
                                })}

                              {/* Tier limit message for users at limit - only for Anonymous and Free tiers */}
                              {(() => {
                                const userTier = isAuthenticated ? user?.subscription_tier || 'free' : 'anonymous';
                                const tierLimits: { [key: string]: number } = {
                                  anonymous: 2,
                                  free: 3,
                                  starter: 10,
                                  starter_plus: 20,
                                  pro: 50,
                                  pro_plus: 100,
                                };
                                const tierLimit = tierLimits[userTier] || 2;

                                // Only show message for anonymous and free tiers
                                if (userTier !== 'anonymous' && userTier !== 'free') {
                                  return null;
                                }

                                // Check if the number of visible items in the dropdown equals or exceeds the tier limit
                                // For free tier: show message when 3+ items are visible (meaning user has reached storage limit of 4)
                                // For anonymous: show message when 2+ items are visible
                                const visibleCount = conversationHistory.length;
                                // Show message when we have tierLimit or more items (after filtering)
                                // This indicates user has reached their storage limit (tierLimit + 1 saved)
                                const isAtLimit = visibleCount >= tierLimit;

                                if (!isAtLimit) {
                                  return null;
                                }

                                if (!isAuthenticated) {
                                  return (
                                    <div className="history-signup-prompt">
                                      <div className="history-signup-message">
                                        <span className="history-signup-line">You can only save the last 2 comparisons.</span>
                                        <span className="history-signup-line"> Sign up for a free account to save more!</span>
                                      </div>
                                    </div>
                                  );
                                } else {
                                  // For free tier, show a specific reminder about the 3 saves limit
                                  return (
                                    <div className="history-signup-prompt">
                                      <div className="history-signup-message">
                                        <span className="history-signup-line">You only have 3 saves for your tier.</span>
                                        <span className="history-signup-line"> Upgrade to Starter for 10 saved comparisons or Pro for 50!</span>
                                      </div>
                                    </div>
                                  );
                                }
                              })()}
                            </>
                          )}
                        </div>
                      );
                    })()}

                    <div className="textarea-actions">
                      {(() => {
                        // Check if user has reached daily limits
                        const userTier = isAuthenticated ? user?.subscription_tier || 'free' : 'anonymous';

                        // Define regular limits for each tier
                        const REGULAR_LIMITS: { [key: string]: number } = {
                          anonymous: 10,
                          free: 20,
                          starter: 50,
                          starter_plus: 100,
                          pro: 200,
                          pro_plus: 400
                        };

                        const regularLimit = REGULAR_LIMITS[userTier] || REGULAR_LIMITS.anonymous;
                        const extendedLimit = EXTENDED_TIER_LIMITS[userTier] || EXTENDED_TIER_LIMITS.anonymous;

                        // Calculate current usage
                        const currentRegularUsage = isAuthenticated && user
                          ? user.daily_usage_count
                          : usageCount;
                        const currentExtendedUsage = isAuthenticated && user
                          ? user.daily_extended_usage
                          : extendedUsageCount;

                        const regularRemaining = regularLimit - currentRegularUsage;
                        const hasReachedExtendedLimit = currentExtendedUsage >= extendedLimit;
                        const hasNoRemainingRegularResponses = regularRemaining <= 0;

                        const handleClick = (e: React.MouseEvent) => {
                          if ((hasReachedExtendedLimit || hasNoRemainingRegularResponses) && !isExtendedMode) {
                            e.preventDefault();
                            e.stopPropagation();
                            return;
                          }
                          handleExtendedModeToggle();
                        };

                        const getTitle = () => {
                          if (isExtendedMode) {
                            return 'Disable Extended mode)';
                          }
                          if (hasNoRemainingRegularResponses) {
                            return `No remaining model responses today.${userTier === 'anonymous' ? ' Sign up for a free account to get 20 model responses per day!' : ' Paid tiers with higher limits will be available soon!'}`;
                          }
                          if (hasReachedExtendedLimit) {
                            return `Daily Extended tier limit of ${extendedLimit} interactions reached`;
                          }
                          // Format tier name for display (handle _plus suffix specially)
                          let tierDisplayName: string;
                          if (userTier.endsWith('_plus')) {
                            const baseTier = userTier.replace('_plus', '');
                            tierDisplayName = baseTier.charAt(0).toUpperCase() + baseTier.slice(1) + '+';
                          } else {
                            tierDisplayName = userTier.split('_')
                              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                              .join(' ');
                          }
                          return `${tierDisplayName} tier users get ${extendedLimit} extended interactions`;
                        };

                        return (
                          <button
                            className={`extended-mode-button ${isExtendedMode ? 'active' : ''} ${getExtendedRecommendation(input) ? 'recommended' : ''}`}
                            onClick={handleClick}
                            disabled={isLoading}
                            style={(hasReachedExtendedLimit || hasNoRemainingRegularResponses) && !isLoading ? { cursor: 'not-allowed' } : undefined}
                            title={getTitle()}
                          >
                            E
                          </button>
                        );
                      })()}
                      <button
                        ref={compareButtonRef}
                        onClick={isFollowUpMode ? handleContinueConversation : handleSubmitClick}
                        disabled={(() => {
                          // Check if input exceeds tier limit
                          const usesExtendedTier = isExtendedMode; // Only extended if explicitly enabled
                          const tierLimit = usesExtendedTier ? 15000 : 5000;
                          const exceedsLimit = input.length > tierLimit;

                          return isLoading ||
                            exceedsLimit ||
                            (isFollowUpMode && conversations.length > 0 && (conversations[0]?.messages.length || 0) >= 24);
                        })()}
                        className={`textarea-icon-button submit-button ${!isFollowUpMode && (selectedModels.length === 0 || !input.trim()) ? 'not-ready' : ''} ${isAnimatingButton ? 'animate-pulse-glow' : ''}`}
                        title={(() => {
                          const msgCount = conversations.length > 0 ? conversations[0]?.messages.length || 0 : 0;
                          if (msgCount >= 24) return 'Maximum conversation length reached - start a new comparison';
                          const usesExtendedTier = isExtendedMode; // Only extended if explicitly enabled
                          const tierLimit = usesExtendedTier ? 15000 : 5000;
                          if (input.length > tierLimit) return `Input exceeds ${usesExtendedTier ? 'Extended' : 'Standard'} tier limit - reduce length or enable Extended mode`;
                          return isFollowUpMode ? 'Continue conversation' : 'Compare models';
                        })()}
                      >
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M7 14l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Usage Preview - Regular Mode */}
                  {!isFollowUpMode && selectedModels.length > 0 && input.trim() && renderUsagePreview()}

                  {/* Context Warning & Usage Preview - Industry Best Practice 2025 */}
                  {isFollowUpMode && conversations.length > 0 && (() => {
                    const messageCount = conversations[0]?.messages.length || 0;

                    // Calculate warning level - encourage starting fresh conversations at appropriate intervals
                    let warningLevel: 'info' | 'medium' | 'high' | 'critical' | null = null;
                    let warningMessage = '';
                    let warningIcon = '';

                    if (messageCount >= 24) {
                      warningLevel = 'critical';
                      warningIcon = '🚫';
                      warningMessage = 'Maximum conversation length reached (24 messages). Please start a fresh comparison for continued assistance.';
                    } else if (messageCount >= 20) {
                      warningLevel = 'critical';
                      warningIcon = '✨';
                      warningMessage = 'Time for a fresh start! Starting a new comparison will give you the best response quality and speed.';
                    } else if (messageCount >= 14) {
                      warningLevel = 'high';
                      warningIcon = '💡';
                      warningMessage = 'Consider starting a fresh comparison! New conversations help maintain optimal context and response quality.';
                    } else if (messageCount >= 10) {
                      warningLevel = 'medium';
                      warningIcon = '🎯';
                      warningMessage = 'Pro tip: Fresh comparisons provide more focused and relevant responses!';
                    } else if (messageCount >= 6) {
                      warningLevel = 'info';
                      warningIcon = 'ℹ️';
                      warningMessage = 'Reminder: Starting a new comparison helps keep responses sharp and context-focused.';
                    }

                    return (
                      <>
                        {/* Usage Preview - Simple text line */}
                        {messageCount > 0 && renderUsagePreview()}

                        {/* Context Warning - Claude-style */}
                        {warningLevel && (
                          <div style={{
                            padding: '0.875rem 1rem',
                            background: warningLevel === 'critical'
                              ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.15))'
                              : warningLevel === 'high'
                                ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.15))'
                                : 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(37, 99, 235, 0.12))',
                            borderRadius: '12px',
                            marginTop: '0.75rem',
                            fontSize: '0.875rem',
                            border: `1px solid ${warningLevel === 'critical'
                              ? 'rgba(239, 68, 68, 0.3)'
                              : warningLevel === 'high'
                                ? 'rgba(251, 191, 36, 0.3)'
                                : 'rgba(120, 170, 255, 0.35)'
                              }`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem'
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{
                                color: 'rgba(255, 255, 255, 0.95)',
                                marginBottom: '0.25rem',
                                fontWeight: '500'
                              }}>
                                <span style={{ marginRight: '0.5rem' }}>{warningIcon}</span>{warningMessage}
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}

                </div>
              </div>
            </div>

            {error && (
              <div className="error-message">
                <span>⚠️ {error}</span>
              </div>
            )}


            <section className="models-section" ref={modelsSectionRef}>
              <div
                className="models-section-header"
                data-has-models={selectedModels.length > 0 && isWideLayout ? 'true' : undefined}
                onClick={() => setIsModelsHidden(!isModelsHidden)}
                style={{
                  // On wide layout, reserve space for the selected models column (and external toggle only when shown outside)
                  // Keep padding consistent whether collapsed or not when models are selected
                  // Force the padding-right value to ensure it overrides CSS media query
                  ...(isWideLayout && selectedModels.length > 0 ? {
                    paddingRight: 'calc(340px + 2rem + 2.5rem)',
                  } : {}),
                  ...(isWideLayout && selectedModels.length === 0 ? {
                    paddingRight: isModelsHidden ? 'calc(36px + 2rem)' : '0'
                  } : {}),
                  // Always center items vertically
                  alignItems: 'center'
                }}
              >
                <div className="models-header-title">
                  <h2 style={{ margin: 0 }}>
                    {isFollowUpMode ? 'Selected Models (Follow-up Mode)' : 'Select Models to Compare'}
                  </h2>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
                    {isFollowUpMode
                      ? 'You can deselect models or reselect previously selected ones (minimum 1 model required)'
                      : `Choose up to ${maxModelsLimit} models${!isAuthenticated ? ' (Anonymous Tier)' : user?.subscription_tier ? (() => {
                        const parts = user.subscription_tier.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1));
                        // Replace "Plus" with "+" when it appears after another word
                        const formatted = parts.length > 1 && parts[1] === 'Plus'
                          ? parts[0] + '+'
                          : parts.join(' ');
                        return ` (${formatted} Tier)`;
                      })() : ''}`
                    }
                  </p>
                </div>
                <div
                  className="models-header-controls"
                  style={{
                    justifyContent: isWideLayout ? 'flex-end' : undefined,
                    alignSelf: isWideLayout ? 'center' : undefined,
                    marginLeft: isWideLayout ? 'auto' : undefined,
                    marginTop: 0,
                    position: isWideLayout ? 'absolute' : undefined,
                    top: isWideLayout ? '50%' : undefined,
                    right: isWideLayout ? '1rem' : undefined,
                    transform: isWideLayout ? 'translateY(-50%)' : undefined
                  }}
                >
                  <div className="models-header-buttons">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedModels([]);
                      }}
                      disabled={selectedModels.length === 0 || isFollowUpMode}
                      style={{
                        padding: 0,
                        fontSize: '0.75rem',
                        border: 'none',
                        background: 'transparent',
                        color: (selectedModels.length === 0 || isFollowUpMode) ? '#9ca3af' : '#dc2626',
                        borderRadius: '6px',
                        cursor: (selectedModels.length === 0 || isFollowUpMode) ? 'not-allowed' : 'pointer',
                        opacity: (selectedModels.length === 0 || isFollowUpMode) ? 0.5 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: 'var(--models-header-control-height)',
                        aspectRatio: '1 / 1'
                      }}
                      title={isFollowUpMode ? 'Cannot clear models during follow-up' : 'Clear all selections'}
                      aria-label={isFollowUpMode ? 'Cannot clear models during follow-up' : 'Clear all selections'}
                    >
                      {/* Square with X icon (deselect all) */}
                      <svg
                        viewBox="0 0 24 24" fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                        style={{ height: '100%', width: '100%' }}
                        preserveAspectRatio="xMidYMid meet"
                      >
                        <rect
                          x="5" y="5" width="14" height="14"
                          stroke={(selectedModels.length === 0 || isFollowUpMode) ? '#9ca3af' : '#dc2626'}
                          strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"
                        />
                        <path
                          d="M9 9l6 6M15 9l-6 6"
                          stroke={(selectedModels.length === 0 || isFollowUpMode) ? '#9ca3af' : '#dc2626'}
                          strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        collapseAllDropdowns();
                      }}
                      disabled={openDropdowns.size === 0}
                      title={"Collapse all model providers"}
                      aria-label={"Collapse all model providers"}
                      style={{
                        padding: 0,
                        fontSize: '0.75rem',
                        border: 'none',
                        background: 'transparent',
                        color: openDropdowns.size === 0 ? '#9ca3af' : '#3b82f6',
                        borderRadius: '6px',
                        cursor: openDropdowns.size === 0 ? 'not-allowed' : 'pointer',
                        opacity: openDropdowns.size === 0 ? 0.5 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: 'var(--models-header-control-height)',
                        aspectRatio: '1 / 1'
                      }}
                    >
                      {/* Double chevrons up icon (collapse all) */}
                      <svg
                        viewBox="0 0 24 24" fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                        style={{ height: '100%', width: '100%' }}
                        preserveAspectRatio="xMidYMid meet"
                      >
                        <path
                          d="M7 13l5-5 5 5M7 18l5-5 5 5"
                          stroke={openDropdowns.size === 0 ? '#9ca3af' : '#3b82f6'}
                          strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                  <div className="models-header-right">
                    <div
                      className="models-count-indicator"
                      title="Total selections"
                      style={{
                        padding: '0.5rem 1rem',
                        background: selectedModels.length >= maxModelsLimit ? '#fef2f2' :
                          selectedModels.length > 0 ? '#667eea' : '#f3f4f6',
                        color: selectedModels.length >= maxModelsLimit ? '#dc2626' :
                          selectedModels.length > 0 ? 'white' : '#6b7280',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        border: `1px solid ${selectedModels.length >= maxModelsLimit ? '#fecaca' : '#e5e7eb'}`
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {selectedModels.length} of {maxModelsLimit} selected
                    </div>
                    <button
                      className="models-toggle-arrow"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsModelsHidden(!isModelsHidden);
                      }}
                      style={{
                        padding: '0.5rem',
                        fontSize: '1.25rem',
                        border: 'none',
                        outline: 'none',
                        boxShadow: 'none',
                        background: 'var(--bg-primary)',
                        color: 'var(--primary-color)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '36px',
                        height: '36px',
                        fontWeight: 'bold'
                      }}
                      title={isModelsHidden ? 'Show model selection' : 'Hide model selection'}
                    >
                      {isModelsHidden ? '▼' : '▲'}
                    </button>
                  </div>
                </div>
              </div>

              {!isModelsHidden && (
                <>
                  {isLoadingModels ? (
                    <div className="loading-message">Loading available models...</div>
                  ) : Object.keys(modelsByProvider).length === 0 ? (
                    <div className="error-message">
                      <p>No models available. Please check the server connection.</p>
                    </div>
                  ) : (
                    <div className="models-selection-layout">
                      <div className="provider-dropdowns">
                        {Object.entries(modelsByProvider).map(([provider, models]) => {
                          const hasSelectedModels = models.some(model => selectedModels.includes(model.id));
                          return (
                            <div key={provider} className={`provider-dropdown ${hasSelectedModels ? 'has-selected-models' : ''}`}>
                              <button
                                className="provider-header"
                                onClick={() => toggleDropdown(provider)}
                                aria-expanded={openDropdowns.has(provider)}
                              >
                                <div className="provider-left">
                                  <span className="provider-name">{provider}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span className="provider-count">
                                    {(() => {
                                      const selectedCount = models.filter(model => selectedModels.includes(model.id)).length;
                                      return `${selectedCount} of ${models.length} selected`;
                                    })()}
                                  </span>
                                  {(() => {
                                    const providerModels = modelsByProvider[provider] || [];
                                    // Filter out unavailable models (where available === false)
                                    const availableProviderModels = providerModels.filter(model => model.available !== false);
                                    const providerModelIds = availableProviderModels.map(model => model.id);
                                    const allProviderModelsSelected = providerModelIds.every(id => selectedModels.includes(id)) && providerModelIds.length > 0;
                                    const hasAnySelected = providerModelIds.some(id => selectedModels.includes(id));
                                    const hasAnyOriginallySelected = providerModelIds.some(id => originalSelectedModels.includes(id));
                                    const isDisabled = (selectedModels.length >= maxModelsLimit && !hasAnySelected) ||
                                      (isFollowUpMode && !hasAnySelected && !hasAnyOriginallySelected);

                                    return (
                                      <div
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (!isDisabled) {
                                            toggleAllForProvider(provider);
                                          }
                                        }}
                                        style={{
                                          padding: '0.25rem 0.5rem',
                                          fontSize: '1.2rem',
                                          border: 'none',
                                          background: 'transparent',
                                          color: isDisabled ? '#9ca3af' : (allProviderModelsSelected ? '#dc2626' : '#667eea'),
                                          cursor: isDisabled ? 'not-allowed' : 'pointer',
                                          opacity: isDisabled ? 0.5 : 1,
                                          display: 'flex',
                                          alignItems: 'center',
                                          transition: 'color 0.2s ease'
                                        }}
                                        title={isDisabled ?
                                          (isFollowUpMode ? 'Cannot add new models during follow-up' : `Cannot select more models (max ${maxModelsLimit} for your tier)`) :
                                          allProviderModelsSelected ? `Deselect All` : `Select All`}
                                      >
                                        ✱
                                      </div>
                                    );
                                  })()}
                                  <span className={`dropdown-arrow ${openDropdowns.has(provider) ? 'open' : ''}`}>
                                    ▼
                                  </span>
                                </div>
                              </button>

                              {openDropdowns.has(provider) && (
                                <div className="provider-models">
                                  {models.map((model) => {
                                    const isSelected = selectedModels.includes(model.id);
                                    const wasOriginallySelected = originalSelectedModels.includes(model.id);
                                    const isUnavailable = model.available === false;
                                    const isDisabled = isUnavailable ||
                                      (selectedModels.length >= maxModelsLimit && !isSelected) ||
                                      (isFollowUpMode && !isSelected && !wasOriginallySelected);
                                    return (
                                      <label
                                        key={model.id}
                                        className={`model-option ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                                        style={{
                                          opacity: isDisabled ? 0.5 : 1,
                                          cursor: isDisabled ? 'not-allowed' : 'pointer',
                                          position: 'relative'
                                        }}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          disabled={isDisabled}
                                          onChange={() => !isDisabled && handleModelToggle(model.id)}
                                          className="model-checkbox"
                                          style={{
                                            borderColor: isFollowUpMode && !isSelected && wasOriginallySelected ? 'red' : undefined
                                          }}
                                        />
                                        <div className="model-info">
                                          <h4>
                                            {model.name}
                                            {isFollowUpMode && !isSelected && !wasOriginallySelected && (
                                              <span
                                                style={{
                                                  fontSize: '0.7rem',
                                                  marginLeft: '0.5rem',
                                                  padding: '0.125rem 0.375rem',
                                                  background: 'rgba(156, 163, 175, 0.2)',
                                                  color: '#6b7280',
                                                  borderRadius: '4px',
                                                  fontWeight: '500'
                                                }}
                                              >
                                                Not in conversation
                                              </span>
                                            )}
                                            {isUnavailable && (
                                              <span
                                                style={{
                                                  fontSize: '0.7rem',
                                                  marginLeft: '0.5rem',
                                                  padding: '0.125rem 0.375rem',
                                                  background: 'rgba(245, 158, 11, 0.2)',
                                                  color: '#d97706',
                                                  borderRadius: '4px',
                                                  fontWeight: '500'
                                                }}
                                              >
                                                Coming Soon
                                              </span>
                                            )}
                                          </h4>
                                          <p>{model.description}</p>
                                        </div>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Selected Models Cards */}
                      {selectedModels.length > 0 && (
                        <div className="selected-models-section">
                          <div
                            ref={selectedModelsGridRef}
                            className="selected-models-grid"
                          >
                            {selectedModels.map((modelId) => {
                              const model = allModels.find(m => m.id === modelId);
                              if (!model) return null;

                              return (
                                <div key={modelId} className="selected-model-card">
                                  <div className="selected-model-header">
                                    <h4>{model.name}</h4>
                                    <button
                                      className="remove-model-btn"
                                      onClick={() => handleModelToggle(modelId)}
                                      aria-label={`Remove ${model.name}`}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                  <p className="selected-model-description">{model.description}</p>
                                </div>
                              );
                            })}
                            {/* Spacer to push cards to bottom when they don't fill the space */}
                            <div className="selected-models-spacer"></div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>

            {/* Usage tracking banner - show for anonymous users who have made comparisons or reached the limit */}
            {!isAuthenticated && (usageCount > 0 || usageCount >= MAX_DAILY_USAGE || (error && (error.includes('Daily limit') || error.includes('daily limit')))) && (
              <div className="usage-tracking-banner" style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                padding: '1rem',
                textAlign: 'center',
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)'
              }}>
                <div className="usage-banner-content">
                  {usageCount < MAX_DAILY_USAGE ? (
                    <>
                      <div className="usage-banner-text-desktop" style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                        {`${MAX_DAILY_USAGE - usageCount} of 10 model responses remaining today • Sign up for 20 free per day`}
                      </div>
                      <div className="usage-banner-text-mobile" style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                        <div>{`${MAX_DAILY_USAGE - usageCount} of 10 model responses remaining today`}</div>
                        <div>Sign up for 20 free per day</div>
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                      Daily limit reached! Sign up for a free account to get 20 model responses per day.
                    </div>
                  )}
                </div>

                {/* Developer reset button - only show in development */}
                {import.meta.env.DEV && (
                  <button
                    onClick={resetUsage}
                    style={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      color: 'white',
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      marginTop: '0.5rem'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                    }}
                  >
                    🔄 Reset Usage (Dev Only)
                  </button>
                )}
              </div>
            )}

            {isLoading && (
              <div className="loading-section">
                <div className="loading-content">
                  <div className="modern-spinner"></div>
                  <p>Processing {selectedModels.length === 1 ? 'response from 1 AI model' : `responses from ${selectedModels.length} AI models`}...</p>
                </div>
                <button
                  onClick={handleCancel}
                  className="cancel-button"
                  aria-label="Stop comparison"
                >
                  <span className="cancel-x">✕</span>
                  <span className="cancel-text">Cancel</span>
                </button>
              </div>
            )}

            {(response || conversations.length > 0) && (
              <section className="results-section">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                  <h2 style={{ margin: 0 }}>Comparison Results</h2>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {/* Scroll Lock Toggle */}
                    <button
                      onClick={() => {
                        setIsScrollLocked(!isScrollLocked);
                      }}
                      style={{
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.875rem',
                        border: '1px solid ' + (isScrollLocked ? 'var(--primary-color)' : '#cccccc'),
                        background: isScrollLocked ? 'var(--primary-color)' : 'transparent',
                        color: isScrollLocked ? 'white' : '#666',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        outline: 'none'
                      }}
                      title={isScrollLocked ? 'Unlock scrolling - Each card scrolls independently' : 'Lock scrolling - All cards scroll together'}
                      onMouseOver={(e) => {
                        if (!isScrollLocked) {
                          e.currentTarget.style.borderColor = '#999';
                          e.currentTarget.style.color = '#333';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!isScrollLocked) {
                          e.currentTarget.style.borderColor = '#cccccc';
                          e.currentTarget.style.color = '#666';
                        }
                      }}
                    >
                      <span>Scroll</span>
                      {isScrollLocked ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="5" y="11" width="14" height="10" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="5" y="11" width="14" height="10" rx="2" ry="2" />
                          <line x1="7" y1="11" x2="7" y2="7" />
                        </svg>
                      )}
                    </button>
                    {!isFollowUpMode && (
                      <button
                        onClick={handleFollowUp}
                        className="follow-up-button"
                        title={isFollowUpDisabled() ? "Cannot follow up when new models are selected. You can follow up if you only deselect models from the original comparison." : "Ask a follow-up question"}
                        disabled={isFollowUpDisabled()}
                      >
                        Follow up
                      </button>
                    )}
                    {closedCards.size > 0 && (
                      <button
                        onClick={showAllResults}
                        style={{
                          padding: '0.5rem 1rem',
                          fontSize: '0.875rem',
                          border: '1px solid var(--primary-color)',
                          background: 'var(--primary-color)',
                          color: 'white',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          fontWeight: '500'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = 'var(--primary-hover)';
                          e.currentTarget.style.borderColor = 'var(--primary-hover)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = 'var(--primary-color)';
                          e.currentTarget.style.borderColor = 'var(--primary-color)';
                        }}
                      >
                        Show All Results ({closedCards.size} hidden)
                      </button>
                    )}
                  </div>
                </div>

                {/* Metadata */}
                {response && (
                  <div className="results-metadata">
                    <div className="metadata-item">
                      <span className="metadata-label">Input Length:</span>
                      <span className="metadata-value">{response.metadata.input_length} characters</span>
                    </div>
                    <div className="metadata-item">
                      <span className="metadata-label">Models Successful:</span>
                      <span className={`metadata-value ${response.metadata.models_successful > 0 ? 'successful' : ''}`}>
                        {response.metadata.models_successful}/{response.metadata.models_requested}
                      </span>
                    </div>
                    {Object.keys(response.results).length > 0 && (
                      <div className="metadata-item">
                        <span className="metadata-label">Results Visible:</span>
                        <span className="metadata-value">
                          {Object.keys(response.results).length - closedCards.size}/{Object.keys(response.results).length}
                        </span>
                      </div>
                    )}
                    {response.metadata.models_failed > 0 && (
                      <div className="metadata-item">
                        <span className="metadata-label">Models Failed:</span>
                        <span className="metadata-value failed">{response.metadata.models_failed}</span>
                      </div>
                    )}
                    {processingTime && (
                      <div className="metadata-item">
                        <span className="metadata-label">Processing Time:</span>
                        <span className="metadata-value">
                          {(() => {
                            if (processingTime < 1000) {
                              return `${processingTime}ms`;
                            } else if (processingTime < 60000) {
                              return `${(processingTime / 1000).toFixed(1)}s`;
                            } else {
                              const minutes = Math.floor(processingTime / 60000);
                              const seconds = Math.floor((processingTime % 60000) / 1000);
                              return `${minutes}m ${seconds}s`;
                            }
                          })()}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="results-grid">
                  {conversations
                    .filter((conv) => selectedModels.includes(conv.modelId) && !closedCards.has(conv.modelId))
                    .map((conversation) => {
                      const model = allModels.find(m => m.id === conversation.modelId);
                      const latestMessage = conversation.messages[conversation.messages.length - 1];
                      const isError = latestMessage?.content.startsWith('Error');
                      const safeId = getSafeId(conversation.modelId);

                      return (
                        <div key={conversation.modelId} className="result-card conversation-card">
                          <div className="result-header">
                            <div className="result-header-top">
                              <h3>{model?.name || conversation.modelId}</h3>
                              <div className="header-buttons-container">
                                <button
                                  className="screenshot-card-btn"
                                  onClick={() => handleScreenshot(conversation.modelId)}
                                  title="Copy formatted chat history"
                                  aria-label={`Copy formatted chat history for ${model?.name || conversation.modelId}`}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="2" y="3" width="20" height="14" rx="2" />
                                    <path d="M8 21h8" />
                                    <path d="M12 17v4" />
                                  </svg>
                                </button>
                                <button
                                  className="copy-response-btn"
                                  onClick={() => handleCopyResponse(conversation.modelId)}
                                  title="Copy raw chat history"
                                  aria-label={`Copy raw chat history from ${model?.name || conversation.modelId}`}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                  </svg>
                                </button>
                                <button
                                  className="close-card-btn"
                                  onClick={() => closeResultCard(conversation.modelId)}
                                  title="Hide this result"
                                  aria-label={`Hide result for ${model?.name || conversation.modelId}`}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 6L6 18" />
                                    <path d="M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            <div className="result-header-bottom">
                              <span className="output-length">{latestMessage?.content.length || 0} chars</span>
                              <div className="result-tabs">
                                <button
                                  className={`tab-button ${(activeResultTabs[conversation.modelId] || 'formatted') === 'formatted' ? 'active' : ''}`}
                                  onClick={() => switchResultTab(conversation.modelId, 'formatted')}
                                >
                                  Formatted
                                </button>
                                <button
                                  className={`tab-button ${(activeResultTabs[conversation.modelId] || 'formatted') === 'raw' ? 'active' : ''}`}
                                  onClick={() => switchResultTab(conversation.modelId, 'raw')}
                                >
                                  Raw
                                </button>
                              </div>
                              <span className={`status ${isError ? 'error' : 'success'}`}>
                                {isError ? 'Failed' : 'Success'}
                              </span>
                            </div>
                          </div>
                          <div className="conversation-content" id={`conversation-content-${safeId}`}>
                            {conversation.messages.map((message) => (
                              <div key={message.id} className={`conversation-message ${message.type}`}>
                                <div className="message-header">
                                  <span className="message-type" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    {message.type === 'user' ? (
                                      <>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <circle cx="12" cy="8" r="4" />
                                          <path d="M20 21a8 8 0 1 0-16 0" />
                                        </svg>
                                        <span>You</span>
                                      </>
                                    ) : (
                                      <>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <rect x="4" y="4" width="16" height="16" rx="2" />
                                          <rect x="9" y="9" width="6" height="6" />
                                          <line x1="9" y1="2" x2="9" y2="4" />
                                          <line x1="15" y1="2" x2="15" y2="4" />
                                          <line x1="9" y1="20" x2="9" y2="22" />
                                          <line x1="15" y1="20" x2="15" y2="22" />
                                          <line x1="20" y1="9" x2="22" y2="9" />
                                          <line x1="20" y1="15" x2="22" y2="15" />
                                          <line x1="2" y1="9" x2="4" y2="9" />
                                          <line x1="2" y1="15" x2="4" y2="15" />
                                        </svg>
                                        <span>AI</span>
                                      </>
                                    )}
                                  </span>
                                  <span className="message-time">
                                    {new Date(message.timestamp).toLocaleTimeString()}
                                  </span>
                                </div>
                                <div className="message-content">
                                  {(activeResultTabs[conversation.modelId] || 'formatted') === 'formatted' ? (
                                    /* Full LaTeX rendering for formatted view */
                                    <LatexRenderer className="result-output">
                                      {message.content}
                                    </LatexRenderer>
                                  ) : (
                                    /* Raw text for immediate streaming display */
                                    <pre className="result-output raw-output">
                                      {message.content}
                                    </pre>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </section>
            )}
          </main>

          {/* Footer */}
          <Footer />

          {/* Auth Modal */}
          <AuthModal
            isOpen={isAuthModalOpen}
            onClose={() => {
              setIsAuthModalOpen(false);
              setLoginEmail(''); // Reset email when modal closes
            }}
            initialMode={authModalMode}
            initialEmail={loginEmail}
          />
        </>
      )}
    </div>
  );
}

// Wrap AppContent with AuthProvider
function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="*" element={<AppContent />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
