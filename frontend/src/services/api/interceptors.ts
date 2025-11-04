/**
 * Request and response interceptors for API client
 * 
 * Provides hooks for modifying requests and responses,
 * handling authentication, logging, and error transformation.
 */

import type {
  RequestInterceptor,
  ResponseInterceptor,
  ErrorInterceptor,
  RequestConfig,
} from './types';
import { ApiError, NetworkError, TimeoutError } from './errors';
import type { ApiErrorResponse } from '../../types/api';

/**
 * Default request interceptor: Add authentication token
 */
export const authInterceptor: RequestInterceptor = async (url, config) => {
  // Skip if auth is disabled for this request
  if (config.skipAuth) {
    return [url, config];
  }

  // Get token from config if provided, otherwise try to get from localStorage
  const getToken = (config as any).getToken;
  const token = getToken ? getToken() : localStorage.getItem('access_token');

  if (token) {
    const headers = new Headers(config.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return [url, { ...config, headers }];
  }

  return [url, config];
};

/**
 * Request interceptor: Add default headers
 */
export const defaultHeadersInterceptor: RequestInterceptor = async (url, config) => {
  const headers = new Headers(config.headers);
  
  // Add Content-Type if not present and body exists
  if (config.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Add Accept header
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  return [url, { ...config, headers }];
};

/**
 * Request interceptor: Add request timeout
 */
export const timeoutInterceptor: RequestInterceptor = async (url, config) => {
  const timeout = config.timeout ?? 60000; // Default 60 seconds

  // Create abort controller if not provided
  const controller = config.signal
    ? undefined
    : new AbortController();

  // Set timeout
  const timeoutId = timeout > 0
    ? setTimeout(() => {
        controller?.abort();
      }, timeout)
    : undefined;

  // Store timeout ID for cleanup
  const enhancedConfig: RequestConfig = {
    ...config,
    signal: config.signal || controller?.signal,
    // Store cleanup function
    ...(timeoutId && { _timeoutId: timeoutId }),
  };

  return [url, enhancedConfig];
};

/**
 * Response interceptor: Parse JSON responses
 */
export const jsonResponseInterceptor: ResponseInterceptor = async <T>(
  response: Response,
  config: RequestConfig
) => {
  // For streaming responses, return as-is (checked via StreamRequestConfig)
  if ((config as any).onChunk) {
    return response;
  }

  // Handle empty responses
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    // If no content or not JSON, try to parse as text or return empty
    if (response.status === 204 || response.status === 205) {
      return response;
    }
  }

  return response;
};

/**
 * Response interceptor: Handle errors
 */
export const errorResponseInterceptor: ResponseInterceptor = async (
  response: Response,
  config: RequestConfig
) => {
  if (!response.ok) {
    // Try to parse error response
    let errorData: ApiErrorResponse | undefined;
    try {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        errorData = await response.json();
      }
    } catch {
      // Failed to parse JSON, use default error
    }

    const message = errorData?.detail || errorData?.code || response.statusText || 'Request failed';
    
    // Create appropriate error based on status code
    if (response.status === 401) {
      throw new ApiError(message, 401, 'Unauthorized', errorData);
    } else if (response.status === 403) {
      throw new ApiError(message, 403, 'Forbidden', errorData);
    } else if (response.status === 404) {
      throw new ApiError(message, 404, 'Not Found', errorData);
    } else if (response.status === 422) {
      throw new ApiError(message, 422, 'Unprocessable Entity', errorData);
    } else if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      throw new ApiError(
        message,
        429,
        'Too Many Requests',
        errorData,
        undefined
      );
    } else if (response.status >= 500) {
      throw new ApiError(
        message,
        response.status,
        response.statusText,
        errorData
      );
    } else {
      throw new ApiError(
        message,
        response.status,
        response.statusText,
        errorData
      );
    }
  }

  return response;
};

/**
 * Error interceptor: Transform network errors
 */
export const networkErrorInterceptor: ErrorInterceptor = async (error, config) => {
  // Handle AbortError (timeout or cancellation)
  if (error.name === 'AbortError') {
    // Check if it was a timeout
    if (config.timeout) {
      return new TimeoutError(`Request timeout after ${config.timeout}ms`, config.timeout);
    }
    // Otherwise it was cancelled
    return error;
  }

  // Handle fetch errors (network errors)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return new NetworkError('Network error: Failed to fetch', error);
  }

  return error;
};

/**
 * Error interceptor: Log errors (development only)
 */
export const loggingErrorInterceptor: ErrorInterceptor = async (error, config) => {
  if (import.meta.env.DEV) {
    console.error('[API Client Error]', {
      error: error.message,
      url: config.url || 'unknown',
      method: config.method || 'GET',
      status: (error as any).status,
    });
  }
  return error;
};

/**
 * Request interceptor: Log requests (development only)
 */
export const loggingRequestInterceptor: RequestInterceptor = async (url, config) => {
  if (import.meta.env.DEV) {
    const headers = config.headers ? new Headers(config.headers) : new Headers();
    const headerEntries: [string, string][] = [];
    headers.forEach((value, key) => {
      headerEntries.push([key, value]);
    });
    console.log('[API Request]', {
      method: config.method || 'GET',
      url,
      headers: Object.fromEntries(headerEntries),
    });
  }
  return [url, config];
};

/**
 * Response interceptor: Log responses (development only)
 */
export const loggingResponseInterceptor: ResponseInterceptor = async (response, config) => {
  if (import.meta.env.DEV) {
    console.log('[API Response]', {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
    });
  }
  return response;
};

