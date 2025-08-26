// Clean API client for memory operations
import { createWebUIMemoryClient, MemoryApiClient } from '@shared/api/memory-client'
import type { Memory as SharedMemory } from '@shared/memory/types'
import type { Memory, MemoryFormData } from '../types/memory'

// Convert shared Memory (with Date fields) to web UI Memory (with string fields)
function convertMemoryForUI(sharedMemory: SharedMemory): Memory {
  return {
    id: sharedMemory.id,
    content: sharedMemory.content,
    namespace: sharedMemory.namespace,
    labels: sharedMemory.labels,
    createdAt: sharedMemory.createdAt.toISOString(),
    updatedAt: sharedMemory.updatedAt.toISOString(),
  }
}

// Web UI Memory API Client with proper return types
class WebUIMemoryApiClient {
  constructor(private client: MemoryApiClient) {}

  async getMemories(): Promise<Memory[]> {
    const memories = await this.client.getMemories()
    return memories.map(convertMemoryForUI)
  }

  async createMemory(data: MemoryFormData): Promise<void> {
    await this.client.storeMemory({
      content: data.content,
      namespace: data.namespace,
      labels: data.labels,
    })
  }

  async deleteMemory(memoryId: string): Promise<void> {
    await this.client.deleteMemory(memoryId)
  }

  async searchMemories(query: string, namespace?: string): Promise<Memory[]> {
    const results = await this.client.searchMemories({
      query,
      ...(namespace && namespace !== 'all' ? { namespace } : {}),
    })
    
    // Extract memory objects and convert dates for UI
    return results.map(result => convertMemoryForUI(result.memory))
  }
}

// Create API client instance factory
function createMemoryApiClient(onAuthError?: () => void): WebUIMemoryApiClient {
  const sharedClient = createWebUIMemoryClient(onAuthError)
  return new WebUIMemoryApiClient(sharedClient)
}

// Default client instance (will be recreated with auth handler)
export let memoryApi = createMemoryApiClient()

// Function to set the auth error handler and recreate the client
export function setAuthErrorHandler(onAuthError: () => void): void {
  memoryApi = createMemoryApiClient(onAuthError)
}

// Re-export types for convenience
export type { Memory, MemoryFormData }