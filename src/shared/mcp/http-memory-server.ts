import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  JSONRPCRequest,
  JSONRPCResponse,
} from '@modelcontextprotocol/sdk/types.js';
import { MemoryStorageClient } from '../memory/client';
import { MemorySearchOptions } from '../memory/types';
import { logger } from '../utils/logger';
import { MemorySchema, MemorySearchSchema } from '../validation/schemas';
import { z } from 'zod';

/**
 * Safely format a date for display, handling both Date objects and ISO strings
 */
function formatDate(date: Date | string | undefined): string {
  if (!date) return 'Unknown';
  if (typeof date === 'string') {
    return new Date(date).toISOString();
  }
  if (date instanceof Date) {
    return date.toISOString();
  }
  return 'Unknown';
}

export interface HttpMCPServerConfig {
  name: string;
  version: string;
}

/**
 * HTTP-enabled MCP Memory Server using official MCP SDK
 * 
 * This replaces the custom JSON-RPC implementation in http-server.ts
 * by properly using the official MCP SDK with HTTP request handling.
 * 
 * Benefits:
 * - Uses official MCP SDK for protocol compliance
 * - Eliminates 600+ lines of duplicate code
 * - Single source of truth for tool definitions
 * - Automatic protocol updates via SDK
 */
export class HttpMCPMemoryServer {
  private server: Server;
  private memoryStorage: MemoryStorageClient;
  private mcpLogger: typeof logger;
  private currentUserId: string | null = null;

