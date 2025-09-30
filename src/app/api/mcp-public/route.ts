import { createMcpHandler } from 'mcp-handler'
import { z } from 'zod'

// Public MCP endpoint without authentication
// WARNING: This is for testing only. Use the /api/mcp endpoint with OAuth for production.
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
      tools: { listChanged: true },
      resources: { listChanged: true },
      prompts: { listChanged: true },
    },
  },
  {
    verboseLogs: true,
    onEvent: (event) => {
      console.log('MCP Public Event:', event)
    },
  },
)

export { handler as GET, handler as POST }
