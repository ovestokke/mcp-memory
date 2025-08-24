import { Memory, Namespace, MemorySearchOptions, MemorySearchResult } from '../types'

describe('Memory Types', () => {
  describe('Memory interface', () => {
    it('should define required Memory properties', () => {
      const memory: Memory = {
        id: 'test-id',
        userId: 'test-user',
        namespace: 'general',
        content: 'Test memory content',
        labels: ['test', 'memory'],
        embedding: [0.1, 0.2, 0.3],
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-02'),
      }

      expect(memory.id).toBe('test-id')
      expect(memory.userId).toBe('test-user')
      expect(memory.namespace).toBe('general')
      expect(memory.content).toBe('Test memory content')
      expect(memory.labels).toEqual(['test', 'memory'])
      expect(memory.embedding).toEqual([0.1, 0.2, 0.3])
      expect(memory.createdAt).toBeInstanceOf(Date)
      expect(memory.updatedAt).toBeInstanceOf(Date)
    })

    it('should allow empty labels array', () => {
      const memory: Memory = {
        id: 'test-id',
        userId: 'test-user',
        namespace: 'general',
        content: 'Test memory content',
        labels: [],
        embedding: [0.1, 0.2, 0.3],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      expect(memory.labels).toEqual([])
    })

    it('should handle null embedding', () => {
      const memory: Memory = {
        id: 'test-id',
        userId: 'test-user',
        namespace: 'general',
        content: 'Test memory content',
        labels: ['test'],
        embedding: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      expect(memory.embedding).toBeNull()
    })
  })

  describe('Namespace interface', () => {
    it('should define required Namespace properties', () => {
      const namespace: Namespace = {
        id: 'namespace-id',
        userId: 'test-user',
        name: 'work',
        description: 'Work-related memories',
        createdAt: new Date('2023-01-01'),
      }

      expect(namespace.id).toBe('namespace-id')
      expect(namespace.userId).toBe('test-user')
      expect(namespace.name).toBe('work')
      expect(namespace.description).toBe('Work-related memories')
      expect(namespace.createdAt).toBeInstanceOf(Date)
    })

    it('should allow optional description', () => {
      const namespace: Namespace = {
        id: 'namespace-id',
        userId: 'test-user',
        name: 'personal',
        createdAt: new Date(),
      }

      expect(namespace.description).toBeUndefined()
    })
  })

  describe('MemorySearchOptions interface', () => {
    it('should define optional search properties', () => {
      const searchOptions: MemorySearchOptions = {
        query: 'test query',
        namespace: 'general',
        labels: ['important'],
        limit: 20,
      }

      expect(searchOptions.query).toBe('test query')
      expect(searchOptions.namespace).toBe('general')
      expect(searchOptions.labels).toEqual(['important'])
      expect(searchOptions.limit).toBe(20)
    })

    it('should allow empty search options', () => {
      const searchOptions: MemorySearchOptions = {}

      expect(searchOptions.query).toBeUndefined()
      expect(searchOptions.namespace).toBeUndefined()
      expect(searchOptions.labels).toBeUndefined()
      expect(searchOptions.limit).toBeUndefined()
    })

    it('should allow partial search options', () => {
      const searchOptions1: MemorySearchOptions = { query: 'test' }
      const searchOptions2: MemorySearchOptions = { namespace: 'work' }
      const searchOptions3: MemorySearchOptions = { limit: 5 }

      expect(searchOptions1.query).toBe('test')
      expect(searchOptions2.namespace).toBe('work')
      expect(searchOptions3.limit).toBe(5)
    })
  })

  describe('MemorySearchResult interface', () => {
    it('should define search result with required memory', () => {
      const memory: Memory = {
        id: 'test-id',
        userId: 'test-user',
        namespace: 'general',
        content: 'Test memory',
        labels: ['test'],
        embedding: [0.1, 0.2],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const searchResult: MemorySearchResult = {
        memory,
        similarity: 0.85,
      }

      expect(searchResult.memory).toBe(memory)
      expect(searchResult.similarity).toBe(0.85)
    })

    it('should allow search result without similarity score', () => {
      const memory: Memory = {
        id: 'test-id',
        userId: 'test-user',
        namespace: 'general',
        content: 'Test memory',
        labels: ['test'],
        embedding: [0.1, 0.2],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const searchResult: MemorySearchResult = {
        memory,
      }

      expect(searchResult.memory).toBe(memory)
      expect(searchResult.similarity).toBeUndefined()
    })
  })

  describe('Type compatibility', () => {
    it('should allow Memory objects in MemorySearchResult', () => {
      const memory: Memory = {
        id: 'test-id',
        userId: 'test-user',
        namespace: 'general',
        content: 'Test content',
        labels: ['test'],
        embedding: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const searchResults: MemorySearchResult[] = [
        { memory, similarity: 0.9 },
        { memory: { ...memory, id: 'test-2' } },
      ]

      expect(searchResults).toHaveLength(2)
      expect(searchResults[0].similarity).toBe(0.9)
      expect(searchResults[1].similarity).toBeUndefined()
    })
  })
})