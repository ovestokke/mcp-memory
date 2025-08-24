import { MemoryApiClient } from '../api-client'
import { ApiError } from '../../utils/api'

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

describe('MemoryApiClient', () => {
  let client: MemoryApiClient

  beforeEach(() => {
    client = new MemoryApiClient('/api')
    mockApiRequest.mockClear()
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

      mockApiRequest.mockResolvedValueOnce(mockMemories)

      const result = await client.getMemories()

      expect(mockApiRequest).toHaveBeenCalledWith('/api/memories')
      expect(result).toEqual(mockMemories)
    })

    it('should handle empty memories response', async () => {
      mockApiRequest.mockResolvedValueOnce({})

      const result = await client.getMemories()

      expect(result).toEqual([])
    })

    it('should propagate API errors', async () => {
      const apiError = new ApiError('Failed to fetch', 500)
      mockApiRequest.mockRejectedValueOnce(apiError)

      await expect(client.getMemories()).rejects.toThrow('Failed to fetch')
    })
  })

  describe('createMemory', () => {
    it('should create memory successfully', async () => {
      const memoryData = {
        content: 'New memory',
        namespace: 'general',
        labels: ['new', 'test'],
      }

      mockApiRequest.mockResolvedValueOnce({})

      await client.createMemory(memoryData)

      expect(mockApiRequest).toHaveBeenCalledWith('/api/memories', {
        method: 'POST',
        body: JSON.stringify(memoryData),
      })
    })

    it('should propagate creation errors', async () => {
      const memoryData = {
        content: 'New memory',
        namespace: 'general',
        labels: ['new', 'test'],
      }

      const apiError = new ApiError('Creation failed', 400)
      mockApiRequest.mockRejectedValueOnce(apiError)

      await expect(client.createMemory(memoryData)).rejects.toThrow('Creation failed')
    })
  })

  describe('deleteMemory', () => {
    it('should delete memory successfully', async () => {
      const memoryId = 'test-id'

      mockApiRequest.mockResolvedValueOnce({})

      await client.deleteMemory(memoryId)

      expect(mockApiRequest).toHaveBeenCalledWith('/api/memories?id=test-id', {
        method: 'DELETE',
      })
    })

    it('should propagate deletion errors', async () => {
      const apiError = new ApiError('Not found', 404)
      mockApiRequest.mockRejectedValueOnce(apiError)

      await expect(client.deleteMemory('test-id')).rejects.toThrow('Not found')
    })
  })

  describe('searchMemories', () => {
    it('should search memories with query only', async () => {
      const mockResults = [
        {
          id: '1',
          content: 'Search result',
          namespace: 'general',
          labels: ['search'],
          createdAt: '2023-01-01',
          updatedAt: '2023-01-01',
        },
      ]

      mockApiRequest.mockResolvedValueOnce(mockResults)

      const result = await client.searchMemories('test query')

      expect(mockApiRequest).toHaveBeenCalledWith('/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'test query' }),
      })
      expect(result).toEqual(mockResults)
    })

    it('should search memories with query and namespace', async () => {
      const mockResults: any[] = []

      mockApiRequest.mockResolvedValueOnce(mockResults)

      const result = await client.searchMemories('test query', 'work')

      expect(mockApiRequest).toHaveBeenCalledWith('/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'test query', namespace: 'work' }),
      })
      expect(result).toEqual(mockResults)
    })

    it('should not include namespace if it is "all"', async () => {
      mockApiRequest.mockResolvedValueOnce({ results: [] })

      await client.searchMemories('test query', 'all')

      expect(mockApiRequest).toHaveBeenCalledWith('/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'test query' }),
      })
    })

    it('should handle empty search results', async () => {
      mockApiRequest.mockResolvedValueOnce({})

      const result = await client.searchMemories('test query')

      expect(result).toEqual([])
    })

    it('should propagate search errors', async () => {
      const apiError = new ApiError('Search failed', 500)
      mockApiRequest.mockRejectedValueOnce(apiError)

      await expect(client.searchMemories('test')).rejects.toThrow('Search failed')
    })
  })

  describe('constructor', () => {
    it('should use default base URL when not provided', () => {
      const defaultClient = new MemoryApiClient()

      // Access private baseUrl through any to test
      expect((defaultClient as any).baseUrl).toBe('/api')
    })

    it('should use provided base URL', () => {
      const customClient = new MemoryApiClient('/custom-api')

      // Access private baseUrl through any to test
      expect((customClient as any).baseUrl).toBe('/custom-api')
    })
  })
})