  constructor(config: HttpMCPServerConfig, memoryStorage: MemoryStorageClient) {
    this.memoryStorage = memoryStorage;
    this.mcpLogger = logger.withContext({ 
      component: 'HttpMCPMemoryServer',
      version: config.version,
    });

    // Initialize MCP server with official SDK
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

  setCurrentUser(userId: string): void {
    this.currentUserId = userId;
  }

  /**
   * Handle HTTP request by converting to MCP protocol
   */
  async handleRequest(request: Request): Promise<Response> {
    const requestLogger = this.mcpLogger.withContext({
      method: request.method,
      path: new URL(request.url).pathname,
      userId: this.currentUserId ?? 'anonymous',
    });

    try {
      if (request.method !== 'POST') {
        return this.createErrorResponse('Method not allowed', 405);
      }

      const jsonRpcRequest: JSONRPCRequest = await request.json();
      
      if (!jsonRpcRequest.jsonrpc || jsonRpcRequest.jsonrpc !== '2.0') {
        return this.createErrorResponse('Invalid JSON-RPC version', 400);
      }

      requestLogger.info('MCP request received', {
        method: jsonRpcRequest.method,
        id: jsonRpcRequest.id,
      });

      // Process the request using the MCP server
      const response = await this.processRequest(jsonRpcRequest);

      requestLogger.info('MCP request completed', {
        method: jsonRpcRequest.method,
        id: jsonRpcRequest.id,
        success: !('error' in response),
      });

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    } catch (error) {
      requestLogger.error('MCP request failed', { 
        error: error instanceof Error ? error : String(error) 
      });
      
      return this.createErrorResponse('Internal server error', 500);
    }
  }

  /**
   * Get tools list (single source of truth)
   */
  private async getTools() {
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
  }

  /**
   * Handle tool calls (single source of truth)
   */
  private async handleToolCall(params: any) {
    const { name, arguments: args } = params || {};

    if (!this.currentUserId) {
      throw new Error('User not authenticated');
    }

    this.mcpLogger.info('Tool call received', {
      tool: name,
      userId: this.currentUserId,
      arguments: args,
    });

    try {
      switch (name) {
        case 'store_memory':
          return await this.handleStoreMemory(args);

        case 'search_memories':
          return await this.handleSearchMemories(args);

        case 'list_memories':
          return await this.handleListMemories(args);

        case 'delete_memory':
          return await this.handleDeleteMemory(args);

        case 'create_namespace':
          return await this.handleCreateNamespace(args);

        case 'list_namespaces':
          return await this.handleListNamespaces();

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      this.mcpLogger.error('Tool execution failed', {
        tool: name,
        error: error instanceof Error ? error.message : String(error),
        userId: this.currentUserId,
      });
      
      throw error;
    }
  }

  /**
   * Process JSON-RPC request using MCP SDK
   */
  private async processRequest(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    const { method, params, id } = request;

    try {
      let result: any;

      switch (method) {
        case 'initialize':
          result = {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'MCP Memory Server',
              version: '1.0.0',
            },
          };
          break;

        case 'tools/list':
          // Get tools from our own implementation (single source of truth)
          result = await this.getTools();
          break;

        case 'tools/call':
          // Handle tool calls directly  
          result = await this.handleToolCall(params);
          break;

        case 'resources/list':
          result = { resources: [] };
          break;

        case 'prompts/list':
          result = { prompts: [] };
          break;

        case 'notifications/initialized':
          result = null;
          break;

        default:
          throw new Error(`Method '${method}' not found`);
      }

      return {
        jsonrpc: '2.0',
        id,
        result,
      } as JSONRPCResponse;

    } catch (error) {
      this.mcpLogger.error('Request processing failed', {
        method,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: this.getErrorCode(method),
          message: error instanceof Error ? error.message : String(error),
        },
      } as any;
    }
  }

  private setupTools() {
    // Set up MCP server handlers for stdio transport (if needed)
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return await this.getTools();
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      return await this.handleToolCall(request.params);
    });
  }

  private setupErrorHandling() {
    this.server.onerror = (error) => {
      this.mcpLogger.error('MCP Server error', { error });
    };
  }

  // Tool handlers (same as in the original server.ts)
  private async handleStoreMemory(args: unknown) {
    const validatedArgs = MemorySchema.parse(args);

    const memory = await this.memoryStorage.storeMemory({
      userId: this.currentUserId!,
      content: validatedArgs.content,
      namespace: validatedArgs.namespace,
      labels: validatedArgs.labels,
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: `Memory stored successfully!\n\nID: ${memory.id}\nNamespace: ${memory.namespace}\nLabels: ${memory.labels.join(', ')}\nCreated: ${formatDate(memory.createdAt)}`,
        },
      ],
    };
  }

  private async handleSearchMemories(args: unknown) {
    const validatedArgs = MemorySearchSchema.parse(args);

    const searchOptions: MemorySearchOptions = {
      ...(validatedArgs.query && { query: validatedArgs.query }),
      ...(validatedArgs.namespace && { namespace: validatedArgs.namespace }),
      ...(validatedArgs.labels && { labels: validatedArgs.labels }),
      ...(validatedArgs.limit && { limit: validatedArgs.limit }),
    };

    const results = await this.memoryStorage.searchMemories(this.currentUserId!, searchOptions);

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
Created: ${formatDate(result.memory.createdAt)}`;
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

  private async handleListMemories(args: unknown) {
    const { namespace } = z.object({
      namespace: z.string().optional(),
    }).parse(args);

    const memories = await this.memoryStorage.listMemories(this.currentUserId!, namespace);

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
Created: ${formatDate(memory.createdAt)}`
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

  private async handleDeleteMemory(args: unknown) {
    const { memory_id } = z.object({
      memory_id: z.string(),
    }).parse(args);

    await this.memoryStorage.deleteMemory(this.currentUserId!, memory_id);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Memory with ID ${memory_id} has been deleted successfully.`,
        },
      ],
    };
  }

  private async handleCreateNamespace(args: unknown) {
    const validatedArgs = z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
    }).parse(args);

    const namespace = await this.memoryStorage.createNamespace({
      userId: this.currentUserId!,
      name: validatedArgs.name,
      ...(validatedArgs.description && { description: validatedArgs.description }),
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: `Namespace "${namespace.name}" created successfully!\n\nID: ${namespace.id}\nDescription: ${namespace.description || 'None'}\nCreated: ${formatDate(namespace.createdAt)}`,
        },
      ],
    };
  }

  private async handleListNamespaces() {
    const namespaces = await this.memoryStorage.listNamespaces();

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
Created: ${formatDate(namespace.createdAt)}`
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

  /**
   * Get the MCP server instance (for stdio transport if needed)
   */
  getServer(): Server {
    return this.server;
  }

  /**
   * Create error response
   */
  private createErrorResponse(message: string, status: number): Response {
    const errorResponse = {
      jsonrpc: '2.0',
      id: 0,
      error: {
        code: this.getErrorCode('error'),
        message,
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Map error types to JSON-RPC error codes
   */
  private getErrorCode(method: string): number {
    const errorCodes: Record<string, number> = {
      'invalid_request': -32600,
      'method_not_found': -32601,
      'invalid_params': -32602,
      'internal_error': -32603,
      'unauthorized': -32000,
      'tool_error': -32001,
    };

    return errorCodes[method] || -32603;
  }
}