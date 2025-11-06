/**
 * Base API Client for CompareAI
 * 
 * Provides a centralized, type-safe API client with:
 * - Automatic token injection
 * - Request/response interceptors
 * - Retry logic for transient failures
 * - Request cancellation (AbortController)
 * - Response caching (where appropriate)
 * - Type-safe error handling
 */

import type {
  ApiClientConfig,
  RequestConfig,
  ApiResponse,
  RequestInterceptor,
  ResponseInterceptor,
  ErrorInterceptor,
  RetryConfig,
  CacheConfig,
  CacheEntry,
  StreamRequestConfig,
} from './types';
import {
  ApiError,
  NetworkError,
  TimeoutError,
  CancellationError,
} from './errors';
import {
  authInterceptor,
  defaultHeadersInterceptor,
  timeoutInterceptor,
  jsonResponseInterceptor,
  errorResponseInterceptor,
  networkErrorInterceptor,
  loggingErrorInterceptor,
  loggingRequestInterceptor,
  loggingResponseInterceptor,
} from './interceptors';

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  shouldRetry: (error: Error) => {
    if (error instanceof ApiError) {
      return error.isRetryable();
    }
    return error instanceof NetworkError || error instanceof TimeoutError;
  },
};

/**
 * Default cache configuration
 */
const DEFAULT_CACHE_CONFIG: CacheConfig = {
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  maxSize: 100,
  getKey: (url: string, config: RequestConfig) => {
    // Cache key includes URL and method (GET requests are cacheable by default)
    return `${config.method || 'GET'}:${url}`;
  },
};

/**
 * Simple in-memory cache implementation
 */
class ResponseCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttl: number): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  delete(key: string): void {
    this.cache.delete(key);
  }
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  multiplier: number
): number {
  const delay = initialDelay * Math.pow(multiplier, attempt);
  return Math.min(delay, maxDelay);
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Base API Client class
 */
export class ApiClient {
  private baseURL: string;
  private _defaultTimeout: number;
  private _defaultHeaders: HeadersInit;
  private retryConfig: RetryConfig;
  private cache: ResponseCache | null = null;
  private getToken?: () => string | null;
  private _refreshToken?: () => Promise<string | null>;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private errorInterceptors: ErrorInterceptor[] = [];

  constructor(config: ApiClientConfig) {
    this.baseURL = config.baseURL.replace(/\/$/, ''); // Remove trailing slash
    this._defaultTimeout = config.timeout ?? 60000; // Default 60 seconds
    this._defaultHeaders = config.headers ?? {};
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config.retry };
    this.getToken = config.getToken;
    this._refreshToken = config.refreshToken;

    // Setup cache if enabled (default to enabled)
    const cacheEnabled = (config.cache as any) !== false;
    if (cacheEnabled) {
      const cacheConfig = { ...DEFAULT_CACHE_CONFIG, ...config.cache };
      this.cache = new ResponseCache(cacheConfig.maxSize);
    }

    // Setup default interceptors
    this.setupDefaultInterceptors();

    // Add custom interceptors
    if (config.requestInterceptors) {
      this.requestInterceptors.push(...config.requestInterceptors);
    }
    if (config.responseInterceptors) {
      this.responseInterceptors.push(...config.responseInterceptors);
    }
    if (config.errorInterceptors) {
      this.errorInterceptors.push(...config.errorInterceptors);
    }
  }

  /**
   * Setup default interceptors
   */
  private setupDefaultInterceptors(): void {
    // Request interceptors (order matters)
    this.requestInterceptors.push(
      loggingRequestInterceptor,
      defaultHeadersInterceptor,
      authInterceptor,
      timeoutInterceptor
    );

    // Response interceptors
    this.responseInterceptors.push(
      loggingResponseInterceptor,
      jsonResponseInterceptor,
      errorResponseInterceptor
    );

    // Error interceptors
    this.errorInterceptors.push(
      networkErrorInterceptor,
      loggingErrorInterceptor
    );
  }

  /**
   * Apply request interceptors
   */
  private async applyRequestInterceptors(
    url: string,
    config: RequestConfig
  ): Promise<[string, RequestConfig]> {
    let finalUrl = url;
    let finalConfig = { ...config };

    // Inject token getter into config for auth interceptor
    if (this.getToken) {
      (finalConfig as any).getToken = this.getToken;
    }

    for (const interceptor of this.requestInterceptors) {
      [finalUrl, finalConfig] = await interceptor(finalUrl, finalConfig);
    }

    return [finalUrl, finalConfig];
  }

  /**
   * Apply response interceptors
   */
  private async applyResponseInterceptors<T>(
    response: Response,
    config: RequestConfig
  ): Promise<Response> {
    let finalResponse = response;

    for (const interceptor of this.responseInterceptors) {
      finalResponse = await interceptor<T>(finalResponse, config);
    }

    return finalResponse;
  }

  /**
   * Apply error interceptors
   */
  private async applyErrorInterceptors(
    error: Error,
    config: RequestConfig
  ): Promise<Error> {
    let finalError = error;

    for (const interceptor of this.errorInterceptors) {
      finalError = await interceptor(finalError, config);
    }

    return finalError;
  }

  /**
   * Parse response body
   */
  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type');
    
    // Handle empty responses
    if (response.status === 204 || response.status === 205) {
      return undefined as T;
    }

    // Parse JSON
    if (contentType?.includes('application/json')) {
      try {
        return await response.json();
      } catch (error) {
        throw new ApiError(
          'Failed to parse JSON response',
          response.status,
          response.statusText
        );
      }
    }

    // Parse text
    if (contentType?.includes('text/')) {
      return (await response.text()) as T;
    }

    // Return blob for other types
    return (await response.blob()) as T;
  }

  /**
   * Execute request with retry logic
   */
  private async executeWithRetry<T>(
    url: string,
    config: RequestConfig,
    attempt: number = 0
  ): Promise<ApiResponse<T>> {
    try {
      // Check cache for GET requests
      if ((config.method === 'GET' || !config.method) && config.enableCache !== false) {
        const cacheKey = this.cache
          ? config._cacheKey || `${config.method || 'GET'}:${url}`
          : null;
        
        if (cacheKey && this.cache) {
          const cached = this.cache.get<T>(cacheKey);
          if (cached !== null) {
            // Return cached response
            return {
              data: cached,
              status: 200,
              statusText: 'OK',
              headers: new Headers(),
              response: new Response(),
            };
          }
        }
      }

      // Apply request interceptors
      const [finalUrl, finalConfig] = await this.applyRequestInterceptors(
        url,
        config
      );

      // Cleanup timeout on completion
      const cleanup = () => {
        if ((finalConfig as any)._timeoutId) {
          clearTimeout((finalConfig as any)._timeoutId);
        }
      };

      try {
        // Execute fetch
        const fullUrl = finalUrl.startsWith('http')
          ? finalUrl
          : `${this.baseURL}${finalUrl.startsWith('/') ? '' : '/'}${finalUrl}`;

        // Remove internal properties before passing to fetch
        const { _timeoutId, _cacheKey, getToken, enableCache, cacheTTL, timeout, retry, maxRetries, retryDelay, skipAuth, ...fetchConfig } = finalConfig as any;
        
        const response = await fetch(fullUrl, fetchConfig);

        // Cleanup timeout
        cleanup();

        // Apply response interceptors (will throw on error)
        const processedResponse = await this.applyResponseInterceptors<T>(
          response,
          finalConfig
        );

        // Parse response
        const data = await this.parseResponse<T>(processedResponse);

        // Cache GET responses
        if ((config.method === 'GET' || !config.method) && config.enableCache !== false) {
          const cacheKey = config._cacheKey || `${config.method || 'GET'}:${url}`;
          const cacheTTL = config.cacheTTL ?? (this.cache ? DEFAULT_CACHE_CONFIG.defaultTTL : 0);
          
          if (cacheKey && this.cache && cacheTTL > 0) {
            this.cache.set(cacheKey, data, cacheTTL);
          }
        }

        return {
          data,
          status: processedResponse.status,
          statusText: processedResponse.statusText,
          headers: processedResponse.headers,
          response: processedResponse,
        };
      } catch (error) {
        cleanup();
        throw error;
      }
    } catch (error) {
      // Handle cancellation
      if (error instanceof Error && error.name === 'AbortError') {
        throw new CancellationError('Request was cancelled');
      }

      // Apply error interceptors
      const processedError = await this.applyErrorInterceptors(
        error as Error,
        config
      );

      // Check if we should retry
      const shouldRetry =
        attempt < this.retryConfig.maxRetries &&
        this.retryConfig.shouldRetry(processedError) &&
        (config.retry !== false);

      if (shouldRetry) {
        // Calculate backoff delay
        const delay = calculateBackoffDelay(
          attempt,
          this.retryConfig.initialDelay,
          this.retryConfig.maxDelay,
          this.retryConfig.backoffMultiplier
        );

        // Wait before retrying
        await sleep(delay);

        // Retry request
        return this.executeWithRetry<T>(url, config, attempt + 1);
      }

      // No retry or max retries reached, throw error
      throw processedError;
    }
  }

  /**
   * Make a GET request
   */
  async get<T = unknown>(
    url: string,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.executeWithRetry<T>(url, {
      method: 'GET',
      ...config,
    });
  }

  /**
   * Make a POST request
   */
  async post<T = unknown>(
    url: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.executeWithRetry<T>(url, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      ...config,
    });
  }

  /**
   * Make a PUT request
   */
  async put<T = unknown>(
    url: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.executeWithRetry<T>(url, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      ...config,
    });
  }

  /**
   * Make a PATCH request
   */
  async patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.executeWithRetry<T>(url, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
      ...config,
    });
  }

  /**
   * Make a DELETE request
   */
  async delete<T = unknown>(
    url: string,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.executeWithRetry<T>(url, {
      method: 'DELETE',
      ...config,
    });
  }

  /**
   * Make a streaming request (Server-Sent Events)
   */
  async stream(
    url: string,
    data?: unknown,
    config?: StreamRequestConfig
  ): Promise<ReadableStream<Uint8Array> | null> {
    const { onChunk, onComplete, onError, ...requestConfig } = config || {};

    try {
      // Apply request interceptors
      const [finalUrl, finalConfig] = await this.applyRequestInterceptors(
        url,
        {
          method: 'POST',
          body: data ? JSON.stringify(data) : undefined,
          ...requestConfig,
        }
      );

      const fullUrl = finalUrl.startsWith('http')
        ? finalUrl
        : `${this.baseURL}${finalUrl.startsWith('/') ? '' : '/'}${finalUrl}`;

      // Remove internal properties before passing to fetch
      const { _timeoutId, _cacheKey, getToken, enableCache, cacheTTL, timeout, retry, maxRetries, retryDelay, skipAuth, ...fetchConfig } = finalConfig as any;
      
      const response = await fetch(fullUrl, fetchConfig);

      if (!response.ok) {
        // Apply error interceptors
        const errorData = await response.json().catch(() => ({}));
        const error = new ApiError(
          errorData.detail || response.statusText,
          response.status,
          response.statusText,
          errorData
        );
        const processedError = await this.applyErrorInterceptors(error, finalConfig);
        throw processedError;
      }

      // Return the stream
      return response.body;
    } catch (error) {
      if (onError) {
        onError(error as Error);
      }
      const processedError = await this.applyErrorInterceptors(
        error as Error,
        requestConfig || {}
      );
      throw processedError;
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache?.clear();
  }

  /**
   * Delete specific cache entry
   */
  deleteCache(key: string): void {
    this.cache?.delete(key);
  }

  /**
   * Add request interceptor
   */
  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  /**
   * Add response interceptor
   */
  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  /**
   * Add error interceptor
   */
  addErrorInterceptor(interceptor: ErrorInterceptor): void {
    this.errorInterceptors.push(interceptor);
  }
}

/**
 * Create default API client instance
 */
export function createApiClient(config?: Partial<ApiClientConfig>): ApiClient {
  const baseURL =
    config?.baseURL ||
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    '/api';

  return new ApiClient({
    baseURL,
    timeout: 60000,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    getToken: () => localStorage.getItem('access_token'),
    ...config,
  });
}

/**
 * Default API client instance
 */
export const apiClient = createApiClient();

