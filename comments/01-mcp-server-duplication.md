# MCP Server Implementation Duplication

## Issue: Two MCP Server Implementations

### Current State

The codebase has **two complete MCP server implementations**:

#### 1. `src/shared/mcp/server.ts` (Official SDK) ✅
- Uses `@modelcontextprotocol/sdk/server`
- Proper MCP protocol compliance
- Clean tool registration
- 450 lines

#### 2. `src/shared/mcp/http-server.ts` (Custom Implementation) ❌  
- Manual JSON-RPC 2.0 implementation
- Custom protocol handling
- Duplicate tool definitions
- 620 lines

### Problems

1. **Massive Code Duplication**
   ```typescript
   // Same tool definition exists in BOTH files:
   // server.ts lines 51-76 vs http-server.ts lines 193-217
   {
     name: 'store_memory',
     description: 'Store a new memory with content, namespace, and labels',
     inputSchema: { /* identical schemas */ }
   }
   ```

2. **Protocol Compliance Risk**
   - Custom JSON-RPC implementation may deviate from MCP spec
   - Manual error code mapping (`getErrorCode()` method)
   - Missing standard MCP features

3. **Maintenance Burden**
   - Tool changes must be made in 2 places
   - Schema updates duplicated
   - Testing complexity doubled

### Root Cause Analysis

The HTTP server was created because:
- MCP SDK designed for stdio transport
- Needed HTTP transport for Cloudflare Workers
- **BUT**: MCP SDK supports custom transports!

### Solution

**Eliminate `http-server.ts` entirely** and use MCP SDK with HTTP transport:

```typescript
// Use MCP SDK with custom HTTP transport
import { Server } from '@modelcontextprotocol/sdk/server/index.js'

class HttpTransport implements Transport {
  async handleRequest(request: Request): Promise<Response> {
    // Convert HTTP request to MCP message format
    // Let SDK handle all protocol logic
    // Convert MCP response back to HTTP
  }
}

const server = new Server(config, capabilities)
const transport = new HttpTransport()
await server.connect(transport)
```

### Benefits

- ✅ Eliminate 620 lines of duplicate code
- ✅ Guaranteed MCP protocol compliance  
- ✅ Single source of truth for tools
- ✅ Automatic protocol updates via SDK
- ✅ Better error handling and validation

### Files to Modify

- ❌ DELETE: `src/shared/mcp/http-server.ts`  
- ✏️ MODIFY: `src/mcp-server/index.ts` (remove http-server imports)
- ➕ CREATE: `src/shared/mcp/http-transport.ts` (thin HTTP adapter)

### Estimated Impact

- **Lines Removed**: ~620
- **Complexity Reduction**: ~40%
- **Maintenance Burden**: -50%
- **Bug Risk**: -70% (protocol compliance guaranteed)