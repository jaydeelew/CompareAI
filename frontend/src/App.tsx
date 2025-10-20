import { useState, useEffect, useRef } from 'react';
import './App.css';
import LatexRenderer from './components/LatexRenderer';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthModal, UserMenu, VerifyEmail, VerificationBanner } from './components/auth';
import { AdminPanel } from './components/admin';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface CompareResponse {
  results: { [key: string]: string };
  metadata: {
    input_length: number;
    models_requested: number;
    models_successful: number;
    models_failed: number;
    timestamp: string;
  };
}

interface ConversationMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
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
}

interface ModelsByProvider {
  [provider: string]: Model[];
}

// Maximum number of models that can be selected
const MAX_MODELS_LIMIT = 12;

// Freemium usage limits (anonymous users only)
const MAX_DAILY_USAGE = 5;

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
  const { isAuthenticated, user, refreshUser } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [currentView, setCurrentView] = useState<'main' | 'admin'>('main');

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
      } else if (event.data.type === 'ping') {
        // Another tab is checking if we exist - respond
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
    
    if (token && window.opener === null) {
      // This is a new tab opened from email with a verification token
      // Note: suppressVerification is already true from initial state
      
      // Ping to see if there's an existing CompareIntel tab
      channel.postMessage({ type: 'ping' });
      
      // Wait a moment to see if any existing tab responds
      setTimeout(() => {
        if (hasExistingTab) {
          // An existing tab exists - send verification token to it and close this tab
          channel.postMessage({ 
            type: 'verify-email', 
            token: token 
          });
          
          // Give the existing tab time to process, then close this tab
          setTimeout(() => {
            window.close();
          }, 500);
        } else {
          // No existing tab found - allow verification to proceed in this tab
          setSuppressVerification(false);
        }
      }, 200);
    }
    
    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
    };
  }, []);

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

  const handleScreenshot = async (modelId: string) => {
    const safeId = getSafeId(modelId);
    console.log('Screenshot button clicked for model:', modelId, 'Safe ID:', safeId);
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
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelsByProvider, setModelsByProvider] = useState<ModelsByProvider>({});
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [openDropdowns, setOpenDropdowns] = useState<Set<string>>(new Set());
  const [processingTime, setProcessingTime] = useState<number | null>(null);
  const [currentAbortController, setCurrentAbortController] = useState<AbortController | null>(null);
  const [closedCards, setClosedCards] = useState<Set<string>>(new Set());
  const [conversations, setConversations] = useState<ModelConversation[]>([]);
  const [isFollowUpMode, setIsFollowUpMode] = useState(false);
  const [, setUserMessageTimestamp] = useState<string>('');
  const [originalSelectedModels, setOriginalSelectedModels] = useState<string[]>([]);
  const userCancelledRef = useRef(false);
  const followUpJustActivatedRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showDoneSelectingCard, setShowDoneSelectingCard] = useState(false);
  const modelsSectionRef = useRef<HTMLDivElement>(null);
  const compareButtonRef = useRef<HTMLButtonElement>(null);
  const [isAnimatingButton, setIsAnimatingButton] = useState(false);
  const [isAnimatingTextarea, setIsAnimatingTextarea] = useState(false);
  const animationTimeoutRef = useRef<number | null>(null);

  // Freemium usage tracking state
  const [usageCount, setUsageCount] = useState(0);
  const [browserFingerprint, setBrowserFingerprint] = useState('');
  const [isModelsHidden, setIsModelsHidden] = useState(false);

  // Tab switching state - tracks active tab for each conversation
  const [activeResultTabs, setActiveResultTabs] = useState<{ [modelId: string]: 'formatted' | 'raw' }>({});

  // Developer reset function
  const resetUsage = async () => {
    try {
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
        // Reset frontend state for anonymous users
        setUsageCount(0);
        localStorage.removeItem('compareai_usage');
        setError(null);

        // If authenticated, refresh user data to show updated usage
        if (isAuthenticated) {
          await refreshUser();
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(`❌ Failed to reset: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Reset error:', error);
      alert('❌ Failed to reset rate limits. Make sure the backend is running.');
    }
  };

  // Get all models in a flat array for compatibility
  const allModels = Object.values(modelsByProvider).flat();

  // Helper function to create a conversation message
  const createMessage = (type: 'user' | 'assistant', content: string, customTimestamp?: string): ConversationMessage => ({
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    content,
    timestamp: customTimestamp || new Date().toISOString()
  });

  // Helper function to initialize conversations from response
  const initializeConversations = (response: CompareResponse, userTimestamp: string) => {
    const aiTimestamp = new Date().toISOString(); // Capture AI timestamp when response is received

    const newConversations: ModelConversation[] = Object.entries(response.results).map(([modelId, output]) => ({
      modelId,
      messages: [
        createMessage('user', input, userTimestamp),
        createMessage('assistant', String(output), aiTimestamp) // AI response gets current timestamp
      ]
    }));
    setConversations(newConversations);

    // Initialize tabs to default 'formatted' view for all new conversations
    const initialTabs: { [modelId: string]: 'formatted' | 'raw' } = {};
    Object.keys(response.results).forEach(modelId => {
      initialTabs[modelId] = 'formatted';
    });
    setActiveResultTabs(initialTabs);
  };

  // Helper function to switch tabs for a specific conversation
  const switchResultTab = (modelId: string, tab: 'formatted' | 'raw') => {
    setActiveResultTabs(prev => ({
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

  // Scroll to results section when results are loaded
  useEffect(() => {
    if (response && !isFollowUpMode) {
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
          console.log('Follow-up submitted: Scrolling to results section:', resultsSection);
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
    if (selectedModels.length > 0 && !isModelsHidden) {
      // Simply show the card when models are selected and section is visible
      setShowDoneSelectingCard(true);
    }
  }, [selectedModels.length, isModelsHidden]);

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
      const shouldShow = isOver && selectedModels.length > 0 && !isModelsHidden;

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
  }, [selectedModels.length, isModelsHidden]);

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

  // Load usage data and fetch models on component mount
  useEffect(() => {
    // Generate browser fingerprint for anti-abuse tracking
    const initFingerprint = async () => {
      const fingerprint = await generateBrowserFingerprint();
      setBrowserFingerprint(fingerprint);

      // Sync usage count with backend
      try {
        const response = await fetch(`${API_URL}/rate-limit-status?fingerprint=${encodeURIComponent(fingerprint)}`);
        if (response.ok) {
          const data = await response.json();
          setUsageCount(data.fingerprint_usage_count || data.ip_usage_count || 0);

          // Update localStorage to match backend
          const today = new Date().toDateString();
          localStorage.setItem('compareai_usage', JSON.stringify({
            count: data.fingerprint_usage_count || data.ip_usage_count || 0,
            date: today
          }));
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
      }
    };

    initFingerprint();

    const fetchModels = async () => {
      try {
        console.log('Fetching models from:', `${API_URL}/models`);
        const res = await fetch(`${API_URL}/models`);
        console.log('Response status:', res.status);

        if (res.ok) {
          const data = await res.json();
          console.log('Received data:', data);

          if (data.models_by_provider && Object.keys(data.models_by_provider).length > 0) {
            setModelsByProvider(data.models_by_provider);
            console.log('Set modelsByProvider:', data.models_by_provider);
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
        console.log('Finished loading models');
      }
    };

    fetchModels();
  }, []);

  // Reset page state when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      // Reset all state to default
      setInput('');
      setResponse(null);
      setError(null);
      setIsLoading(false);
      setConversations([]);
      setProcessingTime(null);
      setIsFollowUpMode(false);
      // Don't reset selectedModels or usage count - let them keep their selections
    }
  }, [isAuthenticated]);

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

  const collapseAllDropdowns = () => {
    setOpenDropdowns(new Set());
  };

  const toggleAllForProvider = (provider: string) => {
    const providerModels = modelsByProvider[provider] || [];
    const providerModelIds = providerModels.map(model => model.id);

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
          const remainingSlots = MAX_MODELS_LIMIT - (prev.length - alreadySelectedFromProvider);
          const modelsToAdd = providerModelIds.slice(0, remainingSlots);

          modelsToAdd.forEach(id => newSelection.add(id));
        }
      }

      return Array.from(newSelection);
    });

    // Clear any previous error when successfully adding models (only when selecting, not deselecting)
    if (!allProviderModelsSelected && error && (error.includes('Maximum') || error.includes('Must have at least one model') || error.includes('Please select at least one model'))) {
      setError(null);
    }
  };


  const handleModelToggle = (modelId: string) => {
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
      if (selectedModels.length >= MAX_MODELS_LIMIT) {
        setError(`Maximum ${MAX_MODELS_LIMIT} models allowed for optimal performance. Please deselect some models first.`);
        return;
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
        console.log('Follow-up mode: Scrolling to input section:', inputSection);
        // Get the h2 heading inside the input section
        const heading = inputSection.querySelector('h2');
        if (heading) {
          console.log('Follow-up mode: Scrolling to heading inside input section');
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
      } else {
        console.log('Follow-up mode: Input section not found');
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

    // Check daily usage limit
    if (usageCount >= MAX_DAILY_USAGE) {
      setError('You\'ve reached your daily limit of 5 free comparisons. Register for a free account to get 10 comparisons per day!');
      return;
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
      setOriginalSelectedModels([...selectedModels]);
    }

    setIsLoading(true);
    setError(null);
    setIsModelsHidden(true); // Hide models section after clicking Compare
    setShowDoneSelectingCard(false); // Hide "Done Selecting" card after clicking Compare

    // Capture user timestamp when they actually submit
    const userTimestamp = new Date().toISOString();
    setUserMessageTimestamp(userTimestamp);
    console.log('Setting user timestamp:', userTimestamp);

    // Original input functionality removed - not needed

    setResponse(null); // Clear previous results
    setClosedCards(new Set()); // Clear closed cards for new results
    setProcessingTime(null);
    userCancelledRef.current = false;

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
        ? conversations
          .filter(conv => selectedModels.includes(conv.modelId))
          .find(conv => conv.messages.length > 0)?.messages.map(msg => ({
            role: msg.type === 'user' ? 'user' : 'assistant',
            content: msg.content
          })) || []
        : [];

      // Prepare headers with auth token if available
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const accessToken = localStorage.getItem('access_token');
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const res = await fetch(`${API_URL}/compare`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          input_data: input,
          models: selectedModels,
          conversation_history: conversationHistory,
          browser_fingerprint: browserFingerprint  // Send fingerprint for rate limiting
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));

        // Special handling for rate limit errors (429)
        if (res.status === 429) {
          throw new Error(errorData.detail || 'Daily comparison limit exceeded. Please try again tomorrow.');
        }

        throw new Error(errorData.detail || `HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      const endTime = Date.now();
      setProcessingTime(endTime - startTime);

      // Filter response results to only include selected models
      const filteredData = {
        ...data,
        results: Object.fromEntries(
          Object.entries(data.results).filter(([modelId]) => selectedModels.includes(modelId))
        ),
        metadata: {
          ...data.metadata,
          models_requested: selectedModels.length,
          models_successful: Object.keys(data.results).filter(modelId =>
            selectedModels.includes(modelId) && !data.results[modelId].startsWith('Error')
          ).length,
          models_failed: Object.keys(data.results).filter(modelId =>
            selectedModels.includes(modelId) && data.results[modelId].startsWith('Error')
          ).length
        }
      };

      setResponse(filteredData);

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
            console.log('Usage count synced from backend:', newCount);
            setUsageCount(newCount);

            // Update localStorage to match backend
            const today = new Date().toDateString();
            localStorage.setItem('compareai_usage', JSON.stringify({
              count: newCount,
              date: today
            }));
          } else {
            // Fallback to local increment if backend sync fails
            const newUsageCount = usageCount + 1;
            setUsageCount(newUsageCount);
            const today = new Date().toDateString();
            localStorage.setItem('compareai_usage', JSON.stringify({
              count: newUsageCount,
              date: today
            }));
          }
        } catch (error) {
          console.error('Failed to sync usage count after comparison:', error);
          // Fallback to local increment
          const newUsageCount = usageCount + 1;
          setUsageCount(newUsageCount);
          const today = new Date().toDateString();
          localStorage.setItem('compareai_usage', JSON.stringify({
            count: newUsageCount,
            date: today
          }));
        }
      } else {
        // All models failed - show a message but don't count it
        console.log('All models failed - not counting towards usage limit');
        setError('All models failed to respond. This comparison did not count towards your daily limit. Please try again in a moment.');
        // Clear the error after 8 seconds
        setTimeout(() => {
          setError(null);
        }, 8000);
      }

      // Clear input only when submitting a follow-up message
      if (isFollowUpMode) {
        setInput('');
      }

      // Initialize or update conversations
      if (isFollowUpMode) {
        // Add new messages to existing conversations, but only for currently selected models
        const aiTimestamp = new Date().toISOString(); // Capture AI timestamp when response is received
        console.log('Follow-up - User timestamp:', userTimestamp);
        console.log('Follow-up - AI timestamp:', aiTimestamp);

        setConversations(prevConversations => {
          // Filter to only keep conversations for selected models, and update them
          const selectedConversations = prevConversations.filter(conv => selectedModels.includes(conv.modelId));

          const updatedConversations = selectedConversations.map(conv => {
            const newUserMessage = createMessage('user', input, userTimestamp);
            const newAssistantMessage = createMessage('assistant', String(data.results[conv.modelId] || 'Error: No response'), aiTimestamp);
            return {
              ...conv,
              messages: [...conv.messages, newUserMessage, newAssistantMessage]
            };
          });

          // Scroll all conversations to show the last user message after state update
          setTimeout(() => {
            scrollConversationsToBottom();
          }, 600);

          return updatedConversations;
        });
      } else {
        // Initialize new conversations
        initializeConversations(data, userTimestamp);
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
          setError(`Request timed out after ${timeoutMinutes}:${timeoutSeconds.toString().padStart(2, '0')} (${selectedModels.length} models). Try selecting fewer models, or wait a moment and try again.`);
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

  return (
    <div className="app">
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
                      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                      <path d="M2 17l10 5 10-5"/>
                      <path d="M2 12l10 5 10-5"/>
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
      <VerifyEmail onClose={() => { }} externalToken={verificationToken} suppressVerification={suppressVerification} />
      <VerificationBanner />

      <main className="app-main">
        <div className="hero-section">
          <div className="hero-content">
            <h2 className="hero-title">Compare AI Models Side by Side</h2>
            <p className="hero-subtitle">Get responses from multiple AI models to find the best solution for your needs</p>

            <div className="hero-capabilities">
              <div className="capability-tile">
                <div className="capability-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                </div>
                <h3 className="capability-title">Natural Language</h3>
                <p className="capability-description">Compare conversational responses</p>
              </div>

              <div className="capability-tile">
                <div className="capability-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 18 22 12 16 6"></polyline>
                    <polyline points="8 6 2 12 8 18"></polyline>
                  </svg>
                </div>
                <h3 className="capability-title">Code Generation</h3>
                <p className="capability-description">Evaluate programming capabilities</p>
              </div>

              <div className="capability-tile">
                <div className="capability-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    <polyline points="7.5 4.21 12 6.81 16.5 4.21"></polyline>
                    <polyline points="7.5 19.79 7.5 14.6 3 12"></polyline>
                    <polyline points="21 12 16.5 14.6 16.5 19.79"></polyline>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                  </svg>
                </div>
                <h3 className="capability-title">Formatted Math</h3>
                <p className="capability-description">Render LaTeX equations beautifully</p>
              </div>

              <div className="capability-tile">
                <div className="capability-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                  </svg>
                </div>
                <h3 className="capability-title">Concurrent Processing</h3>
                <p className="capability-description">Get all responses simultaneously</p>
              </div>
            </div>

            <div className="hero-input-section">
              <h2>{isFollowUpMode ? 'Follow Up' : 'Enter Your Prompt'}</h2>
              <div className={`textarea-container ${isAnimatingTextarea ? 'animate-pulse-border' : ''}`}>
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
                    ? "Enter your follow-up question or request here..."
                    : "Let's get started..."
                  }
                  className="hero-input-textarea"
                  rows={1}
                />
                <div className="textarea-actions">
                  {isFollowUpMode && (
                    <button
                      onClick={handleNewComparison}
                      className="textarea-icon-button new-inquiry-button"
                      title="Exit follow up mode"
                      disabled={isLoading}
                    >
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    </button>
                  )}
                  <button
                    ref={compareButtonRef}
                    onClick={isFollowUpMode ? handleContinueConversation : handleSubmitClick}
                    disabled={isLoading}
                    className={`textarea-icon-button submit-button ${!isFollowUpMode && (selectedModels.length === 0 || !input.trim()) ? 'not-ready' : ''} ${isAnimatingButton ? 'animate-pulse-glow' : ''}`}
                    title={isFollowUpMode ? 'Continue conversation' : 'Compare models'}
                  >
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7 14l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Processing time message moved here */}
              {selectedModels.length > 0 && (
                <div className="processing-time-message">
                  {(() => {
                    const count = selectedModels.length;

                    let description;
                    let IconComponent;

                    if (count === 1) {
                      description = "Single model processing";
                      // Single square/box icon
                      IconComponent = () => (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'pulse 2s ease-in-out infinite', display: 'block' }}>
                          <rect x="5" y="5" width="14" height="14" rx="2" />
                        </svg>
                      );
                    } else if (count <= 4) {
                      description = "Small batch processing";
                      // Copy/duplicate icon
                      IconComponent = () => (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'pulse 2s ease-in-out infinite', display: 'block' }}>
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      );
                    } else if (count <= 8) {
                      description = "Medium batch processing";
                      // Layers icon
                      IconComponent = () => (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'pulse 2s ease-in-out infinite', display: 'block' }}>
                          <polygon points="12 2 2 7 12 12 22 7 12 2" />
                          <polyline points="2 17 12 22 22 17" />
                          <polyline points="2 12 12 17 22 12" />
                        </svg>
                      );
                    } else {
                      description = "Large batch processing";
                      // Server/database icon for large
                      IconComponent = () => (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'pulse 2s ease-in-out infinite', display: 'block' }}>
                          <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                          <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                          <line x1="6" y1="6" x2="6.01" y2="6" />
                          <line x1="6" y1="18" x2="6.01" y2="18" />
                        </svg>
                      );
                    }

                    return (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                          <IconComponent />
                          <span>{count} model{count !== 1 ? 's' : ''} selected • {description}</span>
                          <IconComponent />
                        </div>
                        <div style={{ marginTop: '0.25rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                            Processing time depends on your Internet connection and the amount of rendering needed
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
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
            onClick={() => setIsModelsHidden(!isModelsHidden)}
          >
            <div className="models-header-title">
              <h2 style={{ margin: 0 }}>
                {isFollowUpMode ? 'Selected Models (Follow-up Mode)' : 'Select Models to Compare'}
              </h2>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
                {isFollowUpMode
                  ? 'You can deselect models or reselect previously selected ones (minimum 1 model required)'
                  : `Choose up to ${MAX_MODELS_LIMIT} models`
                }
              </p>
            </div>
            <div className="models-header-controls">
              <div className="models-header-buttons">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedModels([]);
                  }}
                  disabled={selectedModels.length === 0 || isFollowUpMode}
                  style={{
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.75rem',
                    border: '1px solid #dc2626',
                    background: 'transparent',
                    color: (selectedModels.length === 0 || isFollowUpMode) ? '#9ca3af' : '#dc2626',
                    borderRadius: '6px',
                    cursor: (selectedModels.length === 0 || isFollowUpMode) ? 'not-allowed' : 'pointer',
                    opacity: (selectedModels.length === 0 || isFollowUpMode) ? 0.5 : 1
                  }}
                  title={isFollowUpMode ? 'Cannot clear models during follow-up' : 'Clear all selected models'}
                >
                  Clear All
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    collapseAllDropdowns();
                  }}
                  disabled={openDropdowns.size === 0}
                  style={{
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.75rem',
                    border: '1px solid #3b82f6',
                    background: 'transparent',
                    color: openDropdowns.size === 0 ? '#9ca3af' : '#3b82f6',
                    borderRadius: '6px',
                    cursor: openDropdowns.size === 0 ? 'not-allowed' : 'pointer',
                    opacity: openDropdowns.size === 0 ? 0.5 : 1
                  }}
                >
                  Collapse All
                </button>
              </div>
              <div className="models-header-right">
                <div
                  className="models-count-indicator"
                  style={{
                    padding: '0.5rem 1rem',
                    background: selectedModels.length >= MAX_MODELS_LIMIT ? '#fef2f2' :
                      selectedModels.length > 0 ? '#667eea' : '#f3f4f6',
                    color: selectedModels.length >= MAX_MODELS_LIMIT ? '#dc2626' :
                      selectedModels.length > 0 ? 'white' : '#6b7280',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    border: `1px solid ${selectedModels.length >= MAX_MODELS_LIMIT ? '#fecaca' : '#e5e7eb'}`
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {selectedModels.length} of {MAX_MODELS_LIMIT} selected
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

          {/* Warning for approaching limit */}
          {selectedModels.length > 8 && selectedModels.length < MAX_MODELS_LIMIT && (
            <div className="warning-message" style={{
              background: '#fff3cd',
              border: '1px solid #ffeaa7',
              color: '#856404',
              padding: '0.75rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span>⚠️</span>
              <span>
                You've selected {selectedModels.length} models. Maximum {MAX_MODELS_LIMIT} allowed for optimal performance.
              </span>
            </div>
          )}

          {!isModelsHidden && (
            <>
              {isLoadingModels ? (
                <div className="loading-message">Loading available models...</div>
              ) : Object.keys(modelsByProvider).length === 0 ? (
                <div className="error-message">
                  <p>No models available. Please check the server connection.</p>
                  <p>Debug info: modelsByProvider keys: {JSON.stringify(Object.keys(modelsByProvider))}</p>
                </div>
              ) : (
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
                            <span className="provider-count">
                              {(() => {
                                const selectedCount = models.filter(model => selectedModels.includes(model.id)).length;
                                return `${selectedCount} of ${models.length} selected`;
                              })()}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {(() => {
                              const providerModels = modelsByProvider[provider] || [];
                              const providerModelIds = providerModels.map(model => model.id);
                              const allProviderModelsSelected = providerModelIds.every(id => selectedModels.includes(id)) && providerModelIds.length > 0;
                              const hasAnySelected = providerModelIds.some(id => selectedModels.includes(id));
                              const hasAnyOriginallySelected = providerModelIds.some(id => originalSelectedModels.includes(id));
                              const isDisabled = (selectedModels.length >= MAX_MODELS_LIMIT && !hasAnySelected) ||
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
                                    (isFollowUpMode ? 'Cannot add new models during follow-up' : `Cannot select more models (max ${MAX_MODELS_LIMIT})`) :
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
                              const isDisabled = (selectedModels.length >= MAX_MODELS_LIMIT && !isSelected) ||
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
              )}

              {/* Selected Models Cards */}
              {selectedModels.length > 0 && (
                <div className="selected-models-section">
                  <h3>Selected Models ({selectedModels.length})</h3>
                  <div className="selected-models-grid">
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
                          <p className="selected-model-provider">{model.provider}</p>
                          <p className="selected-model-description">{model.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* Usage tracking banner - show for anonymous users who have made comparisons or reached the limit */}
        {!isAuthenticated && (usageCount > 0 || usageCount >= MAX_DAILY_USAGE || (error && (error.includes('Daily limit') || error.includes('daily limit')))) && (
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            padding: '1rem',
            margin: '0',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)'
          }}>
            <div style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              {usageCount < MAX_DAILY_USAGE ? (
                `${MAX_DAILY_USAGE - usageCount} free comparisons remaining today • Register for 10 per day`
              ) : (
                'Daily limit reached! Register for a free account to get 10 comparisons per day.'
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

        {response && (
          <section className="results-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>Comparison Results</h2>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
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

            <div className="results-grid">
              {conversations
                .filter((conv) => !closedCards.has(conv.modelId))
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
                              title="Screenshot message area"
                              aria-label={`Screenshot message area for ${model?.name || conversation.modelId}`}
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
                              title="Copy entire chat history"
                              aria-label={`Copy entire chat history from ${model?.name || conversation.modelId}`}
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
                                <LatexRenderer className="result-output">
                                  {message.content}
                                </LatexRenderer>
                              ) : (
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

          {/* Auth Modal */}
          <AuthModal
            isOpen={isAuthModalOpen}
            onClose={() => setIsAuthModalOpen(false)}
            initialMode={authModalMode}
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
      <AppContent />
    </AuthProvider>
  );
}

export default App;
