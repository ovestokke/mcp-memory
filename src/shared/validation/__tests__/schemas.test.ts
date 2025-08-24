import { z } from 'zod'
import {
  MemorySchema,
  NamespaceSchema,
  MemorySearchSchema,
  CreateMemoryRequest,
  CreateNamespaceRequest,
  SearchMemoryRequest,
} from '../schemas'

describe('Validation Schemas', () => {
  describe('MemorySchema', () => {
    it('should validate valid memory data', () => {
      const validMemory = {
        namespace: 'general',
        content: 'This is a valid memory content',
        labels: ['important', 'work'],
      }

      const result = MemorySchema.parse(validMemory)

      expect(result).toEqual(validMemory)
    })

    it('should provide default empty array for labels', () => {
      const memoryWithoutLabels = {
        namespace: 'general',
        content: 'Memory without labels',
      }

      const result = MemorySchema.parse(memoryWithoutLabels)

      expect(result.labels).toEqual([])
    })

    it('should reject memory with empty namespace', () => {
      const invalidMemory = {
        namespace: '',
        content: 'Valid content',
        labels: ['test'],
      }

      expect(() => MemorySchema.parse(invalidMemory)).toThrow()
    })

    it('should reject memory with empty content', () => {
      const invalidMemory = {
        namespace: 'general',
        content: '',
        labels: ['test'],
      }

      expect(() => MemorySchema.parse(invalidMemory)).toThrow()
    })

    it('should reject namespace longer than 100 characters', () => {
      const invalidMemory = {
        namespace: 'a'.repeat(101),
        content: 'Valid content',
        labels: [],
      }

      expect(() => MemorySchema.parse(invalidMemory)).toThrow()
    })

    it('should reject content longer than max length', () => {
      // Assuming MAX_MEMORY_LENGTH is 10000 based on typical values
      const invalidMemory = {
        namespace: 'general',
        content: 'a'.repeat(10001),
        labels: [],
      }

      expect(() => MemorySchema.parse(invalidMemory)).toThrow()
    })

    it('should reject labels that are too long', () => {
      // Assuming MAX_LABEL_LENGTH is 50 based on typical values
      const invalidMemory = {
        namespace: 'general',
        content: 'Valid content',
        labels: ['a'.repeat(51)],
      }

      expect(() => MemorySchema.parse(invalidMemory)).toThrow()
    })

    it('should reject too many labels', () => {
      // Assuming MAX_LABELS_PER_MEMORY is 20 based on typical values
      const invalidMemory = {
        namespace: 'general',
        content: 'Valid content',
        labels: Array.from({ length: 21 }, (_, i) => `label${i}`),
      }

      expect(() => MemorySchema.parse(invalidMemory)).toThrow()
    })

    it('should accept valid labels array', () => {
      const validMemory = {
        namespace: 'general',
        content: 'Valid content',
        labels: ['tag1', 'tag2', 'important'],
      }

      const result = MemorySchema.parse(validMemory)

      expect(result.labels).toEqual(['tag1', 'tag2', 'important'])
    })
  })

  describe('NamespaceSchema', () => {
    it('should validate valid namespace data', () => {
      const validNamespace = {
        name: 'work',
        description: 'Work-related memories and notes',
      }

      const result = NamespaceSchema.parse(validNamespace)

      expect(result).toEqual(validNamespace)
    })

    it('should validate namespace without description', () => {
      const validNamespace = {
        name: 'personal',
      }

      const result = NamespaceSchema.parse(validNamespace)

      expect(result.name).toBe('personal')
      expect(result.description).toBeUndefined()
    })

    it('should reject namespace with empty name', () => {
      const invalidNamespace = {
        name: '',
        description: 'Valid description',
      }

      expect(() => NamespaceSchema.parse(invalidNamespace)).toThrow()
    })

    it('should reject namespace name longer than 100 characters', () => {
      const invalidNamespace = {
        name: 'a'.repeat(101),
        description: 'Valid description',
      }

      expect(() => NamespaceSchema.parse(invalidNamespace)).toThrow()
    })

    it('should reject description longer than 500 characters', () => {
      const invalidNamespace = {
        name: 'valid-name',
        description: 'a'.repeat(501),
      }

      expect(() => NamespaceSchema.parse(invalidNamespace)).toThrow()
    })

    it('should accept description exactly at 500 characters', () => {
      const validNamespace = {
        name: 'valid-name',
        description: 'a'.repeat(500),
      }

      const result = NamespaceSchema.parse(validNamespace)

      expect(result.description).toBe('a'.repeat(500))
    })
  })

  describe('MemorySearchSchema', () => {
    it('should validate minimal search request', () => {
      const searchRequest = {}

      const result = MemorySearchSchema.parse(searchRequest)

      expect(result.limit).toBe(20) // default
      expect(result.similarityThreshold).toBe(0.7) // default
      expect(result.namespace).toBeUndefined()
      expect(result.labels).toBeUndefined()
      expect(result.query).toBeUndefined()
    })

    it('should validate complete search request', () => {
      const searchRequest = {
        namespace: 'work',
        labels: ['important', 'urgent'],
        query: 'project deadline',
        limit: 10,
        similarityThreshold: 0.8,
      }

      const result = MemorySearchSchema.parse(searchRequest)

      expect(result).toEqual(searchRequest)
    })

    it('should apply default values for limit and similarityThreshold', () => {
      const searchRequest = {
        query: 'test search',
      }

      const result = MemorySearchSchema.parse(searchRequest)

      expect(result.limit).toBe(20)
      expect(result.similarityThreshold).toBe(0.7)
      expect(result.query).toBe('test search')
    })

    it('should reject limit less than 1', () => {
      const invalidSearch = {
        limit: 0,
      }

      expect(() => MemorySearchSchema.parse(invalidSearch)).toThrow()
    })

    it('should reject limit greater than 100', () => {
      const invalidSearch = {
        limit: 101,
      }

      expect(() => MemorySearchSchema.parse(invalidSearch)).toThrow()
    })

    it('should reject similarityThreshold less than 0', () => {
      const invalidSearch = {
        similarityThreshold: -0.1,
      }

      expect(() => MemorySearchSchema.parse(invalidSearch)).toThrow()
    })

    it('should reject similarityThreshold greater than 1', () => {
      const invalidSearch = {
        similarityThreshold: 1.1,
      }

      expect(() => MemorySearchSchema.parse(invalidSearch)).toThrow()
    })

    it('should accept boundary values', () => {
      const boundarySearch1 = {
        limit: 1,
        similarityThreshold: 0,
      }

      const boundarySearch2 = {
        limit: 100,
        similarityThreshold: 1,
      }

      expect(() => MemorySearchSchema.parse(boundarySearch1)).not.toThrow()
      expect(() => MemorySearchSchema.parse(boundarySearch2)).not.toThrow()
    })

    it('should handle empty labels array', () => {
      const searchRequest = {
        labels: [],
      }

      const result = MemorySearchSchema.parse(searchRequest)

      expect(result.labels).toEqual([])
    })

    it('should handle empty query string', () => {
      const searchRequest = {
        query: '',
      }

      const result = MemorySearchSchema.parse(searchRequest)

      expect(result.query).toBe('')
    })
  })

  describe('Type exports', () => {
    it('should export correct TypeScript types', () => {
      // Test that the exported types can be used
      const memoryRequest: CreateMemoryRequest = {
        namespace: 'general',
        content: 'Test content',
        labels: ['test'],
      }

      const namespaceRequest: CreateNamespaceRequest = {
        name: 'work',
        description: 'Work namespace',
      }

      const searchRequest: SearchMemoryRequest = {
        query: 'test',
        limit: 10,
        similarityThreshold: 0.8,
      }

      expect(memoryRequest.namespace).toBe('general')
      expect(namespaceRequest.name).toBe('work')
      expect(searchRequest.query).toBe('test')
    })
  })

  describe('Schema composition', () => {
    it('should work with schema transformations', () => {
      const transformedSchema = MemorySchema.transform((data) => ({
        ...data,
        processed: true,
      }))

      const result = transformedSchema.parse({
        namespace: 'general',
        content: 'Test content',
      })

      expect(result.processed).toBe(true)
      expect(result.labels).toEqual([]) // default should still apply
    })

    it('should work with partial schemas', () => {
      const partialMemorySchema = MemorySchema.partial()

      const result = partialMemorySchema.parse({
        namespace: 'general',
        // content is now optional
      })

      expect(result.namespace).toBe('general')
      expect(result.content).toBeUndefined()
    })

    it('should work with required schemas', () => {
      const requiredSearchSchema = MemorySearchSchema.required()

      // This should fail because not all fields are provided
      expect(() => requiredSearchSchema.parse({})).toThrow()
    })
  })
})