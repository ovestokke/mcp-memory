import { env } from '@/env'
import * as jwt from '@/lib/jwt'
import { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import { z } from 'zod'

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      'create_memory',
      {
        title: 'Create Memory',
        description:
          'Creates a memory for the user, either because the assistant considers it important or because the user has asked to remember something specific.',
        inputSchema: {
          text: z.string({ description: 'The content of the memory' }).min(1),
        },
      },
      async ({ text }) => {
        return {
          content: [{ type: 'text', text: `🧠 Memory created: "${text}"` }],
        }
      },
    )

    server.registerResource(
      'memories',
      'text://memories.text',
      {
        title: 'User Memories',
        description: 'A list of memories the user has asked to remember',
      },
      async (uri: URL) => {
        return {
          contents: [
            {
              uri: uri.href,
              text: 'No memories yet.',
            },
          ],
        }
      },
    )
  },
  {
    capabilities: {
      auth: {
        type: 'bearer',
        required: true,
      },
      tools: { listChanged: true },
      resources: { listChanged: true },
      prompts: { listChanged: true },
    },
  },
  {
    streamableHttpEndpoint: '/mcp',
    verboseLogs: true,
    onEvent: (event) => {
      console.log('MCP Event:', event)
    },
    disableSse: false,
    basePath: '/api',
  },
)

const verifyToken = async (_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> => {
  if (!bearerToken) {
    return undefined
  }

  const { success, payload } = await jwt.verify(bearerToken, env.JWT_SECRET)
  if (!success || !payload || payload.aud !== 'mcp-memory') {
    return undefined
  }

  return {
    token: bearerToken,
    scopes: [],
    clientId: payload.client_id as string,
  }
}

async function authHandler(req: Request) {
  const response = await withMcpAuth(handler, verifyToken, {
    required: false, // CHANGED: Make auth optional for testing
    resourceMetadataPath: '/.well-known/oauth-protected-resource', // known default value we can replace.
  })(req)

  if (response.status === 401) {
    const wwwAuthenticate = response.headers.get('WWW-Authenticate')!

    // Add the pathname so that clients that blindly follow the www-authenticate header will work.
    // vscode seems to be strict about this, whereas mcp inspect works without it...
    const pathname = new URL(req.url).pathname
    const resourceMetadataUrl = `/.well-known/oauth-protected-resource${pathname}`
    const originalUrl = `/.well-known/oauth-protected-resource`

    response.headers.set('WWW-Authenticate', wwwAuthenticate?.replace(originalUrl, `${resourceMetadataUrl}`))
  }

  return response
}

export { authHandler as GET, authHandler as POST }
