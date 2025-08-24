import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  TextContent,
  ImageContent,
  EmbeddedResource,
} from '@modelcontextprotocol/sdk/types.js';
import { MemoryStorage } from '../memory/storage';
import { Memory, MemorySearchOptions } from '../memory/types';
import { logger } from '../utils/logger';
import { MemorySchema, MemorySearchSchema } from '../validation/schemas';
import { z } from 'zod';

export interface MCPServerConfig {
  name: string;
  version: string;
}

export class MCPMemoryServer {
  private server: Server;
  private memoryStorage: MemoryStorage;
  private mcpLogger: typeof logger;

  constructor(config: MCPServerConfig, memoryStorage: MemoryStorage) {
    this.memoryStorage = memoryStorage;
    this.mcpLogger = logger.withContext({ 
      component: 'MCPMemoryServer',
      version: config.version,
    });

    // Initialize MCP server
    this.server = new Server({
      name: config.name,
      version: config.version,
    }, {
      capabilities: {
        tools: {},
      },
    });

    this.setupTools();
    this.setupErrorHandling();
  }

  private setupTools() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Tool[] = [
        {
          name: 'store_memory',
          description: 'Store a new memory with content, namespace, and labels',
          inputSchema: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: 'The content of the memory to store',
              },
              namespace: {
                type: 'string',
                description: 'The namespace to organize the memory (e.g., "work", "personal", "research")',
                default: 'general',
              },
              labels: {
                type: 'array',
                items: { type: 'string' },
                description: 'Tags to categorize the memory',
                default: [],
              },
            },
            required: ['content'],
          },
        },
        {
          name: 'search_memories',
          description: 'Search memories using semantic similarity or filters',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query for semantic similarity search',
              },
              namespace: {
                type: 'string',
                description: 'Filter memories by namespace',
              },
              labels: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter memories by labels (matches any of the provided labels)',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of memories to return',
                minimum: 1,
                maximum: 100,
                default: 20,
              },
              similarity_threshold: {
                type: 'number',
                description: 'Minimum similarity score for semantic search (0.0 to 1.0)',
                minimum: 0,
                maximum: 1,
                default: 0.7,
              },
            },
          },
        },
        {
          name: 'list_memories',
          description: 'List all memories, optionally filtered by namespace',
          inputSchema: {
            type: 'object',
            properties: {
              namespace: {
                type: 'string',
                description: 'Filter memories by namespace',
              },
            },
          },
        },
        {
          name: 'delete_memory',
          description: 'Delete a memory by its ID',
          inputSchema: {
            type: 'object',
            properties: {
              memory_id: {
                type: 'string',
                description: 'The ID of the memory to delete',
              },
            },
            required: ['memory_id'],
          },
        },
        {
          name: 'create_namespace',
          description: 'Create a new namespace for organizing memories',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Name of the namespace',
              },
              description: {
                type: 'string',
                description: 'Description of what this namespace is for',
              },
            },
            required: ['name'],
          },
        },
        {
          name: 'list_namespaces',
          description: 'List all available namespaces',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ];

      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const userId = this.getCurrentUserId(); // This will be set by the authenticated request context

      this.mcpLogger.info('Tool call received', {
        tool: name,
        userId,
        arguments: args,
      });

      try {
        switch (name) {
          case 'store_memory':
            return await this.handleStoreMemory(args, userId);

          case 'search_memories':
            return await this.handleSearchMemories(args, userId);

          case 'list_memories':
            return await this.handleListMemories(args, userId);

          case 'delete_memory':
            return await this.handleDeleteMemory(args, userId);

          case 'create_namespace':
            return await this.handleCreateNamespace(args, userId);

          case 'list_namespaces':
            return await this.handleListNamespaces();

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        this.mcpLogger.error('Tool execution failed', {
          tool: name,
          error,
          userId,
        });
        
        throw error;
      }
    });
  }

  private setupErrorHandling() {
    this.server.onerror = (error) => {
      this.mcpLogger.error('MCP Server error', { error });
    };
  }

  private getCurrentUserId(): string {
    // This will be set by the request context in the worker
    // For now, we'll use a placeholder - this needs to be properly implemented
    // when integrating with the OAuth authenticated requests
    return 'current-user';
  }

  private async handleStoreMemory(args: unknown, userId: string) {
    const validatedArgs = MemorySchema.parse(args);

    const memory = await this.memoryStorage.storeMemory({
      userId,
      content: validatedArgs.content,
      namespace: validatedArgs.namespace,
      labels: validatedArgs.labels,
    });

    this.mcpLogger.info('Memory stored successfully', {
      memoryId: memory.id,
      userId,
      namespace: memory.namespace,
      labelCount: memory.labels.length,
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: `Memory stored successfully!\n\nID: ${memory.id}\nNamespace: ${memory.namespace}\nLabels: ${memory.labels.join(', ')}\nCreated: ${memory.createdAt.toISOString()}`,
        },
      ],
    };
  }

  private async handleSearchMemories(args: unknown, userId: string) {
    const validatedArgs = MemorySearchSchema.parse(args);

    const searchOptions: MemorySearchOptions = {
      query: validatedArgs.query,
      namespace: validatedArgs.namespace,
      labels: validatedArgs.labels,
      limit: validatedArgs.limit,
    };

    const results = await this.memoryStorage.searchMemories(userId, searchOptions);

    this.mcpLogger.info('Memory search completed', {
      userId,
      resultCount: results.length,
      query: validatedArgs.query,
      namespace: validatedArgs.namespace,
    });

    if (results.length === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'No memories found matching your search criteria.',
          },
        ],
      };
    }

    const formattedResults = results.map((result) => {
      const similarityText = result.similarity 
        ? ` (similarity: ${(result.similarity * 100).toFixed(1)}%)`
        : '';
      
      return `**${result.memory.namespace}${similarityText}**
ID: ${result.memory.id}
Content: ${result.memory.content}
Labels: ${result.memory.labels.join(', ')}
Created: ${result.memory.createdAt.toISOString()}`;
    }).join('\n\n---\n\n');

    return {
      content: [
        {
          type: 'text' as const,
          text: `Found ${results.length} memories:\n\n${formattedResults}`,
        },
      ],
    };
  }

  private async handleListMemories(args: unknown, userId: string) {
    const { namespace } = z.object({
      namespace: z.string().optional(),
    }).parse(args);

    const memories = await this.memoryStorage.listMemories(userId, namespace);

    this.mcpLogger.info('Memory list retrieved', {
      userId,
      count: memories.length,
      namespace,
    });

    if (memories.length === 0) {
      const namespaceText = namespace ? ` in namespace "${namespace}"` : '';
      return {
        content: [
          {
            type: 'text' as const,
            text: `No memories found${namespaceText}.`,
          },
        ],
      };
    }

    const formattedMemories = memories.map((memory) => 
      `**${memory.namespace}**
ID: ${memory.id}
Content: ${memory.content.substring(0, 200)}${memory.content.length > 200 ? '...' : ''}
Labels: ${memory.labels.join(', ')}
Created: ${memory.createdAt.toISOString()}`
    ).join('\n\n---\n\n');

    const namespaceText = namespace ? ` in namespace "${namespace}"` : '';
    return {
      content: [
        {
          type: 'text' as const,
          text: `Found ${memories.length} memories${namespaceText}:\n\n${formattedMemories}`,
        },
      ],
    };
  }

  private async handleDeleteMemory(args: unknown, userId: string) {
    const { memory_id } = z.object({
      memory_id: z.string(),
    }).parse(args);

    await this.memoryStorage.deleteMemory(userId, memory_id);

    this.mcpLogger.info('Memory deleted successfully', {
      memoryId: memory_id,
      userId,
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: `Memory with ID ${memory_id} has been deleted successfully.`,
        },
      ],
    };
  }

  private async handleCreateNamespace(args: unknown, userId: string) {
    const validatedArgs = z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
    }).parse(args);

    const namespace = await this.memoryStorage.createNamespace({
      userId,
      name: validatedArgs.name,
      description: validatedArgs.description,
    });

    this.mcpLogger.info('Namespace created successfully', {
      namespaceId: namespace.id,
      name: namespace.name,
      userId,
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: `Namespace "${namespace.name}" created successfully!\n\nID: ${namespace.id}\nDescription: ${namespace.description || 'None'}\nCreated: ${namespace.createdAt.toISOString()}`,
        },
      ],
    };
  }

  private async handleListNamespaces() {
    const namespaces = await this.memoryStorage.listNamespaces();

    this.mcpLogger.info('Namespaces list retrieved', {
      count: namespaces.length,
    });

    if (namespaces.length === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'No namespaces found.',
          },
        ],
      };
    }

    const formattedNamespaces = namespaces.map((namespace) =>
      `**${namespace.name}**
ID: ${namespace.id}
Description: ${namespace.description || 'None'}
Created: ${namespace.createdAt.toISOString()}`
    ).join('\n\n---\n\n');

    return {
      content: [
        {
          type: 'text' as const,
          text: `Found ${namespaces.length} namespaces:\n\n${formattedNamespaces}`,
        },
      ],
    };
  }

  async run(transport?: StdioServerTransport) {
    if (transport) {
      await this.server.connect(transport);
      this.mcpLogger.info('MCP server started with transport');
    } else {
      this.mcpLogger.info('MCP server initialized (no transport)');
    }
  }

  getServer(): Server {
    return this.server;
  }
}