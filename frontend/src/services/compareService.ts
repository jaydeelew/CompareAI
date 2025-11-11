/**
 * Comparison Service
 * 
 * Handles all comparison-related API endpoints including:
 * - Standard comparison requests
 * - Streaming comparison requests (SSE)
 * - Rate limit status
 */

import { apiClient } from './api/client';
import type { CompareResponse, StreamEvent } from '../types';
import { STREAM_EVENT_TYPE } from '../types';

/**
 * Request body for comparison endpoint
 */
export interface CompareRequestPayload {
  input_data: string;
  models: string[];
  conversation_history?: Array<{ role: string; content: string }>;
  browser_fingerprint?: string;
  tier: 'standard' | 'extended';
  conversation_id?: number;
}

/**
 * Rate limit status response
 */
export interface RateLimitStatus {
  daily_usage: number;
  daily_limit: number;
  remaining_usage: number;
  subscription_tier: string;
  model_limit: number;
  overage_allowed: boolean;
  overage_price: number | null;
  monthly_overage_count: number;
  reset_time: string;
  user_type: 'authenticated' | 'anonymous';
  extended_usage?: number;
  extended_limit?: number;
}

/**
 * Anonymous mock mode status
 */
export interface AnonymousMockModeStatus {
  anonymous_mock_mode_enabled: boolean;
  is_development: boolean;
}

/**
 * Model statistics response
 */
export interface ModelStats {
  [modelId: string]: {
    success: number;
    failure: number;
    last_error: string | null;
    last_success: string | null;
  };
}

/**
 * Perform a standard (non-streaming) comparison
 * 
 * @param payload - Comparison request payload
 * @returns Promise resolving to comparison results
 * @throws {ApiError} If the request fails
 */
export async function compare(
  payload: CompareRequestPayload
): Promise<CompareResponse> {
  const response = await apiClient.post<CompareResponse>(
    '/compare',
    payload
  );
  return response.data;
}

/**
 * Perform a streaming comparison using Server-Sent Events (SSE)
 * 
 * Returns a ReadableStream that can be processed manually, or use
 * processStreamEvents() helper to process with callbacks.
 * 
 * @param payload - Comparison request payload
 * @returns Promise resolving to the readable stream
 * @throws {ApiError} If the request fails
 */
export async function compareStream(
  payload: CompareRequestPayload
): Promise<ReadableStream<Uint8Array> | null> {
  return apiClient.stream('/compare-stream', payload);
}

/**
 * Process a streaming response and call callbacks for each event
 * 
 * This helper function reads from a ReadableStream and processes
 * SSE events, calling the appropriate callbacks.
 * 
 * @param stream - ReadableStream from compareStream()
 * @param callbacks - Callbacks for stream events
 * @returns Promise that resolves when stream processing completes
 */
export async function processStreamEvents(
  stream: ReadableStream<Uint8Array> | null,
  callbacks: {
    onStart?: (model: string) => void;
    onChunk?: (model: string, content: string) => void;
    onDone?: (model: string) => void;
    onComplete?: (metadata: StreamEvent['metadata']) => void;
    onError?: (error: Error) => void;
  }
): Promise<void> {
  if (!stream) {
    if (callbacks.onError) {
      callbacks.onError(new Error('Stream is null'));
    }
    return;
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      // Decode the chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE messages (separated by \n\n)
      const messages = buffer.split('\n\n');
      buffer = messages.pop() || ''; // Keep incomplete message in buffer

      for (const message of messages) {
        if (!message.trim() || !message.startsWith('data: ')) continue;

        try {
          const jsonStr = message.replace(/^data: /, '');
          const event: StreamEvent = JSON.parse(jsonStr);

          switch (event.type) {
            case STREAM_EVENT_TYPE.START:
              if (event.model && callbacks.onStart) {
                callbacks.onStart(event.model);
              }
              break;

            case STREAM_EVENT_TYPE.CHUNK:
              if (event.model && event.content && callbacks.onChunk) {
                callbacks.onChunk(event.model, event.content);
              }
              break;

            case STREAM_EVENT_TYPE.DONE:
              if (event.model && callbacks.onDone) {
                callbacks.onDone(event.model);
              }
              break;

            case STREAM_EVENT_TYPE.COMPLETE:
              if (event.metadata && callbacks.onComplete) {
                callbacks.onComplete(event.metadata);
              }
              break;

            case STREAM_EVENT_TYPE.ERROR:
              if (event.message && callbacks.onError) {
                callbacks.onError(new Error(event.message));
              }
              break;
          }
        } catch (parseError) {
          console.error('Error parsing SSE message:', parseError, message);
          if (callbacks.onError) {
            callbacks.onError(parseError as Error);
          }
        }
      }
    }
  } catch (error) {
    if (callbacks.onError) {
      callbacks.onError(error as Error);
    }
    throw error;
  } finally {
    reader.releaseLock();
  }
}

/**
 * Get current rate limit status for the user
 * 
 * @param fingerprint - Optional browser fingerprint for anonymous users
 * @returns Promise resolving to rate limit status
 * @throws {ApiError} If the request fails
 */
export async function getRateLimitStatus(
  fingerprint?: string
): Promise<RateLimitStatus> {
  const params = fingerprint ? `?fingerprint=${encodeURIComponent(fingerprint)}` : '';
  const response = await apiClient.get<RateLimitStatus>(
    `/rate-limit-status${params}`
  );
  return response.data;
}

/**
 * Get anonymous mock mode status (development only)
 * 
 * @returns Promise resolving to mock mode status
 * @throws {ApiError} If the request fails
 */
export async function getAnonymousMockModeStatus(): Promise<AnonymousMockModeStatus> {
  const response = await apiClient.get<AnonymousMockModeStatus>(
    '/anonymous-mock-mode-status'
  );
  return response.data;
}

/**
 * Get model statistics
 * 
 * @returns Promise resolving to model statistics
 * @throws {ApiError} If the request fails
 */
export async function getModelStats(): Promise<ModelStats> {
  const response = await apiClient.get<{ model_stats: ModelStats }>(
    '/model-stats'
  );
  return response.data.model_stats;
}

/**
 * Reset rate limit (development only)
 * 
 * @param fingerprint - Optional browser fingerprint for anonymous users
 * @returns Promise resolving to success status
 * @throws {ApiError} If the request fails
 */
export async function resetRateLimit(
  fingerprint?: string
): Promise<{ message: string }> {
  const payload = fingerprint ? { fingerprint } : {};
  const response = await apiClient.post<{ message: string }>(
    '/dev/reset-rate-limit',
    payload
  );
  return response.data;
}

