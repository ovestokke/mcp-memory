import { MemoryStorage } from '../storage'
import { Memory, MemorySearchOptions } from '../types'
import { logger } from '../../utils/logger'

// Mock logger to avoid noise in tests
jest.mock('../../utils/logger', () => ({
  logger: {
    withContext: jest.fn().mockReturnThis(),
    time: jest.fn((label, fn) => fn()),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}))

// Mock VectorizeIndex
const mockVectorizeIndex = {
  insert: jest.fn(),
  query: jest.fn(),
  deleteByIds: jest.fn(),
}

// Mock DurableObjectState
const mockStorage = new Map()
const mockState = {
  storage: {
    get: jest.fn().mockImplementation((key) => mockStorage.get(key)),
    put: jest.fn().mockImplementation((key, value) => mockStorage.set(key, value)),
    delete: jest.fn().mockImplementation((key) => mockStorage.delete(key)),
    list: jest.fn().mockImplementation(({ prefix }) => {
      const entries = Array.from(mockStorage.entries()).filter(([key]) => key.startsWith(prefix))
      return new Map(entries)
    }),
  },
}

// Mock crypto.randomUUID
const mockUUID = 'test-uuid-123'
Object.defineProperty(global, 'crypto', {
  value: {
    ...global.crypto,
    randomUUID: jest.fn().mockReturnValue(mockUUID),
  },
  writable: true
})

describe('MemoryStorage', () => {
  let memoryStorage: MemoryStorage
  let mockRequest: Request
  let mockEnv: { VECTORIZE: any }

  beforeEach(() => {
    // Clear mocks and storage
    jest.clearAllMocks()
    mockStorage.clear()
    
    mockEnv = { VECTORIZE: mockVectorizeIndex }
    memoryStorage = new MemoryStorage(mockState as any, mockEnv)

    // Mock fetch with URL
    mockRequest = new Request('http://localhost:8787/api/memories', {
      headers: { 'x-user-id': 'test-user' }
    })
  })

  describe('storeMemory', () => {
    it('should store memory successfully', async () => {
      const memoryData = {
        userId: 'test-user',
        content: 'Test memory content',
        namespace: 'general',
        labels: ['test', 'memory'],
      }

      const result = await memoryStorage.storeMemory(memoryData)

      expect(result).toMatchObject({
        id: mockUUID,
        userId: 'test-user',
        content: 'Test memory content',
        namespace: 'general',
        labels: ['test', 'memory'],
        embedding: expect.any(Array),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      })

      // Verify storage operations
      expect(mockState.storage.put).toHaveBeenCalledWith(`memory:${mockUUID}`, result)
      expect(mockState.storage.put).toHaveBeenCalledWith('user:test-user:memories', [mockUUID])
    })

    it('should handle vector insertion failure gracefully', async () => {
      mockVectorizeIndex.insert.mockRejectedValueOnce(new Error('Vector insertion failed'))

      const memoryData = {
        userId: 'test-user',
        content: 'Test memory',
        namespace: 'general',
        labels: ['test'],
      }

      const result = await memoryStorage.storeMemory(memoryData)

      expect(result).toBeDefined()
      expect(logger.warn).toHaveBeenCalledWith('Vector storage failed (dev mode?)', expect.any(Object))
    })

    it('should update existing user memory list', async () => {
      // Setup existing memories
      const existingMemories = ['existing-memory-1', 'existing-memory-2']
      mockStorage.set('user:test-user:memories', existingMemories)

      const memoryData = {
        userId: 'test-user',
        content: 'New memory',
        namespace: 'general',
        labels: ['new'],
      }

      await memoryStorage.storeMemory(memoryData)

      // Check that the put method was called with the updated list
      const calls = mockState.storage.put.mock.calls.find(call => 
        call[0] === 'user:test-user:memories'
      )
      expect(calls).toBeDefined()
      // Check that it has 3 items (2 existing + 1 new)
      expect(calls[1]).toHaveLength(3)
      expect(calls[1]).toEqual(expect.arrayContaining([...existingMemories]))
      expect(calls[1]).toEqual(expect.arrayContaining([mockUUID]))
    })
  })

  describe('searchMemories', () => {
    const mockMemory: Memory = {
      id: 'memory-1',
      userId: 'test-user',
      namespace: 'general',
      content: 'Test memory content',
      labels: ['test'],
      embedding: new Array(768).fill(0.5),
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-01'),
    }

    beforeEach(() => {
      mockStorage.set('user:test-user:memories', ['memory-1'])
      mockStorage.set('memory:memory-1', mockMemory)
    })

    it('should perform vector search when query provided and vectorize available', async () => {
      mockVectorizeIndex.query.mockResolvedValueOnce({
        matches: [{ id: 'memory-1', score: 0.9 }],
      })

      const options: MemorySearchOptions = {
        query: 'test query',
        limit: 10,
      }

      const results = await memoryStorage.searchMemories('test-user', options)

      expect(mockVectorizeIndex.query).toHaveBeenCalledWith(
        expect.any(Array),
        {
          topK: 10,
          filter: { userId: 'test-user' },
        }
      )

      expect(results).toEqual([
        {
          memory: mockMemory,
          similarity: 0.9,
        },
      ])
    })

    it('should fall back to filter search when vector search fails', async () => {
      mockVectorizeIndex.query.mockRejectedValueOnce(new Error('Vector search failed'))

      const options: MemorySearchOptions = {
        query: 'test query',
        namespace: 'general',
        limit: 5,
      }

      const results = await memoryStorage.searchMemories('test-user', options)

      expect(results).toEqual([{ memory: mockMemory }])
      expect(logger.warn).toHaveBeenCalledWith('Vector search failed, falling back to filter search', expect.any(Object))
    })

    it('should filter by namespace', async () => {
      const workMemory: Memory = {
        ...mockMemory,
        id: 'memory-2',
        namespace: 'work',
      }

      mockStorage.set('user:test-user:memories', ['memory-1', 'memory-2'])
      mockStorage.set('memory:memory-2', workMemory)

      const options: MemorySearchOptions = {
        namespace: 'work',
        limit: 10,
      }

      const results = await memoryStorage.searchMemories('test-user', options)

      expect(results).toEqual([{ memory: workMemory }])
    })

    it('should filter by labels', async () => {
      const labeledMemory: Memory = {
        ...mockMemory,
        id: 'memory-2',
        labels: ['important', 'work'],
      }

      mockStorage.set('user:test-user:memories', ['memory-1', 'memory-2'])
      mockStorage.set('memory:memory-2', labeledMemory)

      const options: MemorySearchOptions = {
        labels: ['work'],
        limit: 10,
      }

      const results = await memoryStorage.searchMemories('test-user', options)

      expect(results).toEqual([{ memory: labeledMemory }])
    })

    it('should respect limit', async () => {
      const memory2: Memory = { ...mockMemory, id: 'memory-2' }
      const memory3: Memory = { ...mockMemory, id: 'memory-3' }

      mockStorage.set('user:test-user:memories', ['memory-1', 'memory-2', 'memory-3'])
      mockStorage.set('memory:memory-2', memory2)
      mockStorage.set('memory:memory-3', memory3)

      const options: MemorySearchOptions = { limit: 2 }

      const results = await memoryStorage.searchMemories('test-user', options)

      expect(results).toHaveLength(2)
    })
  })

  describe('listMemories', () => {
    it('should return all user memories', async () => {
      const memory1: Memory = {
        id: 'memory-1',
        userId: 'test-user',
        namespace: 'general',
        content: 'Memory 1',
        labels: ['test'],
        embedding: [],
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
      }

      const memory2: Memory = {
        id: 'memory-2',
        userId: 'test-user',
        namespace: 'work',
        content: 'Memory 2',
        labels: ['work'],
        embedding: [],
        createdAt: new Date('2023-01-02'),
        updatedAt: new Date('2023-01-02'),
      }

      mockStorage.set('user:test-user:memories', ['memory-1', 'memory-2'])
      mockStorage.set('memory:memory-1', memory1)
      mockStorage.set('memory:memory-2', memory2)

      const result = await memoryStorage.listMemories('test-user')

      expect(result).toEqual([memory2, memory1]) // Should be sorted by createdAt desc
    })

    it('should filter by namespace', async () => {
      const memory1: Memory = {
        id: 'memory-1',
        userId: 'test-user',
        namespace: 'general',
        content: 'Memory 1',
        labels: [],
        embedding: [],
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
      }

      const memory2: Memory = {
        id: 'memory-2',
        userId: 'test-user',
        namespace: 'work',
        content: 'Memory 2',
        labels: [],
        embedding: [],
        createdAt: new Date('2023-01-02'),
        updatedAt: new Date('2023-01-02'),
      }

      mockStorage.set('user:test-user:memories', ['memory-1', 'memory-2'])
      mockStorage.set('memory:memory-1', memory1)
      mockStorage.set('memory:memory-2', memory2)

      const result = await memoryStorage.listMemories('test-user', 'work')

      expect(result).toEqual([memory2])
    })

    it('should handle empty memory list', async () => {
      const result = await memoryStorage.listMemories('new-user')

      expect(result).toEqual([])
    })
  })

  describe('deleteMemory', () => {
    const mockMemory: Memory = {
      id: 'memory-1',
      userId: 'test-user',
      namespace: 'general',
      content: 'Test memory',
      labels: ['test'],
      embedding: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    beforeEach(() => {
      mockStorage.set('user:test-user:memories', ['memory-1', 'memory-2'])
      mockStorage.set('memory:memory-1', mockMemory)
    })

    it('should delete memory successfully', async () => {
      await memoryStorage.deleteMemory('test-user', 'memory-1')

      expect(mockState.storage.delete).toHaveBeenCalledWith('memory:memory-1')
      expect(mockVectorizeIndex.deleteByIds).toHaveBeenCalledWith(['memory-1'])
      expect(mockState.storage.put).toHaveBeenCalledWith('user:test-user:memories', ['memory-2'])
    })

    it('should handle vector deletion failure gracefully', async () => {
      mockVectorizeIndex.deleteByIds.mockRejectedValueOnce(new Error('Vector deletion failed'))

      await memoryStorage.deleteMemory('test-user', 'memory-1')

      expect(mockState.storage.delete).toHaveBeenCalledWith('memory:memory-1')
      expect(logger.warn).toHaveBeenCalledWith('Vector delete failed (dev mode?)', expect.any(Object))
    })

    it('should throw error if memory not found', async () => {
      mockStorage.delete('memory:memory-1')

      await expect(memoryStorage.deleteMemory('test-user', 'memory-1')).rejects.toThrow(
        'Memory not found or access denied'
      )
    })

    it('should throw error if user does not own memory', async () => {
      const otherUserMemory = { ...mockMemory, userId: 'other-user' }
      mockStorage.set('memory:memory-1', otherUserMemory)

      await expect(memoryStorage.deleteMemory('test-user', 'memory-1')).rejects.toThrow(
        'Memory not found or access denied'
      )
    })
  })

  describe('HTTP request handling', () => {
    it('should handle POST /api/memories', async () => {
      const request = new Request('http://localhost:8787/api/memories', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': 'test-user'
        },
        body: JSON.stringify({
          content: 'New memory',
          namespace: 'general',
          labels: ['test'],
        }),
      })

      const response = await memoryStorage.fetch(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.content).toBe('New memory')
      expect(data.userId).toBe('test-user')
    })

    it('should handle GET /api/memories with query params', async () => {
      // Setup test memory
      const mockMemory: Memory = {
        id: 'memory-1',
        userId: 'test-user',
        namespace: 'general',
        content: 'Test memory',
        labels: ['test'],
        embedding: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockStorage.set('user:test-user:memories', ['memory-1'])
      mockStorage.set('memory:memory-1', mockMemory)

      const request = new Request('http://localhost:8787/api/memories', {
        method: 'GET',
        headers: {
          'x-user-id': 'test-user'
        }
      })

      const response = await memoryStorage.fetch(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
      expect(data[0]).toMatchObject({
        id: 'memory-1',
        content: 'Test memory',
      })
    })

    it('should handle POST /api/search', async () => {
      const request = new Request('http://localhost:8787/api/search?userId=test-user&query=test', {
        method: 'POST',
      })

      const response = await memoryStorage.fetch(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
    })

    it('should handle DELETE /api/memories/{id}', async () => {
      // Setup test memory
      const mockMemory: Memory = {
        id: 'memory-1',
        userId: 'test-user',
        namespace: 'general',
        content: 'Test memory',
        labels: ['test'],
        embedding: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockStorage.set('user:test-user:memories', ['memory-1'])
      mockStorage.set('memory:memory-1', mockMemory)

      const request = new Request('http://localhost:8787/api/memories/memory-1', {
        method: 'DELETE',
        headers: { 'x-user-id': 'test-user' },
      })

      const response = await memoryStorage.fetch(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should return 404 for unknown routes', async () => {
      const request = new Request('http://localhost:8787/unknown', {
        method: 'GET',
      })

      const response = await memoryStorage.fetch(request)

      expect(response.status).toBe(404)
    })

    it('should handle errors gracefully', async () => {
      // Mock storage to throw error
      mockState.storage.get.mockImplementationOnce(() => {
        throw new Error('Storage error')
      })

      const request = new Request('http://localhost:8787/api/memories?userId=test-user', {
        method: 'GET',
      })

      const response = await memoryStorage.fetch(request)

      expect(response.status).toBe(500)
      expect(logger.error).toHaveBeenCalled()
    })
  })
})