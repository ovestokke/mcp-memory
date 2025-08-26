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

// Create and export the single API client instance
const sharedClient = createWebUIMemoryClient()
export const memoryApi = new WebUIMemoryApiClient(sharedClient)

// Re-export types for convenience
export type { Memory, MemoryFormData }