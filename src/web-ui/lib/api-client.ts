// Centralized API client for memory operations using the new shared client
import { createWebUIMemoryClient, MemoryApiClient } from '@shared/api/memory-client'
import type { Memory as SharedMemory, MemorySearchResult } from '@shared/memory/types'
import type { Memory, MemoryFormData } from '../types/memory'

// Create the default memory API client instance
export const memoryApi = createWebUIMemoryClient()

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

// Legacy wrapper for backward compatibility
export class LegacyMemoryApiClient {
  constructor(private client: MemoryApiClient) {}

  async getMemories(): Promise<Memory[]> {
    try {
      const memories = await this.client.getMemories()
      return memories.map(convertMemoryForUI)
    } catch (error) {
      console.error('Failed to get memories:', error)
      return []
    }
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
    try {
      const results: MemorySearchResult[] = await this.client.searchMemories({
        query,
        ...(namespace && namespace !== 'all' ? { namespace } : {}),
      })
      
      // Extract memory objects and convert dates for UI
      return results.map(result => convertMemoryForUI(result.memory))
    } catch (error) {
      console.error('Failed to search memories:', error)
      return []
    }
  }
}

// Export both the new client and legacy wrapper
export { memoryApi as newMemoryApi }
export const legacyMemoryApi = new LegacyMemoryApiClient(memoryApi)

// For backward compatibility, export the legacy client as the default
export default legacyMemoryApi

// Re-export types for convenience
export type { Memory, MemoryFormData }