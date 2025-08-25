import ky, { type KyInstance } from 'ky';
import { logger } from '../utils/logger';

export interface ApiClientConfig {
  baseUrl: string;
  timeout?: number | undefined;
  retries?: number | undefined;
  auth?: {
    token: string;
  } | undefined;
  headers?: Record<string, string> | undefined;
}

export interface ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
}

/**
 * Centralized HTTP client for all API communication
 * 
 * Benefits:
 * - Type-safe requests and responses
 * - Consistent error handling across the app
 * - Centralized authentication
 * - Automatic retry logic
 * - Request/response logging
 * - Configurable timeouts
 */
export class ApiClient {
  private http: KyInstance;
  private apiLogger: typeof logger;
  private baseUrl: string;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl;
    this.apiLogger = logger.withContext({ 
      component: 'ApiClient',
      baseUrl: config.baseUrl,
    });

    // Create ky instance with configuration
    this.http = ky.create({
      prefixUrl: config.baseUrl,
      timeout: config.timeout || 10000, // 10 second default timeout
      retry: {
        limit: config.retries || 3,
        statusCodes: [408, 413, 429, 500, 502, 503, 504],
        methods: ['get', 'post', 'put', 'delete'],
        delay: attemptCount => Math.min(1000 * (2 ** attemptCount), 30000), // Exponential backoff
      },
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
        ...(config.auth && { 'Authorization': `Bearer ${config.auth.token}` }),
      },
      hooks: {
        beforeRequest: [
          (request) => {
            this.apiLogger.debug('API request', {
              method: request.method,
              url: request.url.toString(),
              headers: Object.fromEntries(request.headers.entries()),
            });
          },
        ],
        afterResponse: [
          (request, _options, response) => {
            this.apiLogger.info('API response', {
              method: request.method,
              url: request.url.toString(),
              status: response.status,
              statusText: response.statusText,
              duration: Date.now() - (request as any)._startTime,
            });
          },
        ],
        beforeError: [
          (error) => {
            this.apiLogger.error('API error', {
              method: error.request?.method,
              url: error.request?.url,
              status: error.response?.status,
              statusText: error.response?.statusText,
              message: error.message,
            });

            // For ky, we need to return the original error or a modified HTTPError
            // We can't return a custom ApiError type here
            return error;
          },
        ],
      },
    });

    // Add start time for duration tracking
    this.http = this.http.extend({
      hooks: {
        beforeRequest: [
          (request) => {
            (request as any)._startTime = Date.now();
          },
        ],
      },
    });
  }

  /**
   * Perform GET request with type safety
   */
  async get<T>(url: string, searchParams?: Record<string, string | number | boolean>): Promise<T> {
    return this.http.get(url, { searchParams }).json<T>();
  }

  /**
   * Perform POST request with type safety
   */
  async post<T>(url: string, body?: unknown): Promise<T> {
    return this.http.post(url, { json: body }).json<T>();
  }

  /**
   * Perform PUT request with type safety
   */
  async put<T>(url: string, body?: unknown): Promise<T> {
    return this.http.put(url, { json: body }).json<T>();
  }

  /**
   * Perform DELETE request
   */
  async delete(url: string): Promise<void> {
    await this.http.delete(url);
  }

  /**
   * Perform PATCH request with type safety
   */
  async patch<T>(url: string, body?: unknown): Promise<T> {
    return this.http.patch(url, { json: body }).json<T>();
  }

  /**
   * Get raw response for custom handling
   */
  async getRaw(url: string, searchParams?: Record<string, string | number | boolean>): Promise<Response> {
    return this.http.get(url, { searchParams });
  }

  /**
   * Post raw response for custom handling
   */
  async postRaw(url: string, body?: unknown): Promise<Response> {
    return this.http.post(url, { json: body });
  }

  /**
   * Create a new client with additional configuration
   */
  extend(config: Partial<ApiClientConfig>): ApiClient {
    return new ApiClient({
      baseUrl: config.baseUrl || this.baseUrl,
      timeout: config.timeout || undefined,
      retries: config.retries || undefined,
      auth: config.auth || undefined,
      headers: config.headers || undefined,
    });
  }

  /**
   * Update authentication token
   */
  setAuthToken(token: string): ApiClient {
    return this.extend({ auth: { token } });
  }

}

/**
 * Factory functions for common API client configurations
 */
export const createApiClient = (config: ApiClientConfig): ApiClient => {
  return new ApiClient(config);
};

/**
 * Create client for Cloudflare Worker API
 */
export const createWorkerClient = (workerUrl: string, authToken?: string): ApiClient => {
  return createApiClient({
    baseUrl: workerUrl,
    timeout: 15000, // Longer timeout for worker requests
    retries: 2,
    auth: authToken ? { token: authToken } : undefined,
    headers: {
      'User-Agent': 'MCP-Memory-Client/1.0.0',
    },
  });
};

/**
 * Create client for internal Next.js API routes
 */
export const createInternalClient = (baseUrl: string = '/api'): ApiClient => {
  return createApiClient({
    baseUrl,
    timeout: 8000,
    retries: 1, // Less retries for internal APIs
  });
};