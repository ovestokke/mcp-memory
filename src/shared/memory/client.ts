import { Memory, Namespace, MemorySearchOptions, MemorySearchResult } from './types'

/**
 * Client for interacting with the MemoryStorage Durable Object
 */
export class MemoryStorageClient {
  private durableObject: DurableObjectStub
  
  constructor(durableObject: DurableObjectStub) {
    this.durableObject = durableObject
  }

  async storeMemory(params: {
    userId: string
    content: string
    namespace?: string
    labels?: string[]
  }): Promise<Memory> {
    const response = await this.durableObject.fetch('http://localhost/api/memories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': params.userId,
      },
      body: JSON.stringify({
        content: params.content,
        namespace: params.namespace || 'general',
        labels: params.labels || [],
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to store memory: ${error}`)
    }

    return response.json()
  }

  async searchMemories(userId: string, options: MemorySearchOptions): Promise<MemorySearchResult[]> {
    const searchParams = new URLSearchParams()
    
    if (options.query) searchParams.set('query', options.query)
    if (options.namespace) searchParams.set('namespace', options.namespace)
    if (options.labels) searchParams.set('labels', options.labels.join(','))
    if (options.limit) searchParams.set('limit', options.limit.toString())
    if (options.similarityThreshold) searchParams.set('similarity_threshold', options.similarityThreshold.toString())

    const response = await this.durableObject.fetch(`http://localhost/api/search?${searchParams}`, {
      method: 'POST',
      headers: {
        'x-user-id': userId,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to search memories: ${error}`)
    }

    return response.json()
  }

  async listMemories(userId: string, namespace?: string): Promise<Memory[]> {
    const searchParams = new URLSearchParams()
    if (namespace) searchParams.set('namespace', namespace)

    const response = await this.durableObject.fetch(`http://localhost/api/memories?${searchParams}`, {
      method: 'GET',
      headers: {
        'x-user-id': userId,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to list memories: ${error}`)
    }

    return response.json()
  }

  async deleteMemory(userId: string, memoryId: string): Promise<void> {
    const response = await this.durableObject.fetch(`http://localhost/api/memories/${memoryId}`, {
      method: 'DELETE',
      headers: {
        'x-user-id': userId,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to delete memory: ${error}`)
    }
  }

  async createNamespace(params: {
    userId: string
    name: string
    description?: string
  }): Promise<Namespace> {
    const response = await this.durableObject.fetch('http://localhost/api/namespaces', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': params.userId,
      },
      body: JSON.stringify({
        name: params.name,
        description: params.description,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to create namespace: ${error}`)
    }

    return response.json()
  }

  async listNamespaces(): Promise<Namespace[]> {
    const response = await this.durableObject.fetch('http://localhost/api/namespaces', {
      method: 'GET',
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to list namespaces: ${error}`)
    }

    return response.json()
  }
}