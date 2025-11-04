/**
 * Model-related types for CompareAI
 * 
 * These types define the structure of AI models and their organization
 * throughout the application.
 */

import type { ModelId } from './branded';

/**
 * AI Model information
 */
export interface Model {
  /** Unique identifier for the model */
  id: ModelId;
  /** Display name of the model */
  name: string;
  /** Description of the model's capabilities */
  description: string;
  /** Category the model belongs to (e.g., 'gpt', 'claude', 'gemini') */
  category: string;
  /** Provider of the model (e.g., 'OpenAI', 'Anthropic', 'Google') */
  provider: string;
  /** Whether the model is currently available for selection */
  available?: boolean;
}

/**
 * Models organized by provider
 */
export interface ModelsByProvider {
  [provider: string]: Model[];
}

