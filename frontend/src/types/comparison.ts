/**
 * Comparison-related types for CompareAI
 * 
 * These types define the structure of comparison requests, responses,
 * and metadata throughout the application.
 */

import type { ModelId } from './branded';

/**
 * Metadata included with comparison responses
 */
export interface ComparisonMetadata {
  /** Length of the input data in characters */
  input_length: number;
  /** Number of models requested for comparison */
  models_requested: number;
  /** Number of models that successfully responded */
  models_successful: number;
  /** Number of models that failed */
  models_failed: number;
  /** ISO timestamp when the comparison was processed */
  timestamp: string;
  /** Optional processing time in milliseconds */
  processing_time_ms?: number;
}

/**
 * Full comparison response from the API
 */
export interface CompareResponse {
  /** Results keyed by model ID */
  results: Record<ModelId, string>;
  /** Metadata about the comparison */
  metadata: ComparisonMetadata;
}

/**
 * Comparison tier (affects input/output limits)
 */
export const COMPARISON_TIER = {
  BRIEF: 'brief',
  STANDARD: 'standard',
  EXTENDED: 'extended',
} as const;

export type ComparisonTier = typeof COMPARISON_TIER[keyof typeof COMPARISON_TIER];

/**
 * Result tab type for displaying comparison results
 */
export const RESULT_TAB = {
  FORMATTED: 'formatted',
  RAW: 'raw',
} as const;

export type ResultTab = typeof RESULT_TAB[keyof typeof RESULT_TAB];

/**
 * Mapping of model IDs to their active result tab
 */
export type ActiveResultTabs = Record<ModelId, ResultTab>;

