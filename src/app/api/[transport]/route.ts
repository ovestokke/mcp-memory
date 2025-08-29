import { env } from '@/env'
import * as jwt from '@/lib/jwt'
import { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import { z } from 'zod'

const handler = createMcpHandler((server) => {
  server.tool(
    'create_memory',
    'Creates a memory for the user, either because the assistant considers it important or because the user has asked to remember something specific.',
    {
      text: z.string({ description: 'The content of the memory' }).min(1),
    },
    async ({ text }) => {
      return {
        content: [{ type: 'text', text: `🧠 Memory created: "${text}"` }],
      }
    },
  )
})

const verifyToken = async (_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> => {
  if (!bearerToken) return undefined

  const { success, payload } = await jwt.verify(bearerToken, env.JWT_SECRET)
  if (!success || !payload || payload.aud !== 'mcp-memory') return undefined

  return {
    token: bearerToken,
    scopes: [],
    clientId: payload.client_id as string,
  }
}

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  resourceMetadataPath: '/.well-known/oauth-protected-resource',
})

export { authHandler as POST }