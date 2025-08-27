import OAuthProvider from '@cloudflare/workers-oauth-provider'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { McpAgent } from 'agents/mcp'
import { z } from 'zod'
import { GoogleHandler } from './google-handler'
import { MemoryStorageClient } from '../shared/memory/client'
import { MemoryStorage } from '../shared/memory/storage'
import { MemorySearchOptions } from '../shared/memory/types'

// Context from the auth process, encrypted & stored in the auth token
// and provided to the MemoryMCP as this.props
type Props = {
  name: string
  email: string
  accessToken: string
}

export interface Env {
  MEMORY_STORAGE: DurableObjectNamespace
  VECTORIZE: VectorizeIndex
  OAUTH_KV: KVNamespace
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  COOKIE_ENCRYPTION_KEY: string
  HOSTED_DOMAIN?: string
}

export class MemoryMCP extends McpAgent<Env, Record<string, never>, Props> {
  server = new McpServer({
    name: 'MCP Memory Server',
    version: '1.0.0',
  })

  private memoryClient: MemoryStorageClient | null = null

  async init() {
    // Initialize memory client with user isolation
    const userId = this.props?.email || 'anonymous'
    console.log('MCP Server Init - User ID:', userId, 'Props:', JSON.stringify(this.props))
    const id = this.env.MEMORY_STORAGE.idFromName(userId)
    console.log('MCP Server Init - Durable Object ID:', id.toString())
    const durableObject = this.env.MEMORY_STORAGE.get(id)
    this.memoryClient = new MemoryStorageClient(durableObject)

    // Memory storage tool
    this.server.tool(
      'store_memory',
      {
        content: z.string().min(1, 'Content cannot be empty'),
        namespace: z.string().optional().default('general'),
        labels: z.array(z.string()).optional().default([]),
      },
      async ({ content, namespace, labels }) => {
        if (!this.memoryClient) {
          throw new Error('Memory client not initialized')
        }

        const userId = this.props?.email || 'anonymous'
        const memory = await this.memoryClient.storeMemory({
          userId,
          content,
          namespace: namespace!,
          labels: labels!,
        })

        return {
          content: [
            {
              text: `Memory stored successfully with ID: ${memory.id}`,
              type: 'text',
            },
          ],
        }
      },
    )

    // Memory search tool
    this.server.tool(
      'search_memories',
      {
        query: z.string().min(1, 'Query cannot be empty'),
        namespace: z.string().optional(),
        limit: z.number().min(1).max(50).optional().default(10),
        similarity_threshold: z.number().min(0).max(1).optional().default(0.3),
      },
      async ({ query, namespace, limit, similarity_threshold }) => {
        if (!this.memoryClient) {
          throw new Error('Memory client not initialized')
        }

        const searchOptions: MemorySearchOptions = {
          query,
          ...(namespace && { namespace }),
          limit: limit!,
          similarityThreshold: similarity_threshold!,
        }

        const userId = this.props?.email || 'anonymous'
        const results = await this.memoryClient.searchMemories(userId, searchOptions)

        return {
          content: [
            {
              text: `Found ${results.length} memories:\n\n${results
                .map(
                  (result, i) =>
                    `${i + 1}. [${result.memory.namespace}] ${result.memory.content} (similarity: ${result.similarity?.toFixed(3)})`,
                )
                .join('\n')}`,
              type: 'text',
            },
          ],
        }
      },
    )

    // List memories tool
    this.server.tool(
      'list_memories',
      {
        namespace: z.string().optional(),
      },
      async ({ namespace }) => {
        if (!this.memoryClient) {
          throw new Error('Memory client not initialized')
        }
 
        const userId = this.props?.email || 'anonymous'
        const memories = await this.memoryClient.listMemories(userId, namespace)

        return {
          content: [
            {
              text: `Listed ${memories.length} memories:\n\n${memories
                .map((memory, i) => `${i + 1}. [${memory.namespace}] ${memory.content} (${memory.createdAt})`)
                .join('\n')}`,
              type: 'text',
            },
          ],
        }
      },
    )

    // Delete memory tool
    this.server.tool(
      'delete_memory',
      {
        id: z.string().min(1, 'Memory ID is required'),
      },
      async ({ id }) => {
        if (!this.memoryClient) {
          throw new Error('Memory client not initialized')
        }

        const userId = this.props?.email || 'anonymous'
        await this.memoryClient.deleteMemory(userId, id)

        return {
          content: [
            {
              text: `Memory with ID ${id} deleted successfully`,
              type: 'text',
            },
          ],
        }
      },
    )

    // Create namespace tool
    this.server.tool(
      'create_namespace',
      {
        name: z.string().min(1, 'Namespace name is required'),
        description: z.string().optional(),
      },
      async ({ name, description }) => {
        if (!this.memoryClient) {
          throw new Error('Memory client not initialized')
        }

        const userId = this.props?.email || 'anonymous'
        await this.memoryClient.createNamespace({
          userId,
          name,
          description: description || `Namespace for ${name}-related memories`,
        })

        return {
          content: [
            {
              text: `Namespace '${name}' created successfully`,
              type: 'text',
            },
          ],
        }
      },
    )

    // List namespaces tool
    this.server.tool('list_namespaces', {}, async () => {
      if (!this.memoryClient) {
        throw new Error('Memory client not initialized')
      }

      const namespaces = await this.memoryClient.listNamespaces()

      return {
        content: [
          {
            text: `Available namespaces:\n\n${namespaces
              .map((ns, i) => `${i + 1}. ${ns.name}: ${ns.description || 'No description'}`)
              .join('\n')}`,
            type: 'text',
          },
        ],
      }
    })
  }
}

