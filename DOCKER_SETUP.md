# Docker Setup & Claude Desktop Integration

## Prerequisites

- Docker and Docker Compose installed
- Google OAuth credentials (for web login)
- Claude Desktop app installed

## Current Storage

Currently uses **file-based JSON storage** in a Docker volume (`/app/data`). This is sufficient for the basic `create_memory` tool.

When implementing the full knowledge graph (see `IMPLEMENTATION_PLAN.md`), you can migrate to:
- **PostgreSQL** - Good for relational data, ACID compliance
- **Neo4j** - Optimal for graph traversal and complex relationships
- **Other** - MongoDB, Redis, etc.

## Setup Instructions

### 1. Environment Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` and set the following:

```bash
# Generate secrets (min 32 chars each):
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
JWT_SECRET="$(openssl rand -base64 32)"

# Google OAuth (get from https://console.cloud.google.com/apis/credentials)
AUTH_GOOGLE_ID="your-google-client-id.apps.googleusercontent.com"
AUTH_GOOGLE_SECRET="your-google-client-secret"

# URLs
NEXTAUTH_URL="http://localhost:3000"
```

### 2. Build and Start Services

```bash
# Build and start the application
docker-compose up --build

# Or run in detached mode:
docker-compose up -d --build
```

The application will be available at:
- **Web UI**: http://localhost:3000
- **SSE Endpoint**: http://localhost:3000/api/mcp (for Claude Desktop)

### 3. Verify the Application

1. Open http://localhost:3000 in your browser
2. Sign in with Google (you'll need to authorize the OAuth app first)
3. Check logs: `docker-compose logs -f app`

### 4. Configure Claude Desktop

#### 4.1 OAuth Client Registration

First, register a new OAuth client by making a POST request:

```bash
curl -X POST http://localhost:3000/register \
  -H "Content-Type: application/json" \
  -d '{
    "redirect_uris": ["http://127.0.0.1/"],
    "client_name": "Claude Desktop"
  }'
```

Save the `client_id` from the response.

#### 4.2 Update Claude Desktop Config

Edit your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add the following configuration:

```json
{
  "mcpServers": {
    "memory": {
      "url": "http://localhost:3000/api/mcp",
      "transport": {
        "type": "sse"
      },
      "auth": {
        "type": "oauth2",
        "client_id": "YOUR_CLIENT_ID_FROM_REGISTRATION",
        "authorization_url": "http://localhost:3000/authorize",
        "token_url": "http://localhost:3000/token"
      }
    }
  }
}
```

Replace `YOUR_CLIENT_ID_FROM_REGISTRATION` with the client_id you received.

#### 4.3 Restart Claude Desktop

Restart Claude Desktop to apply the configuration changes.

#### 4.4 Authenticate

When you start a conversation, Claude Desktop will:
1. Open your browser for OAuth authorization
2. You'll sign in with Google (if not already signed in)
3. Redirect back to Claude Desktop with an authorization code
4. Claude Desktop exchanges the code for an access token

After authentication, Claude can use the `create_memory` tool.

## Testing the MCP Server

### Test with MCP Inspector

```bash
# Install MCP Inspector
npm install -g @modelcontextprotocol/inspector

# Test the SSE endpoint (after getting a token)
npx @modelcontextprotocol/inspector http://localhost:3000/api/mcp
```

### Test OAuth Flow Manually

1. **Register Client**:
```bash
curl -X POST http://localhost:3000/register \
  -H "Content-Type: application/json" \
  -d '{"redirect_uris": ["http://localhost:8080/callback"]}'
```

2. **Generate PKCE Challenge** (in Node.js):
```javascript
const crypto = require('crypto');
const verifier = crypto.randomBytes(32).toString('base64url');
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
console.log('Verifier:', verifier);
console.log('Challenge:', challenge);
```

3. **Authorize** (open in browser):
```
http://localhost:3000/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:8080/callback&response_type=code&code_challenge=YOUR_CHALLENGE&code_challenge_method=S256&state=random_state
```

4. **Exchange Code for Token**:
```bash
curl -X POST http://localhost:3000/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=YOUR_AUTH_CODE&client_id=YOUR_CLIENT_ID&code_verifier=YOUR_VERIFIER&redirect_uri=http://localhost:8080/callback"
```

5. **Use the Access Token**:
```bash
curl http://localhost:3000/api/mcp \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

## Available MCP Tools

Currently available:
- `create_memory` - Creates a memory for the user

## Troubleshooting

### Port Conflicts

If port 3000 or 5433 is already in use, modify `docker-compose.yml`:

```yaml
services:
  app:
    ports:
      - "3001:3000"  # Change external port
  postgres:
    ports:
      - "5434:5432"  # Change external port
```

### OAuth Redirect Issues

Ensure your Google OAuth app has the correct redirect URIs:
- `http://localhost:3000/api/auth/callback/google`

### Data Persistence

Memories are stored in a Docker volume. To view/backup data:
```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect mcp-memory_memory_data

# Backup data
docker run --rm -v mcp-memory_memory_data:/data -v $(pwd):/backup alpine tar czf /backup/memory-backup.tar.gz -C /data .
```

### SSE Connection Issues

1. Check CORS headers in browser DevTools
2. Verify the endpoint: `curl -v http://localhost:3000/api/mcp`
3. Check app logs: `docker-compose logs -f app`

### Claude Desktop Not Connecting

1. Check Claude Desktop logs (varies by OS)
2. Verify client_id matches the registered client
3. Try re-registering the OAuth client
4. Ensure you're signed in to the web UI first

## Stopping Services

```bash
# Stop services (keeps data)
docker-compose down

# Stop and remove volumes (removes database)
docker-compose down -v
```

## Development Mode

To run without Docker for development:

```bash
# Install dependencies
npm install

# Run Next.js in dev mode
npm run dev
```

Memories will be stored in `./data` directory when running locally.

## Next Steps

See `IMPLEMENTATION_PLAN.md` for implementing the full knowledge graph features with all 9 MCP tools.