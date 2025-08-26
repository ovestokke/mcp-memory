import { ApiClient } from './client';
import type { Memory, MemorySearchResult, Namespace } from '../memory/types';

export interface MemoryFormData {
  content: string;
  namespace?: string | undefined;
  labels?: string[] | undefined;
}

export interface SearchRequest {
  query?: string | undefined;
  namespace?: string | undefined;
  labels?: string[] | undefined;
  limit?: number | undefined;
  similarity_threshold?: number | undefined;
}

/**
 * Type-safe Memory API client
 * 
 * This replaces all the fragmented API client implementations:
 * - MemoryApiClient (web-ui)
 * - MemoryStorageClient (shared)
 * - AuthenticatedWorkerClient (web-ui)
 * - Raw fetch calls throughout the codebase
 */
export class MemoryApiClient {
  constructor(private api: ApiClient) {}

  /**
   * Store a new memory
   */
  async storeMemory(data: MemoryFormData): Promise<Memory> {
    const rawMemory = await this.api.post<any>('memories', {
      content: data.content,
      namespace: data.namespace || 'general',
      labels: data.labels || [],
    });
    return this.deserializeMemory(rawMemory);
  }

  /**
   * Get all memories, optionally filtered by namespace
   */
  async getMemories(namespace?: string): Promise<Memory[]> {
    const searchParams = namespace ? { namespace } : undefined;
    const rawMemories = await this.api.get<any[]>('memories', searchParams);
    return rawMemories.map(memory => this.deserializeMemory(memory));
  }

  /**
   * Search memories with semantic similarity or filters
   */
  async searchMemories(request: SearchRequest): Promise<MemorySearchResult[]> {
    const rawResults = await this.api.post<any[]>('search', request);
    return rawResults.map(result => ({
      ...result,
      memory: this.deserializeMemory(result.memory)
    }));
  }

  /**
   * Delete a memory by ID
   */
  async deleteMemory(memoryId: string): Promise<void> {
    await this.api.delete(`memories/${memoryId}`);
  }

  /**
   * Create a new namespace
   */
  async createNamespace(name: string, description?: string | undefined): Promise<Namespace> {
    return this.api.post<Namespace>('namespaces', {
      name,
      ...(description && { description }),
    });
  }

  /**
   * Get all namespaces
   */
  async getNamespaces(): Promise<Namespace[]> {
    return this.api.get<Namespace[]>('namespaces');
  }

  /**
   * Get a specific memory by ID
   */
  async getMemory(memoryId: string): Promise<Memory> {
    const rawMemory = await this.api.get<any>(`memories/${memoryId}`);
    return this.deserializeMemory(rawMemory);
  }

  /**
   * Update a memory
   */
  async updateMemory(memoryId: string, data: Partial<MemoryFormData>): Promise<Memory> {
    const rawMemory = await this.api.patch<any>(`memories/${memoryId}`, data);
    return this.deserializeMemory(rawMemory);
  }

  /**
   * Get namespace statistics
   */
  async getNamespaceStats(namespace?: string): Promise<{
    totalMemories: number;
    namespace?: string;
    labels: string[];
  }> {
    const searchParams = namespace ? { namespace } : undefined;
    return this.api.get('memories/stats', searchParams);
  }

  /**
   * Deserialize a memory object, converting string dates back to Date objects
   */
  private deserializeMemory(rawMemory: any): Memory {
    return {
      ...rawMemory,
      createdAt: typeof rawMemory.createdAt === 'string' ? new Date(rawMemory.createdAt) : rawMemory.createdAt,
      updatedAt: typeof rawMemory.updatedAt === 'string' ? new Date(rawMemory.updatedAt) : rawMemory.updatedAt,
    };
  }
}

/**
 * Factory functions for different client configurations
 */

/**
 * Create memory client for Durable Object communication
 */
export const createDurableObjectMemoryClient = (durableObject: DurableObjectStub, userId: string): MemoryApiClient => {
  // Create a specialized client that wraps durable object fetch
  class DurableObjectApiClient extends ApiClient {
    constructor(private durableObjectStub: DurableObjectStub, private userId: string) {
      super({
        baseUrl: 'http://localhost/api',
        headers: { 'x-user-id': userId },
        timeout: 30000,
      });
    }

    async get<T>(url: string, searchParams?: Record<string, string | number | boolean>): Promise<T> {
      const queryString = searchParams ? '?' + new URLSearchParams(
        Object.entries(searchParams).map(([k, v]) => [k, String(v)])
      ).toString() : '';
      
      const response = await this.durableObjectStub.fetch(`http://localhost/api/${url}${queryString}`, {
        method: 'GET',
        headers: { 'x-user-id': this.userId },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to GET ${url}: ${error}`);
      }

      return response.json();
    }

    async post<T>(url: string, body?: unknown): Promise<T> {
      const response = await this.durableObjectStub.fetch(`http://localhost/api/${url}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': this.userId,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to POST ${url}: ${error}`);
      }

      return response.json();
    }

    async delete(url: string): Promise<void> {
      const response = await this.durableObjectStub.fetch(`http://localhost/api/${url}`, {
        method: 'DELETE',
        headers: { 'x-user-id': this.userId },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to DELETE ${url}: ${error}`);
      }
    }

    async patch<T>(url: string, body?: unknown): Promise<T> {
      const response = await this.durableObjectStub.fetch(`http://localhost/api/${url}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': this.userId,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to PATCH ${url}: ${error}`);
      }

      return response.json();
    }

    // Store reference to durable object for legacy compatibility
    get durableObject() {
      return this.durableObjectStub;
    }
  }

  const apiClient = new DurableObjectApiClient(durableObject, userId);
  return new MemoryApiClient(apiClient);
};

/**
 * Create memory client for web UI (via Next.js API routes)
 */
export const createWebUIMemoryClient = (onAuthError?: () => void): MemoryApiClient => {
  const apiClient = new ApiClient({
    baseUrl: '/api',
    timeout: 10000,
    retries: 2,
    onAuthError,
  });

  return new MemoryApiClient(apiClient);
};

/**
 * Create memory client for direct worker communication
 */
export const createWorkerMemoryClient = (workerUrl: string, authToken: string): MemoryApiClient => {
  const apiClient = new ApiClient({
    baseUrl: workerUrl,
    timeout: 15000,
    retries: 2,
    auth: { token: authToken },
    headers: {
      'User-Agent': 'MCP-Memory-WebUI/1.0.0',
    },
  });

  return new MemoryApiClient(apiClient);
};