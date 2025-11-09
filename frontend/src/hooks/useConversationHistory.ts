/**
 * Custom hook for managing conversation history
 * 
 * Handles loading, saving, and deleting conversation history for both
 * authenticated and anonymous users. Ensures immediate UI updates when
 * conversations are created or deleted.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { ConversationSummary, ModelConversation, ConversationId } from '../types';
import { createConversationId, createModelId } from '../types';
import { getConversations, deleteConversation as deleteConversationFromAPI } from '../services/conversationService';
import { ApiError } from '../services/api/errors';
import { apiClient } from '../services/api/client';

export interface UseConversationHistoryOptions {
  isAuthenticated: boolean;
  user: any; // TODO: Use proper User type
  onDeleteActiveConversation?: () => void; // Callback when deleting the active conversation
}

export interface UseConversationHistoryReturn {
  conversationHistory: ConversationSummary[];
  setConversationHistory: React.Dispatch<React.SetStateAction<ConversationSummary[]>>;
  isLoadingHistory: boolean;
  setIsLoadingHistory: React.Dispatch<React.SetStateAction<boolean>>;
  historyLimit: number;
  currentVisibleComparisonId: string | null;
  setCurrentVisibleComparisonId: React.Dispatch<React.SetStateAction<string | null>>;
  showHistoryDropdown: boolean;
  setShowHistoryDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  loadHistoryFromAPI: () => Promise<void>;
  loadHistoryFromLocalStorage: () => ConversationSummary[];
  saveConversationToLocalStorage: (
    inputData: string,
    modelsUsed: string[],
    conversationsToSave: ModelConversation[],
    isUpdate?: boolean
  ) => string;
  deleteConversation: (summary: ConversationSummary, e: React.MouseEvent) => Promise<void>;
  loadConversationFromAPI: (conversationId: ConversationId) => Promise<ModelConversation[] | null>;
  loadConversationFromLocalStorage: (conversationId: string) => ModelConversation[];
}

export function useConversationHistory({
  isAuthenticated,
  user,
  onDeleteActiveConversation,
}: UseConversationHistoryOptions): UseConversationHistoryReturn {
  const [conversationHistory, setConversationHistory] = useState<ConversationSummary[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [currentVisibleComparisonId, setCurrentVisibleComparisonId] = useState<string | null>(null);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);

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

  // Load conversation history from localStorage (anonymous users)
  const loadHistoryFromLocalStorage = useCallback((): ConversationSummary[] => {
    try {
      const historyJson = localStorage.getItem('compareai_conversation_history');
      if (!historyJson) return [];
      const history = JSON.parse(historyJson) as ConversationSummary[];
      // Sort by created_at descending (most recent first)
      return history.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } catch (e) {
      console.error('Failed to load conversation history from localStorage:', e);
      return [];
    }
  }, []);

  // Save conversation to localStorage (anonymous users)
  // Returns the conversationId of the saved conversation
  const saveConversationToLocalStorage = useCallback((
    inputData: string,
    modelsUsed: string[],
    conversationsToSave: ModelConversation[],
    isUpdate: boolean = false
  ): string => {
    try {
      const history = loadHistoryFromLocalStorage();

      // Calculate total messages across all models
      const totalMessages = conversationsToSave.reduce(
        (sum, conv) => sum + conv.messages.length,
        0
      );

      let conversationId: string;
      let existingConversation: ConversationSummary | undefined;

      if (isUpdate) {
        // Find existing conversation by matching input and models
        existingConversation = history.find((conv) => {
          if (typeof conv.id !== 'string') return false;
          if (conv.input_data !== inputData) return false;
          const sortedConvModels = [...conv.models_used].sort();
          const sortedModelsUsed = [...modelsUsed].sort();
          if (sortedConvModels.length !== sortedModelsUsed.length) return false;
          for (let i = 0; i < sortedConvModels.length; i++) {
            if (sortedConvModels[i] !== sortedModelsUsed[i]) {
              return false;
            }
          }
          return true;
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
        id: createConversationId(conversationId),
        input_data: inputData,
        models_used: modelsUsed.map(id => createModelId(id)),
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
      const limited = sorted.slice(0, 2);

      // Save to localStorage
      localStorage.setItem('compareai_conversation_history', JSON.stringify(limited));

      // Save the full conversation data
      const conversationData = {
        id: conversationId,
        input_data: inputData,
        models_used: modelsUsed,
        conversations: conversationsToSave.map((conv) => ({
          modelId: conv.modelId,
          messages: conv.messages,
        })),
        created_at: conversationSummary.created_at,
      };

      localStorage.setItem(
        `compareai_conversation_${conversationId}`,
        JSON.stringify(conversationData)
      );

      // Update state immediately for UI
      setConversationHistory(limited);

      return conversationId;
    } catch (e) {
      console.error('Failed to save conversation to localStorage:', e);
      return '';
    }
  }, [loadHistoryFromLocalStorage]);

  // Load conversation history from API (authenticated users)
  const loadHistoryFromAPI = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoadingHistory(true);
    try {
      const data = await getConversations();
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
    } catch (error) {
      if (error instanceof ApiError) {
        console.error('Failed to load conversation history:', error.status, error.message);
      } else {
        console.error('Failed to load conversation history from API:', error);
      }
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

    // If this was the active item, call the callback to reset UI state
    if (isActiveItem && onDeleteActiveConversation) {
      onDeleteActiveConversation();
    }

    if (isAuthenticated && typeof summary.id === 'number') {
      // Delete from API
      try {
        await deleteConversationFromAPI(summary.id);

        // Clear cache for conversations endpoint to force fresh data
        apiClient.deleteCache('GET:/conversations');

        // Immediately update state to remove the deleted conversation from UI
        setConversationHistory(prev => prev.filter(conv => conv.id !== summary.id));

        // If this was the active item, reset the visible comparison ID
        if (isActiveItem) {
          setCurrentVisibleComparisonId(null);
        }

        // Reload history from API to ensure sync (will fetch fresh data due to cache clear)
        await loadHistoryFromAPI();
      } catch (error) {
        if (error instanceof ApiError) {
          console.error('Failed to delete conversation:', error.message);
        } else {
          console.error('Failed to delete conversation from API:', error);
        }
      }
    } else if (!isAuthenticated && typeof summary.id === 'string') {
      // Delete from localStorage
      try {
        // Remove the conversation data
        localStorage.removeItem(`compareai_conversation_${summary.id}`);

        // Update history list
        const history = loadHistoryFromLocalStorage();
        const updatedHistory = history.filter(conv => conv.id !== summary.id);
        localStorage.setItem('compareai_conversation_history', JSON.stringify(updatedHistory));

        // Immediately update state to remove the deleted conversation from UI
        setConversationHistory(updatedHistory);

        // If this was the active item, reset the visible comparison ID
        if (isActiveItem) {
          setCurrentVisibleComparisonId(null);
        }
      } catch (error) {
        console.error('Failed to delete conversation from localStorage:', error);
      }
    }
  }, [isAuthenticated, currentVisibleComparisonId, loadHistoryFromAPI, loadHistoryFromLocalStorage, onDeleteActiveConversation]);

  // Load full conversation from API (authenticated users)
  // Note: This is a simplified version. The actual loading logic is in App.tsx
  // because it requires complex data transformation that depends on App.tsx types
  const loadConversationFromAPI = useCallback(async (_conversationId: ConversationId): Promise<ModelConversation[] | null> => {
    try {
      // This is a placeholder - actual implementation is in App.tsx
      console.warn('loadConversationFromAPI called from hook - should use App.tsx version');
      return null;
    } catch (error) {
      if (error instanceof ApiError) {
        console.error('Failed to load conversation:', error.message);
      } else {
        console.error('Failed to load conversation from API:', error);
      }
      return null;
    }
  }, []);

  // Load full conversation from localStorage (anonymous users)
  const loadConversationFromLocalStorage = useCallback((conversationId: string): ModelConversation[] => {
    try {
      const conversationJson = localStorage.getItem(`compareai_conversation_${conversationId}`);
      if (!conversationJson) {
        console.error('Conversation not found in localStorage:', conversationId);
        return [];
      }
      const conversationData = JSON.parse(conversationJson);
      return conversationData.conversations.map((conv: any) => ({
        ...conv,
        isStreaming: false,
      }));
    } catch (e) {
      console.error('Failed to load conversation from localStorage:', e);
      return [];
    }
  }, []);

  // Load conversation history on mount and when auth status changes
  useEffect(() => {
    if (isAuthenticated) {
      loadHistoryFromAPI();
    } else {
      const history = loadHistoryFromLocalStorage();
      setConversationHistory(history);
    }
  }, [isAuthenticated, loadHistoryFromAPI, loadHistoryFromLocalStorage]);

  // Refresh history when dropdown is opened for authenticated users
  useEffect(() => {
    if (showHistoryDropdown) {
      if (isAuthenticated) {
        loadHistoryFromAPI();
      } else {
        const history = loadHistoryFromLocalStorage();
        setConversationHistory(history);
      }
    }
  }, [showHistoryDropdown, isAuthenticated, loadHistoryFromAPI, loadHistoryFromLocalStorage]);

  return {
    conversationHistory,
    setConversationHistory,
    isLoadingHistory,
    setIsLoadingHistory,
    historyLimit,
    currentVisibleComparisonId,
    setCurrentVisibleComparisonId,
    showHistoryDropdown,
    setShowHistoryDropdown,
    loadHistoryFromAPI,
    loadHistoryFromLocalStorage,
    saveConversationToLocalStorage,
    deleteConversation,
    loadConversationFromAPI,
    loadConversationFromLocalStorage,
  };
}

