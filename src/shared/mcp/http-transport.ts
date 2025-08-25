import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage, JSONRPCRequest, JSONRPCResponse } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger';

/**
 * HTTP Transport for MCP SDK
 * Allows the official MCP SDK to work over HTTP instead of stdio
 * This replaces the custom JSON-RPC implementation in http-server.ts
 */
export class HttpTransport implements Transport {
  private mcpLogger = logger.withContext({ component: 'HttpTransport' });
  private currentUserId: string | null = null;

  setCurrentUser(userId: string): void {
    this.currentUserId = userId;
  }

  /**
   * Handle HTTP request and convert to MCP message format
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

      // Send message to MCP server and get response
      const response = await this.sendMessage(jsonRpcRequest);

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
   * Send message to MCP server (this will be handled by the server)
   * The actual implementation depends on how we connect this transport
   */
  private async sendMessage(message: JSONRPCRequest): Promise<JSONRPCResponse> {
    // This will be implemented when we connect the transport to the server
    // For now, we'll create a placeholder that the server will override
    throw new Error('Transport not connected to server');
  }

  /**
   * Start the transport (required by Transport interface)
   */
  async start(): Promise<void> {
    this.mcpLogger.info('HTTP transport started');
  }

  /**
   * Close the transport (required by Transport interface)
   */
  async close(): Promise<void> {
    this.mcpLogger.info('HTTP transport closed');
  }

  /**
   * Send a JSON-RPC message (required by Transport interface)
   * This is used by the server to send messages back
   */
  async send(message: JSONRPCMessage): Promise<void> {
    // In HTTP transport, we don't actively send messages
    // We return responses to the HTTP request
    this.mcpLogger.debug('Message prepared for response', { message });
  }

  /**
   * Set up message handlers (required by Transport interface)
   */
  onMessage?: ((message: JSONRPCMessage) => void) | undefined;
  onError?: ((error: Error) => void) | undefined;
  onClose?: (() => void) | undefined;

  /**
   * Create error response
   */
  private createErrorResponse(message: string, status: number): Response {
    const errorResponse: JSONRPCResponse = {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: this.getErrorCode(status),
        message,
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Map HTTP status codes to JSON-RPC error codes
   */
  private getErrorCode(status: number): number {
    const errorCodes: Record<number, number> = {
      400: -32600, // Invalid Request
      404: -32601, // Method not found
      405: -32601, // Method not found
      500: -32603, // Internal error
    };

    return errorCodes[status] || -32603;
  }
}

/**
 * Factory function to create HTTP transport with MCP server
 * This integrates the HTTP transport with the official MCP SDK
 */
export function createHttpMcpServer(server: any): {
  handleRequest: (request: Request) => Promise<Response>;
  setCurrentUser: (userId: string) => void;
} {
  const transport = new HttpTransport();
  
  // Connect the transport to the server
  // This is where we bridge HTTP requests to MCP protocol
  const originalSend = transport.send.bind(transport);
  let pendingResponse: JSONRPCResponse | null = null;

  // Override the transport's send method to capture responses
  transport.send = async (message: JSONRPCMessage) => {
    if ('result' in message || 'error' in message) {
      pendingResponse = message as JSONRPCResponse;
    }
  };

  // Override the sendMessage method to actually process requests
  (transport as any).sendMessage = async (request: JSONRPCRequest): Promise<JSONRPCResponse> => {
    pendingResponse = null;
    
    // Process the request through the MCP server
    if (transport.onMessage) {
      transport.onMessage(request);
    }

    // Wait for the server to process and respond
    // In a real implementation, this would be properly async
    // For now, we'll need to refactor the server integration
    
    return pendingResponse || {
      jsonrpc: '2.0',
      id: request.id,
      error: {
        code: -32603,
        message: 'Internal error: No response generated',
      },
    };
  };

  return {
    handleRequest: transport.handleRequest.bind(transport),
    setCurrentUser: transport.setCurrentUser.bind(transport),
  };
}