/**
 * API Client
 *
 * Centralized API client that handles:
 * - Request/response encryption (when enabled)
 * - Authentication token injection
 * - Error handling
 * - Request/response interceptors
 *
 * Supports dual-mode operation:
 * - Encrypted mode: Uses cryptoService for request/response encryption
 * - Plain mode: Standard fetch() for gradual migration
 */

import { authService } from './authService';
import { cryptoService } from './cryptoService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Feature flag: Enable encryption (default: false for gradual rollout)
const ENCRYPTION_ENABLED = import.meta.env.VITE_ENCRYPTION_ENABLED === 'true';

export interface ApiRequestOptions {
  headers?: Record<string, string>;
  skipAuth?: boolean;
  skipEncryption?: boolean;
  timeout?: number;
}

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: any;
}

export class ApiClientError extends Error {
  status?: number;
  code?: string;
  details?: any;

  constructor(message: string, status?: number, code?: string, details?: any) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

class ApiClient {
  private baseUrl: string;
  private defaultTimeout: number = 30000; // 30 seconds
  private encryptionEnabled: boolean = ENCRYPTION_ENABLED;
  private initialized: boolean = false;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Initialize the API client (fetch encryption keys if needed)
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.encryptionEnabled) {
      try {
        console.log('[ApiClient] Initializing with encryption enabled...');
        await cryptoService.initialize();
        console.log('[ApiClient] ✅ Encryption initialized');
      } catch (error) {
        console.error('[ApiClient] Encryption initialization failed:', error);
        // Fall back to non-encrypted mode
        this.encryptionEnabled = false;
        console.warn('[ApiClient] ⚠️ Falling back to non-encrypted mode');
      }
    }

    this.initialized = true;
  }

  /**
   * Build full URL from endpoint
   */
  private buildUrl(endpoint: string): string {
    // Remove leading slash if present
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    return `${this.baseUrl}/${cleanEndpoint}`;
  }

  /**
   * Get authorization headers
   */
  private getAuthHeaders(skipAuth: boolean = false): Record<string, string> {
    if (skipAuth) {
      return {};
    }

    const token = authService.getToken();
    if (!token) {
      return {};
    }

    return {
      'Authorization': `Bearer ${token}`
    };
  }

  /**
   * Make an HTTP request
   */
  async request<T>(
    method: string,
    endpoint: string,
    data?: any,
    options: ApiRequestOptions = {}
  ): Promise<T> {
    // Ensure initialized
    if (!this.initialized) {
      await this.initialize();
    }

    const url = this.buildUrl(endpoint);
    const {
      headers = {},
      skipAuth = false,
      skipEncryption = false,
      timeout = this.defaultTimeout
    } = options;

    try {
      // Determine if we should encrypt this request
      const shouldEncrypt = this.encryptionEnabled && !skipEncryption && data;

      // Build headers
      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(skipAuth),
        ...headers
      };

      let body: string | undefined;

      if (data) {
        if (shouldEncrypt) {
          // Encrypt the request
          console.log(`[ApiClient] 🔒 Encrypting ${method} request to ${endpoint}`);
          const encrypted = await cryptoService.encryptPayload(data);
          body = JSON.stringify(encrypted);
          requestHeaders['X-Encrypted-Request'] = 'true';
        } else {
          // Plain request
          body = JSON.stringify(data);
        }
      }

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Make request
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Handle non-OK responses
      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      // Parse response
      const responseData = await response.json();

      // Check if response is encrypted
      const isEncrypted = response.headers.get('X-Encrypted-Response') === 'true';

      if (isEncrypted) {
        console.log(`[ApiClient] 🔓 Decrypting response from ${endpoint}`);
        // TODO: Implement response decryption when backend supports it
        console.warn('[ApiClient] Response decryption not yet implemented');
        return responseData as T;
      }

      return responseData as T;

    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new ApiClientError(
          `Request timeout after ${timeout}ms`,
          408,
          'TIMEOUT'
        );
      }

      if (error instanceof ApiClientError) {
        throw error;
      }

      throw new ApiClientError(
        error.message || 'Network error',
        undefined,
        'NETWORK_ERROR',
        error
      );
    }
  }

  /**
   * Handle error responses
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorMessage = `Request failed with status ${response.status}`;
    let errorDetails: any = undefined;

    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorData.message || errorMessage;
      errorDetails = errorData;
    } catch (e) {
      // Failed to parse error response
      errorMessage = await response.text() || errorMessage;
    }

    // Handle specific status codes
    if (response.status === 401) {
      console.warn('[ApiClient] Unauthorized - clearing auth token');
      authService.logout();
    }

    throw new ApiClientError(
      errorMessage,
      response.status,
      this.getErrorCode(response.status),
      errorDetails
    );
  }

  /**
   * Get error code from HTTP status
   */
  private getErrorCode(status: number): string {
    const codes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'VALIDATION_ERROR',
      429: 'RATE_LIMIT',
      500: 'INTERNAL_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
      504: 'GATEWAY_TIMEOUT'
    };

    return codes[status] || 'UNKNOWN_ERROR';
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>('GET', endpoint, undefined, options);
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, data?: any, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>('POST', endpoint, data, options);
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, data?: any, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>('PUT', endpoint, data, options);
  }

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, data?: any, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>('PATCH', endpoint, data, options);
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>('DELETE', endpoint, undefined, options);
  }

  /**
   * Enable/disable encryption
   */
  setEncryptionEnabled(enabled: boolean): void {
    this.encryptionEnabled = enabled;
    if (enabled && !this.initialized) {
      console.warn('[ApiClient] Encryption enabled but not initialized. Call initialize() first.');
    }
  }

  /**
   * Check if encryption is enabled
   */
  isEncryptionEnabled(): boolean {
    return this.encryptionEnabled;
  }

  /**
   * Check if client is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export class for testing
export default ApiClient;
