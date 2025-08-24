#!/usr/bin/env node

/**
 * HTTP to Stdio Bridge for MCP Memory Server
 * Bridges Claude Desktop's stdio MCP client to HTTP MCP server
 */

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:8787/mcp';

// Simple stdio to HTTP bridge
process.stdin.setEncoding('utf8');

let buffer = '';

process.stdin.on('data', async (chunk) => {
  buffer += chunk;
  
  // Check if we have complete JSON-RPC messages
  const lines = buffer.split('\n');
  buffer = lines.pop() || ''; // Keep incomplete line in buffer
  
  for (const line of lines) {
    if (line.trim()) {
      let messageId = null;
      
      try {
        const message = JSON.parse(line);
        messageId = message.id;
        
        // Validate basic JSON-RPC structure
        if (!message.jsonrpc || message.jsonrpc !== '2.0') {
          throw new Error('Invalid JSON-RPC version');
        }
        
        if (!message.method && !message.result && !message.error) {
          throw new Error('Invalid JSON-RPC message structure');
        }
        
        // Forward to HTTP server
        const response = await fetch(MCP_SERVER_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.MCP_ACCESS_TOKEN && {
              'Authorization': `Bearer ${process.env.MCP_ACCESS_TOKEN}`
            })
          },
          body: JSON.stringify(message)
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        // Ensure response has proper JSON-RPC structure
        if (!result.jsonrpc) {
          result.jsonrpc = '2.0';
        }
        if (result.id === undefined && messageId !== undefined) {
          result.id = messageId;
        }
        
        process.stdout.write(JSON.stringify(result) + '\n');
        
      } catch (error) {
        // Send properly formatted error response
        const errorResponse = {
          jsonrpc: '2.0',
          id: messageId,
          error: {
            code: -32603,
            message: `Bridge error: ${error.message}`
          }
        };
        process.stdout.write(JSON.stringify(errorResponse) + '\n');
      }
    }
  }
});

process.stdin.on('end', () => {
  process.exit(0);
});

// Handle process termination
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));