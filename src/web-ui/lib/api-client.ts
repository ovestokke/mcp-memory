// Centralized API client for memory operations
import { Memory, MemoryFormData } from '../types/memory'
import { apiRequest } from '../utils/api'

export interface ApiMemoryResponse {
  memories: Memory[]
}

export interface ApiSearchResponse {
  results: Memory[]
}

export class MemoryApiClient {
  private baseUrl: string

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl
  }

  async getMemories(): Promise<Memory[]> {
    const response = await apiRequest<Memory[]>(`${this.baseUrl}/memories`)
    return Array.isArray(response) ? response : []
  }

  async createMemory(data: MemoryFormData): Promise<void> {
    await apiRequest(`${this.baseUrl}/memories`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async deleteMemory(memoryId: string): Promise<void> {
    await apiRequest(`${this.baseUrl}/memories?id=${memoryId}`, {
      method: 'DELETE'
    })
  }

  async searchMemories(query: string, namespace?: string): Promise<Memory[]> {
    const searchData = { 
      query,
      ...(namespace && namespace !== 'all' ? { namespace } : {})
    }
    
    const response = await apiRequest<Memory[]>(`${this.baseUrl}/search`, {
      method: 'POST',
      body: JSON.stringify(searchData)
    })
    
    return Array.isArray(response) ? response : []
  }
}

// Default client instance
export const memoryApi = new MemoryApiClient()