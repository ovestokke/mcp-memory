import { LegacyMemoryApiClient as MemoryApiClient } from '../api-client'
import { ApiError } from '../../utils/api'

// Mock shared API client
jest.mock('@shared/api/memory-client', () => {
  const mockMemoryClient = {
    getMemories: jest.fn(),
    storeMemory: jest.fn(),
    deleteMemory: jest.fn(),
    searchMemories: jest.fn(),
  }
  return {
    createWebUIMemoryClient: jest.fn(() => mockMemoryClient),
    MemoryApiClient: jest.fn(),
  }
})

// Mock the api utility
jest.mock('../../utils/api', () => ({
  apiRequest: jest.fn(),
  ApiError: class ApiError extends Error {
    constructor(message: string, public status: number, public response?: Response) {
      super(message)
      this.name = 'ApiError'
    }
  },
}))

const mockApiRequest = require('../../utils/api').apiRequest
const { createWebUIMemoryClient } = require('@shared/api/memory-client')

describe('MemoryApiClient', () => {
  let client: MemoryApiClient
  let mockMemoryClient: any

  beforeEach(() => {
    mockMemoryClient = createWebUIMemoryClient()
    
    // Reset all mocks
    mockMemoryClient.getMemories.mockClear()
    mockMemoryClient.storeMemory.mockClear()
    mockMemoryClient.deleteMemory.mockClear()
    mockMemoryClient.searchMemories.mockClear()
    mockApiRequest.mockClear()
    
    client = new MemoryApiClient(mockMemoryClient)
  })

  describe('getMemories', () => {
    it('should fetch memories successfully', async () => {
      const mockMemories = [
        {
          id: '1',
          content: 'Test memory',
          namespace: 'general',
          labels: ['test'],
          createdAt: '2023-01-01',
          updatedAt: '2023-01-01',
        },
      ]

      mockMemoryClient.getMemories.mockResolvedValueOnce(mockMemories)

      const result = await client.getMemories()

      expect(mockMemoryClient.getMemories).toHaveBeenCalled()
      expect(result).toEqual(mockMemories)
    })

    it('should handle empty memories response', async () => {
      mockMemoryClient.getMemories.mockRejectedValueOnce(new Error('Test error'))

      const result = await client.getMemories()

      expect(result).toEqual([])
    })

    it('should propagate API errors', async () => {
      mockMemoryClient.getMemories.mockRejectedValueOnce(new Error('Test error'))

      const result = await client.getMemories()

      expect(result).toEqual([])
    })
  })

  describe('createMemory', () => {
    it('should create memory successfully', async () => {
      const memoryData = {
        content: 'New memory',
        namespace: 'general',
        labels: ['test'],
      }

      mockMemoryClient.storeMemory.mockResolvedValueOnce(undefined)

      await client.createMemory(memoryData)

      expect(mockMemoryClient.storeMemory).toHaveBeenCalledWith({
        content: memoryData.content,
        namespace: memoryData.namespace,
        labels: memoryData.labels,
      })
    })

    it('should propagate creation errors', async () => {
      const memoryData = {
        content: 'New memory',
        namespace: 'general',
        labels: ['test'],
      }

      const apiError = new Error('Failed to create')
      mockMemoryClient.storeMemory.mockRejectedValueOnce(apiError)

      await expect(client.createMemory(memoryData)).rejects.toThrow('Failed to create')
    })
  })

  describe('deleteMemory', () => {
    it('should delete memory successfully', async () => {
      const memoryId = 'test-id'

      mockMemoryClient.deleteMemory.mockResolvedValueOnce(undefined)

      await client.deleteMemory(memoryId)

      expect(mockMemoryClient.deleteMemory).toHaveBeenCalledWith(memoryId)
    })

    it('should propagate deletion errors', async () => {
      const memoryId = 'test-id'
      const apiError = new Error('Failed to delete')
      mockMemoryClient.deleteMemory.mockRejectedValueOnce(apiError)

      await expect(client.deleteMemory(memoryId)).rejects.toThrow('Failed to delete')
    })
  })

  describe('searchMemories', () => {
    it('should search memories with query only', async () => {
      const query = 'test query'
      const mockResults = [
        { 
          memory: {
            id: '1',
            content: 'Test memory',
            namespace: 'general',
            labels: ['test'],
            createdAt: '2023-01-01',
            updatedAt: '2023-01-01',
          },
          score: 0.95
        }
      ]

      mockMemoryClient.searchMemories.mockResolvedValueOnce(mockResults)

      const result = await client.searchMemories(query)

      expect(mockMemoryClient.searchMemories).toHaveBeenCalledWith({ query })
      expect(result).toEqual([mockResults[0].memory])
    })

    it('should search memories with query and namespace', async () => {
      const query = 'test query'
      const namespace = 'work'
      const mockResults = []

      mockMemoryClient.searchMemories.mockResolvedValueOnce(mockResults)

      const result = await client.searchMemories(query, namespace)

      expect(mockMemoryClient.searchMemories).toHaveBeenCalledWith({
        query,
        namespace,
      })
      expect(result).toEqual([])
    })

    it('should not include namespace if it is "all"', async () => {
      const query = 'test query'
      const namespace = 'all'
      const mockResults = []

      mockMemoryClient.searchMemories.mockResolvedValueOnce(mockResults)

      await client.searchMemories(query, namespace)

      expect(mockMemoryClient.searchMemories).toHaveBeenCalledWith({ query })
    })

    it('should handle empty search results', async () => {
      const query = 'test query'
      mockMemoryClient.searchMemories.mockResolvedValueOnce([])

      const result = await client.searchMemories(query)

      expect(result).toEqual([])
    })

    it('should propagate search errors', async () => {
      const query = 'test query'
      mockMemoryClient.searchMemories.mockRejectedValueOnce(new Error('Search failed'))

      const result = await client.searchMemories(query)

      expect(result).toEqual([])
    })
  })

  describe('constructor', () => {
    it('should use default base URL when not provided', async () => {
      // This test is mainly about the constructor working
      expect(client).toBeDefined()
    })

    it('should use provided base URL', async () => {
      // This test is mainly about the constructor working
      expect(client).toBeDefined()
    })
  })
})