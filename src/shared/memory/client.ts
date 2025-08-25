import { Memory, Namespace, MemorySearchOptions, MemorySearchResult } from './types'
import { createDurableObjectMemoryClient } from '../api/memory-client'

/**
 * Legacy client for interacting with the MemoryStorage Durable Object
 * 
 * This class is now a wrapper around the new centralized MemoryApiClient
 * to maintain backward compatibility while consolidating HTTP logic.
 */
export class MemoryStorageClient {
  private durableObject: DurableObjectStub
  
  constructor(durableObject: DurableObjectStub, _userId?: string) {
    this.durableObject = durableObject
  }

  async storeMemory(params: {
    userId: string
    content: string
    namespace?: string
    labels?: string[]
  }): Promise<Memory> {
    // Create a client with the correct userId for this request
    const client = createDurableObjectMemoryClient(this.durableObject, params.userId)
    
    return client.storeMemory({
      content: params.content,
      ...(params.namespace && { namespace: params.namespace }),
      ...(params.labels && { labels: params.labels }),
    })
  }

  async searchMemories(userId: string, options: MemorySearchOptions): Promise<MemorySearchResult[]> {
    const client = createDurableObjectMemoryClient(this.durableObject, userId)
    
    return client.searchMemories({
      ...(options.query && { query: options.query }),
      ...(options.namespace && { namespace: options.namespace }),
      ...(options.labels && { labels: options.labels }),
      ...(options.limit && { limit: options.limit }),
      ...(options.similarityThreshold && { similarity_threshold: options.similarityThreshold }),
    })
  }

  async listMemories(userId: string, namespace?: string): Promise<Memory[]> {
    const client = createDurableObjectMemoryClient(this.durableObject, userId)
    
    return client.getMemories(namespace)
  }

  async deleteMemory(userId: string, memoryId: string): Promise<void> {
    const client = createDurableObjectMemoryClient(this.durableObject, userId)
    
    return client.deleteMemory(memoryId)
  }

  async createNamespace(params: {
    userId: string
    name: string
    description?: string
  }): Promise<Namespace> {
    const client = createDurableObjectMemoryClient(this.durableObject, params.userId)
    
    return client.createNamespace(params.name, params.description)
  }

  async listNamespaces(): Promise<Namespace[]> {
    // For this method we don't need userId, so we can use a dummy one
    const client = createDurableObjectMemoryClient(this.durableObject, 'system')
    return client.getNamespaces()
  }
}

// Factory function for creating storage clients
export const createMemoryStorageClient = (durableObject: DurableObjectStub, userId?: string): MemoryStorageClient => {
  return new MemoryStorageClient(durableObject, userId)
}