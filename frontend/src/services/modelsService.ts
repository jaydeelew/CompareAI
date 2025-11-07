/**
 * Models Service
 * 
 * Handles all model-related API endpoints including:
 * - Listing available models
 * - Getting models by provider
 */

import { apiClient } from './api/client';
import type { ModelsByProvider } from '../types';

/**
 * Available models response
 */
export interface AvailableModelsResponse {
  models: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    provider: string;
    available?: boolean;
  }>;
  models_by_provider: ModelsByProvider;
}

/**
 * Get list of available AI models
 * 
 * @returns Promise resolving to available models
 * @throws {ApiError} If the request fails
 */
export async function getAvailableModels(): Promise<AvailableModelsResponse> {
  const response = await apiClient.get<AvailableModelsResponse>('/models');
  return response.data;
}

/**
 * Get models organized by provider
 * 
 * @returns Promise resolving to models by provider
 * @throws {ApiError} If the request fails
 */
export async function getModelsByProvider(): Promise<ModelsByProvider> {
  const response = await getAvailableModels();
  return response.models_by_provider;
}

