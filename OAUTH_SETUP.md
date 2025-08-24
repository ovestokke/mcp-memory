# OAuth2 Authentication Setup for MCP Memory Server

This guide explains how to set up OAuth2 authentication for the MCP Memory Server using Google as the identity provider.

## Overview

The MCP Memory Server now requires OAuth2 authentication for all memory operations. The server:

- ✅ **Secures all endpoints** with Bearer token authentication
- ✅ **Uses Google OAuth2** for identity verification  
- ✅ **Restricts CORS** to trusted origins only
- ✅ **Validates user identity** before accessing memories
- ✅ **Provides MCP tools** over HTTP with JSON-RPC protocol

## Architecture

```
Claude/MCP Client → OAuth2 Flow → Bearer Token → MCP Memory Server → Durable Objects
                     ↓
                Google OAuth2 
```

## Setup Instructions

### 1. Google OAuth2 Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to "Credentials" → "Create credentials" → "OAuth 2.0 Client ID"
5. Choose "Web application"
6. Add authorized redirect URIs:
   - `http://localhost:8787/auth/callback` (for local development)
   - `https://your-worker-subdomain.your-username.workers.dev/auth/callback` (for production)
7. Note down the **Client ID** and **Client Secret**

### 2. Cloudflare Worker Deployment

#### Development Setup
```bash
# Install dependencies
npm install

# Set up OAuth secrets for local development
export GOOGLE_CLIENT_ID="your-client-id"
export GOOGLE_CLIENT_SECRET="your-client-secret"

# Start local development server
npm run dev:server
```

#### Production Deployment
```bash
# Set production secrets
wrangler secret put GOOGLE_CLIENT_ID
# Enter your Google Client ID when prompted

wrangler secret put GOOGLE_CLIENT_SECRET  
# Enter your Google Client Secret when prompted

# Deploy to Cloudflare Workers
wrangler deploy
```

### 3. Domain Configuration

Update the allowed origins in `src/mcp-server/index.ts`:

```typescript
const allowedOrigins = [
  'https://your-production-domain.com',  // Your production domain
  'http://localhost:3002',               // Development web UI
  'https://claude.ai',                   // Claude.ai (if needed)
];
```

## Authentication Flow

### For MCP Clients

1. **Get Authorization URL**
   ```bash
   curl -X GET "https://your-worker.workers.dev/auth"
   ```
   Response:
   ```json
   {
     "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...",
     "message": "Visit this URL to authenticate with Google"
   }
   ```

2. **Complete OAuth Flow**
   - Visit the authorization URL
   - Authorize the application
   - Copy the authorization code from the callback

3. **Exchange Code for Token**
   ```bash
   curl -X POST "https://your-worker.workers.dev/auth/callback" \
        -H "Content-Type: application/json" \
        -d '{"code": "your-authorization-code"}'
   ```
   Response:
   ```json
   {
     "access_token": "ya29.a0AfH6...",
     "expires_in": 3600,
     "refresh_token": "1//0G...",
     "user": {
       "id": "123456789",
       "email": "user@gmail.com",
       "name": "User Name"
     }
   }
   ```

4. **Use Bearer Token for MCP Calls**
   ```bash
   curl -X POST "https://your-worker.workers.dev/mcp" \
        -H "Authorization: Bearer ya29.a0AfH6..." \
        -H "Content-Type: application/json" \
        -d '{
          "jsonrpc": "2.0",
          "id": 1,
          "method": "tools/list"
        }'
   ```

## MCP Tools Available

Once authenticated, the following MCP tools are available:

| Tool | Description |
|------|-------------|
| `store_memory` | Store a new memory with content, namespace, and labels |
| `search_memories` | Search memories using semantic similarity or filters |
| `list_memories` | List all memories, optionally filtered by namespace |
| `delete_memory` | Delete a memory by its ID |
| `create_namespace` | Create a new namespace for organizing memories |
| `list_namespaces` | List all available namespaces |

### Example Tool Usage

```bash
# Store a memory
curl -X POST "https://your-worker.workers.dev/mcp" \
     -H "Authorization: Bearer your-token" \
     -H "Content-Type: application/json" \
     -d '{
       "jsonrpc": "2.0",
       "id": 1,
       "method": "tools/call",
       "params": {
         "name": "store_memory",
         "arguments": {
           "content": "Important meeting notes from today",
           "namespace": "work",
           "labels": ["meeting", "important"]
         }
       }
     }'

# Search memories
curl -X POST "https://your-worker.workers.dev/mcp" \
     -H "Authorization: Bearer your-token" \
     -H "Content-Type: application/json" \
     -d '{
       "jsonrpc": "2.0",
       "id": 2,
       "method": "tools/call",
       "params": {
         "name": "search_memories",
         "arguments": {
           "query": "meeting notes",
           "limit": 10
         }
       }
     }'
```

## Security Features

- **Bearer Token Authentication**: All MCP endpoints require valid OAuth2 tokens
- **Token Validation**: Tokens are validated with Google's OAuth2 API on every request
- **Email Verification Required**: Only verified Google accounts can access the server
- **CORS Restrictions**: Only allowed origins can make cross-origin requests
- **User Isolation**: Each user can only access their own memories
- **Request Logging**: All authentication attempts and tool calls are logged

## Troubleshooting

### Common Issues

1. **"Invalid or expired token"**
   - Token may have expired (Google tokens expire after 1 hour)
   - Get a new token using the refresh token or re-authenticate

2. **"Email address is not verified"**
   - Ensure your Google account has a verified email address
   - Check Google Account settings

3. **CORS errors**
   - Ensure your client origin is in the `allowedOrigins` list
   - Check that you're sending the `Origin` header correctly

4. **"Authorization header with Bearer token is required"**
   - Make sure you include `Authorization: Bearer your-token` header
   - Verify the token format is correct

### Development Tips

- Use `wrangler tail` to view real-time logs during development
- Test authentication flow manually before integrating with MCP clients
- Keep tokens secure and never log them in production
- Use environment-specific origins for CORS configuration

## Next Steps

1. Test the authentication flow manually
2. Integrate with your MCP client
3. Set up monitoring and logging
4. Configure production domains and CORS
5. Consider implementing refresh token handling for long-lived clients