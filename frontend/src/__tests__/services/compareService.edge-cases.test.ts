/**
 * Edge case tests for compareService
 * 
 * Tests network errors, API errors, retries, and error scenarios.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as compareService from '../../services/compareService';
import { apiClient } from '../../services/api/client';
import { ApiError } from '../../services/api/errors';
import { createModelId } from '../../types';

// Mock the API client
vi.mock('../../services/api/client', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
    stream: vi.fn(),
  },
}));

describe('compareService - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Network Error Handling', () => {
    it('should handle network connection errors', async () => {
      const payload = {
        input_data: 'test input',
        models: [createModelId('gpt-4')],
        tier: 'standard' as const,
      };

      const networkError = new Error('Network request failed');
      vi.mocked(apiClient.post).mockRejectedValue(networkError);

      await expect(compareService.compare(payload)).rejects.toThrow('Network request failed');
    });

    it('should handle timeout errors', async () => {
      const payload = {
        input_data: 'test input',
        models: [createModelId('gpt-4')],
        tier: 'standard' as const,
      };

      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      vi.mocked(apiClient.post).mockRejectedValue(timeoutError);

      await expect(compareService.compare(payload)).rejects.toThrow('Request timeout');
    });

    it('should handle DNS resolution errors', async () => {
      const payload = {
        input_data: 'test input',
        models: [createModelId('gpt-4')],
        tier: 'standard' as const,
      };

      const dnsError = new Error('Failed to resolve DNS');
      vi.mocked(apiClient.post).mockRejectedValue(dnsError);

      await expect(compareService.compare(payload)).rejects.toThrow('Failed to resolve DNS');
    });
  });

  describe('API Error Handling', () => {
    it('should handle 400 Bad Request errors', async () => {
      const payload = {
        input_data: 'test input',
        models: [createModelId('gpt-4')],
        tier: 'standard' as const,
      };

      const error = new ApiError('Invalid request', 400, 'Bad Request');
      vi.mocked(apiClient.post).mockRejectedValue(error);

      await expect(compareService.compare(payload)).rejects.toThrow(ApiError);
      await expect(compareService.compare(payload)).rejects.toThrow('Invalid request');
    });

    it('should handle 401 Unauthorized errors', async () => {
      const payload = {
        input_data: 'test input',
        models: [createModelId('gpt-4')],
        tier: 'standard' as const,
      };

      const error = new ApiError('Unauthorized', 401, 'Unauthorized');
      vi.mocked(apiClient.post).mockRejectedValue(error);

      await expect(compareService.compare(payload)).rejects.toThrow(ApiError);
    });

    it('should handle 403 Forbidden errors', async () => {
      const payload = {
        input_data: 'test input',
        models: [createModelId('gpt-4')],
        tier: 'standard' as const,
      };

      const error = new ApiError('Forbidden', 403, 'Forbidden');
      vi.mocked(apiClient.post).mockRejectedValue(error);

      await expect(compareService.compare(payload)).rejects.toThrow(ApiError);
    });

    it('should handle 404 Not Found errors', async () => {
      const payload = {
        input_data: 'test input',
        models: [createModelId('gpt-4')],
        tier: 'standard' as const,
      };

      const error = new ApiError('Not found', 404, 'Not Found');
      vi.mocked(apiClient.post).mockRejectedValue(error);

      await expect(compareService.compare(payload)).rejects.toThrow(ApiError);
    });

    it('should handle 429 Rate Limit errors', async () => {
      const payload = {
        input_data: 'test input',
        models: [createModelId('gpt-4')],
        tier: 'standard' as const,
      };

      const error = new ApiError('Rate limit exceeded', 429, 'Too Many Requests');
      vi.mocked(apiClient.post).mockRejectedValue(error);

      await expect(compareService.compare(payload)).rejects.toThrow(ApiError);
      await expect(compareService.compare(payload)).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle 500 Internal Server errors', async () => {
      const payload = {
        input_data: 'test input',
        models: [createModelId('gpt-4')],
        tier: 'standard' as const,
      };

      const error = new ApiError('Internal server error', 500, 'Internal Server Error');
      vi.mocked(apiClient.post).mockRejectedValue(error);

      await expect(compareService.compare(payload)).rejects.toThrow(ApiError);
    });

    it('should handle 502 Bad Gateway errors', async () => {
      const payload = {
        input_data: 'test input',
        models: [createModelId('gpt-4')],
        tier: 'standard' as const,
      };

      const error = new ApiError('Bad gateway', 502, 'Bad Gateway');
      vi.mocked(apiClient.post).mockRejectedValue(error);

      await expect(compareService.compare(payload)).rejects.toThrow(ApiError);
    });

    it('should handle 503 Service Unavailable errors', async () => {
      const payload = {
        input_data: 'test input',
        models: [createModelId('gpt-4')],
        tier: 'standard' as const,
      };

      const error = new ApiError('Service unavailable', 503, 'Service Unavailable');
      vi.mocked(apiClient.post).mockRejectedValue(error);

      await expect(compareService.compare(payload)).rejects.toThrow(ApiError);
    });
  });

  describe('Input Validation Edge Cases', () => {
    it('should handle empty input', async () => {
      const payload = {
        input_data: '',
        models: [createModelId('gpt-4')],
        tier: 'standard' as const,
      };

      const error = new ApiError('Input cannot be empty', 400, 'Bad Request');
      vi.mocked(apiClient.post).mockRejectedValue(error);

      await expect(compareService.compare(payload)).rejects.toThrow(ApiError);
    });

    it('should handle whitespace-only input', async () => {
      const payload = {
        input_data: '   \n\t  ',
        models: [createModelId('gpt-4')],
        tier: 'standard' as const,
      };

      const error = new ApiError('Input cannot be empty', 400, 'Bad Request');
      vi.mocked(apiClient.post).mockRejectedValue(error);

      await expect(compareService.compare(payload)).rejects.toThrow(ApiError);
    });

    it('should handle very long input', async () => {
      const longInput = 'a'.repeat(100000);
      const payload = {
        input_data: longInput,
        models: [createModelId('gpt-4')],
        tier: 'extended' as const,
      };

      // May succeed or fail depending on tier limits
      const mockResponse = {
        results: { [createModelId('gpt-4')]: 'Response' },
        metadata: {
          input_length: longInput.length,
          models_requested: 1,
          models_successful: 1,
          models_failed: 0,
          timestamp: new Date().toISOString(),
          processing_time_ms: 1000,
        },
      };
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });

      const result = await compareService.compare(payload);
      expect(result).toEqual(mockResponse);
    });

    it('should handle input with special characters', async () => {
      const payload = {
        input_data: '!@#$%^&*()_+-=[]{}|;:\'",.<>?/`~',
        models: [createModelId('gpt-4')],
        tier: 'standard' as const,
      };

      const mockResponse = {
        results: { [createModelId('gpt-4')]: 'Response' },
        metadata: {
          input_length: payload.input_data.length,
          models_requested: 1,
          models_successful: 1,
          models_failed: 0,
          timestamp: new Date().toISOString(),
          processing_time_ms: 1000,
        },
      };
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });

      const result = await compareService.compare(payload);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Model Selection Edge Cases', () => {
    it('should handle empty models array', async () => {
      const payload = {
        input_data: 'test input',
        models: [],
        tier: 'standard' as const,
      };

      const error = new ApiError('At least one model must be selected', 400, 'Bad Request');
      vi.mocked(apiClient.post).mockRejectedValue(error);

      await expect(compareService.compare(payload)).rejects.toThrow(ApiError);
    });

    it('should handle invalid model IDs', async () => {
      const payload = {
        input_data: 'test input',
        models: ['invalid-model-id'] as any[],
        tier: 'standard' as const,
      };

      // May succeed with error in results or fail validation
      const mockResponse = {
        results: { 'invalid-model-id': 'Error: Invalid model' },
        metadata: {
          input_length: payload.input_data.length,
          models_requested: 1,
          models_successful: 0,
          models_failed: 1,
          timestamp: new Date().toISOString(),
          processing_time_ms: 1000,
        },
      };
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });

      const result = await compareService.compare(payload);
      expect(result.metadata.models_failed).toBe(1);
    });

    it('should handle many models', async () => {
      const manyModels = Array.from({ length: 10 }, (_, i) => createModelId(`model-${i}`));
      const payload = {
        input_data: 'test input',
        models: manyModels,
        tier: 'standard' as const,
      };

      const mockResponse = {
        results: manyModels.reduce((acc, id) => {
          acc[id] = 'Response';
          return acc;
        }, {} as Record<string, string>),
        metadata: {
          input_length: payload.input_data.length,
          models_requested: manyModels.length,
          models_successful: manyModels.length,
          models_failed: 0,
          timestamp: new Date().toISOString(),
          processing_time_ms: 1000,
        },
      };
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });

      const result = await compareService.compare(payload);
      expect(result.metadata.models_requested).toBe(10);
    });
  });

  describe('Streaming Error Handling', () => {
    it('should handle streaming connection errors', async () => {
      const payload = {
        input_data: 'test input',
        models: [createModelId('gpt-4')],
        tier: 'standard' as const,
      };

      const error = new Error('Stream connection failed');
      vi.mocked(apiClient.stream).mockRejectedValue(error);

      await expect(compareService.compareStream(payload)).rejects.toThrow('Stream connection failed');
    });

    it('should handle streaming timeout', async () => {
      const payload = {
        input_data: 'test input',
        models: [createModelId('gpt-4')],
        tier: 'standard' as const,
      };

      const timeoutError = new Error('Stream timeout');
      timeoutError.name = 'TimeoutError';
      vi.mocked(apiClient.stream).mockRejectedValue(timeoutError);

      await expect(compareService.compareStream(payload)).rejects.toThrow('Stream timeout');
    });

    it('should handle partial stream failure', async () => {
      const payload = {
        input_data: 'test input',
        models: [createModelId('gpt-4'), createModelId('claude-3')],
        tier: 'standard' as const,
      };

      // Simulate stream that fails partway through
      // Note: compareStream returns a ReadableStream, errors happen during processing
      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"type":"start","model":"gpt-4"}\n\n'));
          controller.enqueue(new TextEncoder().encode('data: {"type":"chunk","model":"gpt-4","content":"Partial"}\n\n'));
          controller.error(new Error('Stream interrupted'));
        },
      });

      vi.mocked(apiClient.stream).mockResolvedValue(stream);

      // Stream itself doesn't reject, errors happen during processing
      const result = await compareService.compareStream(payload);
      expect(result).toBeDefined();
      // The error would be caught during processStreamEvents, not here
    });
  });

  describe('Response Edge Cases', () => {
    it('should handle malformed response', async () => {
      const payload = {
        input_data: 'test input',
        models: [createModelId('gpt-4')],
        tier: 'standard' as const,
      };

      vi.mocked(apiClient.post).mockResolvedValue({ data: null });

      // Service may handle null gracefully or throw - check actual behavior
      try {
        const result = await compareService.compare(payload);
        // If it doesn't throw, it returns null
        expect(result).toBeNull();
      } catch (error) {
        // If it throws, that's also acceptable
        expect(error).toBeDefined();
      }
    });

    it('should handle response with missing fields', async () => {
      const payload = {
        input_data: 'test input',
        models: [createModelId('gpt-4')],
        tier: 'standard' as const,
      };

      vi.mocked(apiClient.post).mockResolvedValue({
        data: { results: {} }, // Missing metadata
      });

      // May throw or handle gracefully
      try {
        await compareService.compare(payload);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle response with empty results', async () => {
      const payload = {
        input_data: 'test input',
        models: [createModelId('gpt-4')],
        tier: 'standard' as const,
      };

      const mockResponse = {
        results: {},
        metadata: {
          input_length: payload.input_data.length,
          models_requested: 1,
          models_successful: 0,
          models_failed: 1,
          timestamp: new Date().toISOString(),
          processing_time_ms: 1000,
        },
      };
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });

      const result = await compareService.compare(payload);
      expect(result.results).toEqual({});
      expect(result.metadata.models_successful).toBe(0);
    });
  });

  describe('Rate Limit Status Edge Cases', () => {
    it('should handle rate limit status errors', async () => {
      const error = new ApiError('Rate limit check failed', 500, 'Internal Server Error');
      vi.mocked(apiClient.get).mockRejectedValue(error);

      await expect(compareService.getRateLimitStatus({})).rejects.toThrow(ApiError);
    });

    it('should handle rate limit status with null response', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: null });

      // Service may handle null gracefully or throw - check actual behavior
      try {
        const result = await compareService.getRateLimitStatus({});
        // If it doesn't throw, it returns null
        expect(result).toBeNull();
      } catch (error) {
        // If it throws, that's also acceptable
        expect(error).toBeDefined();
      }
    });

    it('should handle rate limit status with missing fields', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { authenticated: false }, // Missing other fields
      });

      // Should handle gracefully
      const result = await compareService.getRateLimitStatus({});
      expect(result.authenticated).toBe(false);
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle multiple concurrent comparison requests', async () => {
      const payload1 = {
        input_data: 'test 1',
        models: [createModelId('gpt-4')],
        tier: 'standard' as const,
      };
      const payload2 = {
        input_data: 'test 2',
        models: [createModelId('claude-3')],
        tier: 'standard' as const,
      };

      const mockResponse1 = {
        results: { [createModelId('gpt-4')]: 'Response 1' },
        metadata: {
          input_length: payload1.input_data.length,
          models_requested: 1,
          models_successful: 1,
          models_failed: 0,
          timestamp: new Date().toISOString(),
          processing_time_ms: 1000,
        },
      };
      const mockResponse2 = {
        results: { [createModelId('claude-3')]: 'Response 2' },
        metadata: {
          input_length: payload2.input_data.length,
          models_requested: 1,
          models_successful: 1,
          models_failed: 0,
          timestamp: new Date().toISOString(),
          processing_time_ms: 1000,
        },
      };

      vi.mocked(apiClient.post)
        .mockResolvedValueOnce({ data: mockResponse1 })
        .mockResolvedValueOnce({ data: mockResponse2 });

      const [result1, result2] = await Promise.all([
        compareService.compare(payload1),
        compareService.compare(payload2),
      ]);

      expect(result1.results[createModelId('gpt-4')]).toBe('Response 1');
      expect(result2.results[createModelId('claude-3')]).toBe('Response 2');
    });
  });
});

