import { logger } from '../utils/logger';
import { MemoryStorageClient } from '../memory/client';
import { MemorySearchOptions } from '../memory/types';
import { MemorySchema, MemorySearchSchema } from '../validation/schemas';
import { z } from 'zod';

// Helper function to safely format dates that could be Date objects or strings
function formatDateSafely(date: Date | string): string {
  if (typeof date === 'string') {
    return new Date(date).toISOString();
  }
  return date.toISOString();
}

// MCP protocol types for HTTP transport
export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPServerInfo {
  protocolVersion: string;
  capabilities: {
    tools: {};
  };
  serverInfo: {
    name: string;
    version: string;
  };
}

/**
 * HTTP-based MCP server for Cloudflare Workers
 * Implements MCP protocol over HTTP instead of stdio
 */
export class MCPHttpServer {
  private memoryStorage: MemoryStorageClient;
  private mcpLogger: typeof logger;
  private currentUserId: string | null = null;

  constructor(memoryStorage: MemoryStorageClient) {
    this.memoryStorage = memoryStorage;
    this.mcpLogger = logger.withContext({ component: 'MCPHttpServer' });
  }

  setCurrentUser(userId: string): void {
    this.currentUserId = userId;
  }

  /**
   * Handle MCP HTTP request
   */
  async handleRequest(request: Request): Promise<Response> {
    const requestLogger = this.mcpLogger.withContext({
      method: request.method,
      path: new URL(request.url).pathname,
      userId: this.currentUserId ?? 'anonymous',
    });

    try {
      if (request.method !== 'POST') {
        const errorResponse = this.createErrorResponse('invalid_request', 'Only POST method is supported');
        return new Response(JSON.stringify(errorResponse), {
          status: 405,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const mcpRequest: MCPRequest = await request.json();
      
      if (!mcpRequest.jsonrpc || mcpRequest.jsonrpc !== '2.0') {
        const errorResponse = this.createErrorResponse('invalid_request', 'Invalid JSON-RPC version');
        return new Response(JSON.stringify(errorResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      requestLogger.info('MCP request received', {
        method: mcpRequest.method,
        id: mcpRequest.id,
      });

      const response = await this.handleMCPMethod(mcpRequest);
      
      requestLogger.info('MCP request completed', {
        method: mcpRequest.method,
        id: mcpRequest.id,
        success: !response.error,
      });

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    } catch (error) {
      requestLogger.error('MCP request failed', { 
        error: error instanceof Error ? error : String(error) 
      });
      
      return new Response(
        JSON.stringify(this.createErrorResponse('internal_error', 'Internal server error')),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  /**
   * Handle specific MCP methods
   */
  private async handleMCPMethod(request: MCPRequest): Promise<MCPResponse> {
    const { method, params, id } = request;

    switch (method) {
      case 'initialize':
        return this.handleInitialize(id);

      case 'tools/list':
        return this.handleListTools(id);

      case 'tools/call':
        return await this.handleToolCall(params, id);

      case 'resources/list':
        return this.handleListResources(id);

      case 'prompts/list':
        return this.handleListPrompts(id);

      case 'notifications/initialized':
        // This is a notification, not a request/response, but Claude Desktop sends it
        return this.handleNotificationInitialized();

      default:
        return this.createErrorResponse('method_not_found', `Method '${method}' not found`, id);
    }
  }

  /**
   * Handle MCP initialize request
   */
  private handleInitialize(id: string | number): MCPResponse {
    const serverInfo: MCPServerInfo = {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
      },
      serverInfo: {
        name: 'MCP Memory Server',
        version: '1.0.0',
      },
    };

    return {
      jsonrpc: '2.0',
      id,
      result: serverInfo,
    };
  }

  /**
   * Handle tools/list request
   */
  private handleListTools(id: string | number): MCPResponse {
    const tools: MCPTool[] = [
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

    return {
      jsonrpc: '2.0',
      id,
      result: { tools },
    };
  }

  /**
   * Handle tools/call request
   */
  private async handleToolCall(params: any, id: string | number): Promise<MCPResponse> {
    if (!this.currentUserId) {
      return this.createErrorResponse('unauthorized', 'User not authenticated', id);
    }

    const { name, arguments: args } = params || {};
    
    if (!name) {
      return this.createErrorResponse('invalid_params', 'Tool name is required', id);
    }

    try {
      const result = await this.executeTool(name, args);
      return {
        jsonrpc: '2.0',
        id,
        result,
      };
    } catch (error) {
      this.mcpLogger.error('Tool execution failed', {
        tool: name,
        error: error instanceof Error ? error : String(error),
        userId: this.currentUserId,
      });

      return this.createErrorResponse(
        'tool_error',
        error instanceof Error ? error.message : 'Tool execution failed',
        id
      );
    }
  }

  /**
   * Execute a specific tool
   */
  private async executeTool(toolName: string, args: any): Promise<any> {
    const userId = this.currentUserId!;

    switch (toolName) {
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
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  private async handleStoreMemory(args: unknown, userId: string) {
    const validatedArgs = MemorySchema.parse(args);

    const memory = await this.memoryStorage.storeMemory({
      userId,
      content: validatedArgs.content,
      namespace: validatedArgs.namespace,
      labels: validatedArgs.labels,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Memory stored successfully!\n\nID: ${memory.id}\nNamespace: ${memory.namespace}\nLabels: ${memory.labels.join(', ')}\nCreated: ${formatDateSafely(memory.createdAt)}`,
        },
      ],
    };
  }

  private async handleSearchMemories(args: unknown, userId: string) {
    const validatedArgs = MemorySearchSchema.parse(args);

    const searchOptions: MemorySearchOptions = {
      ...(validatedArgs.query && { query: validatedArgs.query }),
      ...(validatedArgs.namespace && { namespace: validatedArgs.namespace }),
      ...(validatedArgs.labels && { labels: validatedArgs.labels }),
      limit: validatedArgs.limit,
    };

    const results = await this.memoryStorage.searchMemories(userId, searchOptions);

    if (results.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No memories found matching your search criteria.',
          },
        ],
      };
    }

    const formattedResults = results.map((result) => {
      const similarityText = result.similarity 
        ? ` (similarity: ${(result.similarity * 100).toFixed(1)}%)`
        : '';
      
      return `**${result.memory.namespace}${similarityText}**\nID: ${result.memory.id}\nContent: ${result.memory.content}\nLabels: ${result.memory.labels.join(', ')}\nCreated: ${formatDateSafely(result.memory.createdAt)}`;
    }).join('\n\n---\n\n');

    return {
      content: [
        {
          type: 'text',
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

    if (memories.length === 0) {
      const namespaceText = namespace ? ` in namespace "${namespace}"` : '';
      return {
        content: [
          {
            type: 'text',
            text: `No memories found${namespaceText}.`,
          },
        ],
      };
    }

    const formattedMemories = memories.map((memory) => 
      `**${memory.namespace}**\nID: ${memory.id}\nContent: ${memory.content.substring(0, 200)}${memory.content.length > 200 ? '...' : ''}\nLabels: ${memory.labels.join(', ')}\nCreated: ${formatDateSafely(memory.createdAt)}`
    ).join('\n\n---\n\n');

    const namespaceText = namespace ? ` in namespace "${namespace}"` : '';
    return {
      content: [
        {
          type: 'text',
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

    return {
      content: [
        {
          type: 'text',
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
      ...(validatedArgs.description && { description: validatedArgs.description }),
    });

    return {
      content: [
        {
          type: 'text',
          text: `Namespace "${namespace.name}" created successfully!\n\nID: ${namespace.id}\nDescription: ${namespace.description || 'None'}\nCreated: ${formatDateSafely(namespace.createdAt)}`,
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
            type: 'text',
            text: 'No namespaces found.',
          },
        ],
      };
    }

    const formattedNamespaces = namespaces.map((namespace) =>
      `**${namespace.name}**\nID: ${namespace.id}\nDescription: ${namespace.description || 'None'}\nCreated: ${formatDateSafely(namespace.createdAt)}`
    ).join('\n\n---\n\n');

    return {
      content: [
        {
          type: 'text',
          text: `Found ${namespaces.length} namespaces:\n\n${formattedNamespaces}`,
        },
      ],
    };
  }

  /**
   * Handle resources/list request
   * Resources are read-only data sources that the server can provide
   */
  private handleListResources(id: string | number): MCPResponse {
    // For now, we don't expose any resources
    // In the future, we could expose things like:
    // - Memory statistics
    // - Namespace summaries
    // - Recent activity feeds
    return {
      jsonrpc: '2.0',
      id,
      result: { resources: [] },
    };
  }

  /**
   * Handle prompts/list request
   * Prompts are reusable templates that clients can invoke
   */
  private handleListPrompts(id: string | number): MCPResponse {
    // For now, we don't provide any prompts
    // In the future, we could provide things like:
    // - "Summarize my memories from last week"
    // - "Find related memories about X"
    // - "Create a memory from this conversation"
    return {
      jsonrpc: '2.0',
      id,
      result: { prompts: [] },
    };
  }

  /**
   * Handle notifications/initialized
   * This is sent by clients after they receive the initialize response
   */
  private handleNotificationInitialized(): MCPResponse {
    // For notifications, we don't need to return anything meaningful
    // Just acknowledge that we received it
    return {
      jsonrpc: '2.0',
      id: 0, // Notifications typically don't have meaningful IDs
      result: null,
    };
  }

  /**
   * Create error response
   */
  private createErrorResponse(code: string, message: string, id?: string | number): MCPResponse {
    return {
      jsonrpc: '2.0',
      id: id || 0,
      error: {
        code: this.getErrorCode(code),
        message,
      },
    };
  }

  /**
   * Map error codes to numbers
   */
  private getErrorCode(code: string): number {
    const errorCodes: Record<string, number> = {
      'invalid_request': -32600,
      'method_not_found': -32601,
      'invalid_params': -32602,
      'internal_error': -32603,
      'unauthorized': -32000,
      'tool_error': -32001,
    };

    return errorCodes[code] || -32603;
  }
}