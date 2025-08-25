// Centralized API client for memory operations using the new shared client
import { createWebUIMemoryClient, MemoryApiClient } from '@shared/api/memory-client'
import type { Memory, MemorySearchResult } from '@shared/memory/types'
import type { MemoryFormData } from '../types/memory'

// Create the default memory API client instance
export const memoryApi = createWebUIMemoryClient()

// Legacy wrapper for backward compatibility
export class LegacyMemoryApiClient {
  constructor(private client: MemoryApiClient) {}

  async getMemories(): Promise<Memory[]> {
    try {
      return await this.client.getMemories()
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
      
      // Extract just the memory objects from search results
      return results.map(result => result.memory)
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