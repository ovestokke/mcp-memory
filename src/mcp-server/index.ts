import { MemoryStorage } from '@shared/memory/storage';

export interface Env {
  MEMORY_STORAGE: DurableObjectNamespace;
  VECTORIZE: VectorizeIndex;
  ENVIRONMENT: string;
}

// Export the Durable Object class
export { MemoryStorage };

// Simple worker for now - we'll add MCP later
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Basic health check
    if (url.pathname === '/') {
      return new Response('MCP Memory Server - Ready for connections', { status: 200 });
    }
    
    // TODO: Add MCP protocol handling
    if (url.pathname === '/mcp') {
      return new Response('MCP endpoint not implemented yet', { status: 501 });
    }
    
    // API endpoints for web UI
    // Extract user ID from request headers or use demo for development
    const userId = request.headers.get('x-user-id') || 'demo-user';
    const id = env.MEMORY_STORAGE.idFromName(userId);
    const durableObject = env.MEMORY_STORAGE.get(id);

    // Handle CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    try {
      // Proxy request to Durable Object
      const response = await durableObject.fetch(request);
      
      // Add CORS headers to response
      const corsResponse = new Response(response.body, response);
      corsResponse.headers.set('Access-Control-Allow-Origin', '*');
      corsResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      corsResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type');
      
      return corsResponse;
    } catch (error) {
      return new Response(JSON.stringify({ error: `Server error: ${error}` }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
    
    return new Response('Not Found', { status: 404 });
  },
};