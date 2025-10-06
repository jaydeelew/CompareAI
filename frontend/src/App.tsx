import { useState, useEffect, useRef } from 'react';
import './App.css';
import LatexRenderer from './components/LatexRenderer';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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

// Freemium usage limits
const MAX_DAILY_USAGE = 10;

function App() {
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
  const userCancelledRef = useRef(false);
  const followUpJustActivatedRef = useRef(false);

  // Freemium usage tracking state
  const [usageCount, setUsageCount] = useState(0);
  const [browserFingerprint, setBrowserFingerprint] = useState('');

  // Generate browser fingerprint for usage tracking (anti-abuse measure)
  const generateBrowserFingerprint = () => {
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
      hardwareConcurrency: navigator.hardwareConcurrency,
      timestamp: Date.now()
    };

    return btoa(JSON.stringify(fingerprint));
  };

  // Developer reset function
  const resetUsage = async () => {
    try {
      // Reset backend rate limits (dev only)
      const url = browserFingerprint
        ? `${API_URL}/dev/reset-rate-limit?fingerprint=${encodeURIComponent(browserFingerprint)}`
        : `${API_URL}/dev/reset-rate-limit`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        // Reset frontend state
        setUsageCount(0);
        localStorage.removeItem('compareai_usage');
        setError(null);
        alert('✅ Rate limits reset successfully! You can now make 10 more comparisons.');
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
    console.log('User timestamp:', userTimestamp);
    console.log('AI timestamp:', aiTimestamp);

    const newConversations: ModelConversation[] = Object.entries(response.results).map(([modelId, output]) => ({
      modelId,
      messages: [
        createMessage('user', input, userTimestamp),
        createMessage('assistant', String(output), aiTimestamp) // AI response gets current timestamp
      ]
    }));
    setConversations(newConversations);
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

  // Scroll to results section when results are loaded
  useEffect(() => {
    if (response) {
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
  }, [response]);

  // Scroll to input section when follow-up mode is activated
  useEffect(() => {
    if (isFollowUpMode && followUpJustActivatedRef.current) {
      // Scroll to input section when follow-up mode is first activated
      setTimeout(() => {
        const inputSection = document.querySelector('.input-section');
        if (inputSection) {
          console.log('Follow-up mode: Scrolling to input section:', inputSection);
          inputSection.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        } else {
          console.log('Follow-up mode: Input section not found');
        }
        // Reset the flag after scrolling
        followUpJustActivatedRef.current = false;
      }, 100);
    }
  }, [isFollowUpMode]);

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

  // Load usage data and fetch models on component mount
  useEffect(() => {
    // Generate browser fingerprint for anti-abuse tracking
    const fingerprint = generateBrowserFingerprint();
    setBrowserFingerprint(fingerprint);

    // Sync usage count with backend
    const syncUsageCount = async () => {
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

    syncUsageCount();

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

    setSelectedModels(prev => {
      const newSelection = new Set(prev);

      if (allProviderModelsSelected) {
        // Deselect all provider models
        providerModelIds.forEach(id => newSelection.delete(id));
      } else {
        // Select all provider models, but respect the limit
        const remainingSlots = MAX_MODELS_LIMIT - prev.length;
        const modelsToAdd = providerModelIds.slice(0, remainingSlots);

        modelsToAdd.forEach(id => newSelection.add(id));
      }

      return Array.from(newSelection);
    });
  };


  const handleModelToggle = (modelId: string) => {
    if (selectedModels.includes(modelId)) {
      // Allow deselection in both normal and follow-up mode
      setSelectedModels(prev => prev.filter(id => id !== modelId));
      // Clear any previous error when deselecting a model
      if (error && error.includes('Maximum')) {
        setError(null);
      }
    } else {
      // Prevent adding new models during follow-up mode
      if (isFollowUpMode) {
        setError('Cannot add new models during follow-up. Please start a new comparison to select different models.');
        // Clear the error after 5 seconds
        setTimeout(() => {
          setError(null);
        }, 5000);
        return;
      }

      // Check limit before adding (only in normal mode)
      if (selectedModels.length >= MAX_MODELS_LIMIT) {
        setError(`Maximum ${MAX_MODELS_LIMIT} models allowed for optimal performance. Please deselect some models first.`);
        return;
      }

      setSelectedModels(prev => [...prev, modelId]);
      // Clear any previous error when successfully adding a model
      if (error && error.includes('Maximum')) {
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

  const handleFollowUp = () => {
    followUpJustActivatedRef.current = true;
    setIsFollowUpMode(true);
    setInput('');
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


  const handleSubmit = async () => {
    // Check daily usage limit
    if (usageCount >= MAX_DAILY_USAGE) {
      setError('You\'ve reached your daily limit of 10 free comparisons.');
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

    setIsLoading(true);
    setError(null);

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

      const res = await fetch(`${API_URL}/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        // Sync with backend to get the actual count (backend now counts after success)
        try {
          const response = await fetch(`${API_URL}/rate-limit-status?fingerprint=${encodeURIComponent(browserFingerprint)}`);
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
            <button className="nav-button" title="Settings">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="2" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
          </div>
        </nav>

        <div className="hero-section">
          <div className="hero-content">
            <h2 className="hero-title">Compare AI Models Side by Side</h2>
            <p className="hero-description">
              Get responses from multiple AI models to find the best solution for your needs. Compare natural language responses, code generation capabilities, and formatted math results using concurrent processing of multiple AI models.
            </p>

            <div className="capability-showcase">
              <div className="capability-item">
                <div className="capability-icon">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 2H6C4.9 2 4 2.9 4 4v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z" stroke="currentColor" strokeWidth="2" />
                    <path d="M14 2v6h6" stroke="currentColor" strokeWidth="2" />
                    <path d="M8 12h8M8 16h6" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </div>
                <span>Compare Text Responses</span>
              </div>

              <div className="capability-item">
                <div className="capability-icon">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
                    <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="2" />
                    <path d="M7 7h.01M7 10h.01M7 13h.01M11 7h6M11 10h6M11 13h4" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </div>
                <span>Evaluate Code Generation</span>
              </div>

              <div className="capability-item">
                <div className="capability-icon">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 3h18v18H3z" stroke="currentColor" strokeWidth="2" />
                    <path d="M9 9h6M9 12h6M9 15h4" stroke="currentColor" strokeWidth="2" />
                    <path d="M7 7l2 2 4-4" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </div>
                <span>Examine Math Results</span>
              </div>
            </div>

            <div className="capability-note">
              <div className="note-content">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="note-icon">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" />
                </svg>
                <span className="note-text">Models Processed Concurrently</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="app-main">
        <section className="models-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ margin: 0 }}>
                {isFollowUpMode ? 'Selected Models (Follow-up Mode)' : 'Select Models to Compare'}
              </h2>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
                {isFollowUpMode
                  ? 'You can deselect models but cannot add new ones during follow-up'
                  : `Choose up to ${MAX_MODELS_LIMIT} models for optimal performance`
                }
              </p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setSelectedModels([])}
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
                  onClick={collapseAllDropdowns}
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
              <div style={{
                padding: '0.5rem 1rem',
                background: selectedModels.length >= MAX_MODELS_LIMIT ? '#fef2f2' :
                  selectedModels.length > 0 ? '#667eea' : '#f3f4f6',
                color: selectedModels.length >= MAX_MODELS_LIMIT ? '#dc2626' :
                  selectedModels.length > 0 ? 'white' : '#6b7280',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: '600',
                border: `1px solid ${selectedModels.length >= MAX_MODELS_LIMIT ? '#fecaca' : '#e5e7eb'}`
              }}>
                {selectedModels.length} of {MAX_MODELS_LIMIT} selected
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


          {isLoadingModels ? (
            <div className="loading-message">Loading available models...</div>
          ) : Object.keys(modelsByProvider).length === 0 ? (
            <div className="error-message">
              <p>No models available. Please check the server connection.</p>
              <p>Debug info: modelsByProvider keys: {JSON.stringify(Object.keys(modelsByProvider))}</p>
            </div>
          ) : (
            <div className="provider-dropdowns">
              {Object.entries(modelsByProvider).map(([provider, models]) => (
                <div key={provider} className="provider-dropdown">
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
                        const allProviderModelsSelected = providerModelIds.every(id => selectedModels.includes(id));
                        const hasAnySelected = providerModelIds.some(id => selectedModels.includes(id));
                        const isDisabled = (selectedModels.length >= MAX_MODELS_LIMIT && !hasAnySelected) ||
                          (isFollowUpMode && !hasAnySelected);

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
                              fontSize: '0.7rem',
                              border: `1px solid ${isDisabled ? '#d1d5db' : allProviderModelsSelected ? '#dc2626' : '#667eea'}`,
                              background: 'transparent',
                              color: isDisabled ? '#9ca3af' : allProviderModelsSelected ? '#dc2626' : '#667eea',
                              borderRadius: '4px',
                              cursor: isDisabled ? 'not-allowed' : 'pointer',
                              opacity: isDisabled ? 0.5 : (hasAnySelected && !allProviderModelsSelected ? 0.7 : 1)
                            }}
                            title={isDisabled ?
                              (isFollowUpMode ? 'Cannot add new models during follow-up' : `Cannot select more models (max ${MAX_MODELS_LIMIT})`) :
                              allProviderModelsSelected ? `Deselect all ${provider} models` :
                                `Select all ${provider} models`}
                          >
                            {allProviderModelsSelected ? 'Deselect All' : 'Select All'}
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
                        const isDisabled = (selectedModels.length >= MAX_MODELS_LIMIT && !isSelected) ||
                          (isFollowUpMode && !isSelected);
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
                            />
                            <div className="model-info">
                              <h4>
                                {model.name}
                                {isFollowUpMode && !isSelected && (
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
              ))}
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
        </section>

        <section className="input-section">
          <h2>{isFollowUpMode ? 'Follow Up' : 'Input Text'}</h2>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isFollowUpMode
              ? "Enter your follow-up question or request here..."
              : "Enter your text here to compare how different AI models respond..."
            }
            className="input-textarea"
            rows={6}
          />
        </section>

        {/* Usage tracking display */}
        {usageCount > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            padding: '1rem',
            borderRadius: '12px',
            margin: '1rem 0',
            textAlign: 'center',
            boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)'
          }}>
            <div style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              {usageCount < MAX_DAILY_USAGE ? (
                `You've used ${usageCount} of ${MAX_DAILY_USAGE} free comparisons today`
              ) : (
                'You\'ve reached your daily limit!'
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

        <section className="action-section">
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={isFollowUpMode ? handleContinueConversation : handleSubmit}
              disabled={isLoading || selectedModels.length === 0}
              className="compare-button"
            >
              {isLoading
                ? `Comparing ${selectedModels.length} models...`
                : isFollowUpMode
                  ? 'Continue Conversation'
                  : `Compare ${selectedModels.length || ''} Model${selectedModels.length !== 1 ? 's' : ''}`
              }
            </button>
            {isFollowUpMode && (
              <button
                onClick={handleNewComparison}
                className="new-comparison-button"
                title="Start a new comparison"
              >
                New Inquiry
              </button>
            )}
          </div>
          {selectedModels.length > 0 && (
            <p style={{
              fontSize: '0.875rem',
              color: '#666',
              margin: '0.5rem 0 0 0',
              textAlign: 'center'
            }}>
              {(() => {
                const count = selectedModels.length;

                let indicator, description;

                if (count === 1) {
                  indicator = "⚡ Very Quick";
                  description = "Single model comparison";
                } else if (count <= 4) {
                  indicator = "🚀 Quick";
                  description = "Small batch processing";
                } else if (count <= 8) {
                  indicator = "⏱️ Moderate";
                  description = "Medium batch processing";
                } else if (count <= 12) {
                  indicator = "⏳ Takes a while";
                  description = "Large batch processing";
                } else {
                  indicator = "🕐 Be patient";
                  description = "Very large batch - grab a coffee!";
                }

                return (
                  <>
                    <strong>{indicator}</strong> - {description}
                    <br />
                    <span style={{ fontSize: '0.75rem', color: '#888' }}>
                      {count} model{count !== 1 ? 's' : ''} selected • Processing time depends on your Internet connection
                    </span>
                  </>
                );
              })()}
            </p>
          )}
        </section>

        {error && (
          <div className="error-message">
            <span>⚠️ {error}</span>
          </div>
        )}

        {isLoading && (
          <div className="loading-section">
            <div className="loading-content">
              <div className="modern-spinner"></div>
              <p>Analyzing responses from {selectedModels.length} AI models...</p>
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
                    title="Ask a follow-up question"
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

                  return (
                    <div key={conversation.modelId} className="result-card conversation-card">
                      <div className="result-header">
                        <div className="result-header-top">
                          <h3>{model?.name || conversation.modelId}</h3>
                          <button
                            className="close-card-btn"
                            onClick={() => closeResultCard(conversation.modelId)}
                            title="Hide this result"
                            aria-label={`Hide result for ${model?.name || conversation.modelId}`}
                          >
                            ✕
                          </button>
                        </div>
                        <div className="result-header-bottom">
                          <span className="output-length">{latestMessage?.content.length || 0} chars</span>
                          <span className={`status ${isError ? 'error' : 'success'}`}>
                            {isError ? 'Failed' : 'Success'}
                          </span>
                        </div>
                      </div>
                      <div className="conversation-content">
                        {conversation.messages.map((message) => (
                          <div key={message.id} className={`conversation-message ${message.type}`}>
                            <div className="message-header">
                              <span className="message-type">
                                {message.type === 'user' ? '👤 You' : '🤖 AI'}
                              </span>
                              <span className="message-time">
                                {new Date(message.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <div className="message-content">
                              <LatexRenderer className="result-output">
                                {message.content}
                              </LatexRenderer>
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
    </div>
  );
}

export default App;