// Export Durable Object
export { MemoryStorage }


// Simple REST API handler for Web UI compatibility
const simpleRestHandler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    console.log('=== SIMPLE REST HANDLER CALLED ===', request.method, request.url)
    const url = new URL(request.url)

    // Extract access token from Authorization header
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'Authorization required' }, { status: 401 })
    }

    const accessToken = authHeader.substring(7)

    // Get user info from Google
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })

    if (!userResponse.ok) {
      return Response.json({ error: 'Invalid access token' }, { status: 401 })
    }

    const userInfo = await userResponse.json() as { email: string; name: string }
    const userId = userInfo.email

    console.log('REST API - User ID:', userId, 'Path:', url.pathname)

    // Initialize memory client - call storage methods directly with proper user ID
    const id = env.MEMORY_STORAGE.idFromName(userId)
    console.log('REST API - Durable Object ID:', id.toString())
    const durableObject = env.MEMORY_STORAGE.get(id)

    try {
      if (url.pathname === '/api/memories' && request.method === 'GET') {
        // Call storage methods directly, passing userId
        const namespace = url.searchParams.get('namespace') || undefined
        const response = await durableObject.fetch(new Request(`http://localhost/memories${namespace ? `?namespace=${namespace}` : ''}`, {
          method: 'GET',
          headers: { 'x-user-id': userId }
        }))
        const memories = await response.json()
        return Response.json(memories)
      }

      if (url.pathname === '/api/memories' && request.method === 'POST') {
        const body = await request.json() as any
        const response = await durableObject.fetch(new Request('http://localhost/memories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
          body: JSON.stringify({
            content: body.content,
            namespace: body.namespace || 'general',
            labels: body.labels || [],
          })
        }))
        const memory = await response.json()
        return Response.json(memory)
      }

      if (url.pathname.startsWith('/api/memories/') && request.method === 'DELETE') {
        const memoryId = url.pathname.substring('/api/memories/'.length)
        const response = await durableObject.fetch(new Request(`http://localhost/memories?id=${memoryId}`, {
          method: 'DELETE',
          headers: { 'x-user-id': userId }
        }))
        const result = await response.json()
        return Response.json(result)
      }

      return Response.json({ error: 'Not found' }, { status: 404 })
    } catch (error) {
      console.error('REST API error:', error)
      return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
}

export default new OAuthProvider({
  // NOTE - during the summer 2025, the SSE protocol was deprecated and replaced by the Streamable-HTTP protocol
  // https://developers.cloudflare.com/agents/model-context-protocol/transport/#mcp-server-with-authentication
  apiHandlers: {
    '/sse': MemoryMCP.serveSSE('/sse'), // deprecated SSE protocol - use /mcp instead
    '/mcp': MemoryMCP.serve('/mcp'), // Streamable-HTTP protocol
    '/api/memories': simpleRestHandler,
  },
  authorizeEndpoint: '/auth/authorize',
  clientRegistrationEndpoint: '/auth/register',
  defaultHandler: GoogleHandler as any,
  tokenEndpoint: '/auth/token',
})
