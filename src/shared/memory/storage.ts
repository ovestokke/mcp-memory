import { Memory, Namespace, MemorySearchOptions, MemorySearchResult } from './types'
import { VECTOR_DIMENSIONS } from './constants'
import { logger } from '../utils/logger'

export class MemoryStorage {
  private state: DurableObjectState
  private env: {
    VECTORIZE: VectorizeIndex
  }

  constructor(state: DurableObjectState, env: { VECTORIZE: VectorizeIndex }) {
    this.state = state
    this.env = env
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const method = request.method
    const userId = request.headers.get('x-user-id') || 'demo-user'

    try {
      // Handle API routes
      if (url.pathname.startsWith('/api/')) {
        const apiPath = url.pathname.replace('/api', '')
        switch (`${method} ${apiPath}`) {
          case 'POST /memories':
            return await this.handleStoreMemory(request)
          case 'GET /memories':
            return await this.handleListMemories(request)
          case 'POST /search':
            return await this.handleSearchMemories(request)
          default:
            // Check for DELETE /api/memories/{id}
            const deleteMatch = apiPath.match(/^\/memories\/([^\/]+)$/)
            if (method === 'DELETE' && deleteMatch && deleteMatch[1]) {
              return await this.handleDeleteMemoryById(deleteMatch[1], userId)
            }
            return new Response('Not Found', { status: 404 })
        }
      }

      // Handle direct routes (for MCP)
      switch (`${method} ${url.pathname}`) {
        case 'POST /memories':
          return await this.handleStoreMemory(request)
        case 'GET /memories/search':
          return await this.handleSearchMemories(request)
        case 'GET /memories':
          return await this.handleListMemories(request)
        case 'DELETE /memories':
          return await this.handleDeleteMemory(request)
        case 'POST /namespaces':
          return await this.handleCreateNamespace(request)
        case 'GET /namespaces':
          return await this.handleListNamespaces()
        default:
          return new Response('Not Found', { status: 404 })
      }
    } catch (error) {
      logger.error('Storage operation failed', {
        error: error as Error,
        method,
        path: url.pathname,
        userId,
      })
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  private async handleStoreMemory(request: Request): Promise<Response> {
    const data = (await request.json()) as {
      userId: string
      content: string
      namespace: string
      labels: string[]
    }

    const memory = await this.storeMemory(data)
    return new Response(JSON.stringify(memory), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  private async handleSearchMemories(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')!
    const query = url.searchParams.get('query') || undefined
    const namespace = url.searchParams.get('namespace') || undefined
    const labels = url.searchParams.get('labels')?.split(',') || undefined
    const limit = parseInt(url.searchParams.get('limit') || '10')

    const searchOptions: MemorySearchOptions = { limit }
    if (query) searchOptions.query = query
    if (namespace) searchOptions.namespace = namespace
    if (labels) searchOptions.labels = labels

    const results = await this.searchMemories(userId, searchOptions)

    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  private async handleListMemories(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')!
    const namespace = url.searchParams.get('namespace') || undefined

    const memories = await this.listMemories(userId, namespace)
    return new Response(JSON.stringify(memories), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  private async handleDeleteMemory(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')!
    const memoryId = url.searchParams.get('id')!

    await this.deleteMemory(userId, memoryId)
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  private async handleDeleteMemoryById(memoryId: string, userId: string = 'demo-user'): Promise<Response> {
    await this.deleteMemory(userId, memoryId)
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  private async handleCreateNamespace(request: Request): Promise<Response> {
    const data = (await request.json()) as {
      userId: string
      name: string
      description?: string
    }

    const namespace = await this.createNamespace(data)
    return new Response(JSON.stringify(namespace), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  private async handleListNamespaces(): Promise<Response> {
    const namespaces = await this.listNamespaces()
    return new Response(JSON.stringify(namespaces), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  async storeMemory(data: {
    userId: string
    content: string
    namespace: string
    labels: string[]
  }): Promise<Memory> {
    const requestLogger = logger.withContext({
      userId: data.userId,
      namespace: data.namespace,
      operation: 'storeMemory',
    })

    return requestLogger.time('store memory', async () => {
      const memoryId = crypto.randomUUID()
      const now = new Date()

      // Generate embedding using Workers AI or external service
      // For now, we'll create a placeholder embedding
      const embedding = await this.generateEmbedding(data.content)

      const memory: Memory = {
        id: memoryId,
        userId: data.userId,
        namespace: data.namespace,
        content: data.content,
        labels: data.labels,
        embedding,
        createdAt: now,
        updatedAt: now,
      }

      // Store in Durable Object state
      await this.state.storage.put(`memory:${memoryId}`, memory)

      // Store in vector index (skip if not available in dev)
      if (embedding && this.env.VECTORIZE) {
        try {
          await this.env.VECTORIZE.insert([
            {
              id: memoryId,
              values: embedding,
              metadata: {
                userId: data.userId,
                namespace: data.namespace,
                labels: data.labels.join(','),
                content: data.content.substring(0, 500),
              },
            },
          ])
        } catch (error) {
          requestLogger.warn('Vector storage failed (dev mode?)', {
            error: error instanceof Error ? error : String(error),
          })
        }
      }

      // Update user's memory list
      const userMemories = ((await this.state.storage.get(`user:${data.userId}:memories`)) as string[]) || []
      userMemories.push(memoryId)
      await this.state.storage.put(`user:${data.userId}:memories`, userMemories)

      return memory
    })
  }

  async searchMemories(userId: string, options: MemorySearchOptions): Promise<MemorySearchResult[]> {
    if (options.query && this.env.VECTORIZE) {
      // Vector similarity search
      const queryEmbedding = await this.generateEmbedding(options.query)
      if (!queryEmbedding) {
        return []
      }

      try {
        const vectorResults = await this.env.VECTORIZE.query(queryEmbedding, {
          topK: options.limit || 10,
          filter: {
            userId: userId,
            ...(options.namespace && { namespace: options.namespace }),
          },
        })

        const results: MemorySearchResult[] = []
        for (const match of vectorResults.matches) {
          const memory = await this.state.storage.get(`memory:${match.id}`)
          if (memory) {
            results.push({
              memory: memory as Memory,
              similarity: match.score,
            })
          }
        }

        return results
      } catch (error) {
        logger.warn('Vector search failed, falling back to filter search', {
          error: error instanceof Error ? error : String(error),
          userId,
          query: options.query,
        })
        // Fall through to filter-based search
      }
    }

    // Filter-based search (fallback or when no query)
    const userMemories = ((await this.state.storage.get(`user:${userId}:memories`)) as string[]) || []
    const results: MemorySearchResult[] = []

    for (const memoryId of userMemories) {
      const memory = (await this.state.storage.get(`memory:${memoryId}`)) as Memory
      if (!memory) continue

      // Apply filters
      if (options.namespace && memory.namespace !== options.namespace) continue
      if (options.labels && !options.labels.some((label) => memory.labels.includes(label))) continue

      results.push({ memory })

      if (results.length >= (options.limit || 10)) break
    }

    return results
  }

  async listMemories(userId: string, namespace?: string): Promise<Memory[]> {
    const userMemories = ((await this.state.storage.get(`user:${userId}:memories`)) as string[]) || []
    const results: Memory[] = []

    for (const memoryId of userMemories) {
      const memory = (await this.state.storage.get(`memory:${memoryId}`)) as Memory
      if (!memory) continue

      if (namespace && memory.namespace !== namespace) continue
      results.push(memory)
    }

    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  async deleteMemory(userId: string, memoryId: string): Promise<void> {
    const memory = (await this.state.storage.get(`memory:${memoryId}`)) as Memory
    if (!memory || memory.userId !== userId) {
      throw new Error('Memory not found or access denied')
    }

    // Remove from vector index (skip if not available)
    if (this.env.VECTORIZE) {
      try {
        await this.env.VECTORIZE.deleteByIds([memoryId])
      } catch (error) {
        logger.warn('Vector delete failed (dev mode?)', {
          error: error instanceof Error ? error : String(error),
          userId,
          memoryId,
        })
      }
    }

    // Remove from storage
    await this.state.storage.delete(`memory:${memoryId}`)

    // Update user's memory list
    const userMemories = ((await this.state.storage.get(`user:${userId}:memories`)) as string[]) || []
    const updatedMemories = userMemories.filter((id: string) => id !== memoryId)
    await this.state.storage.put(`user:${userId}:memories`, updatedMemories)
  }

  async createNamespace(data: { userId: string; name: string; description?: string }): Promise<Namespace> {
    const namespaceId = crypto.randomUUID()
    const now = new Date()

    const namespace: Namespace = {
      id: namespaceId,
      userId: data.userId,
      name: data.name,
      description: data.description,
      createdAt: now,
    }

    await this.state.storage.put(`namespace:${namespaceId}`, namespace)

    // Update user's namespace list
    const userNamespaces =
      ((await this.state.storage.get(`user:${data.userId}:namespaces`)) as string[]) || []
    userNamespaces.push(namespaceId)
    await this.state.storage.put(`user:${data.userId}:namespaces`, userNamespaces)

    return namespace
  }

  async listNamespaces(): Promise<Namespace[]> {
    // This is a simplified version - in production, you'd want to paginate
    const namespaces: Namespace[] = []
    const list = await this.state.storage.list({ prefix: 'namespace:' })

    for (const [, namespace] of list) {
      namespaces.push(namespace as Namespace)
    }

    return namespaces
  }

  private async generateEmbedding(_text: string): Promise<number[] | null> {
    // TODO: Implement embedding generation using Workers AI or external API
    // For now, return a dummy embedding
    return new Array(VECTOR_DIMENSIONS).fill(0).map(() => Math.random())
  }
}
