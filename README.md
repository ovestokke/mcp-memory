# MCP Memory Server

A production-ready MCP (Model Context Protocol) server that provides persistent memory capabilities for AI agents, with secure OAuth2 authentication and global scalability powered by Cloudflare's edge network.

## ✨ Features

- **🧠 Persistent Memory**: Store, search, and organize memories with semantic similarity
- **🔐 OAuth2 Security**: Google OAuth2 authentication with Bearer tokens
- **🌍 Global Scale**: Built on Cloudflare Workers for worldwide distribution
- **🔍 Vector Search**: Semantic similarity search using Cloudflare Vectorize
- **📁 Namespaces**: Organize memories by topic, project, or context
- **🏷️ Labels**: Tag and categorize memories for easy retrieval
- **🔒 User Isolation**: Each user has completely isolated storage

## 🏗️ Architecture

```
Claude/MCP Client → OAuth2 Flow → Bearer Token → MCP Memory Server → Durable Objects
                     ↓                            ↓
                Google OAuth2                 Cloudflare Vectorize
```

- **Cloudflare Workers**: Serverless runtime for the MCP server
- **Durable Objects**: Persistent SQLite storage for each user
- **Vectorize**: Vector database for semantic similarity search
- **HTTP Transport**: MCP protocol over HTTP using JSON-RPC 2.0

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Cloudflare account
- Google Cloud Console project with OAuth2 credentials

### 1. Installation

```bash
git clone https://github.com/your-repo/mcp-memory
cd mcp-memory
npm install
```

### 2. Google OAuth2 Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable the Google+ API
4. Create OAuth2 credentials:
   - **Type**: Web application
   - **Authorized redirect URIs**: `https://your-worker.workers.dev/auth/callback`
5. Note your Client ID and Client Secret

### 3. Development Setup

```bash
# Set environment variables
export GOOGLE_CLIENT_ID="your-client-id"
export GOOGLE_CLIENT_SECRET="your-client-secret"

# Start development server
npm run dev:server
```

### 4. Production Deployment

```bash
# Set production secrets
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET

# Deploy to Cloudflare Workers
wrangler deploy
```

## 📖 Usage

### Authentication Flow

1. **Get Authorization URL**
   ```bash
   curl https://your-worker.workers.dev/auth
   ```

2. **Complete OAuth Flow**
   - Visit the returned auth URL
   - Authorize with Google
   - Copy the authorization code

3. **Exchange Code for Token**
   ```bash
   curl -X POST https://your-worker.workers.dev/auth/callback \
        -H "Content-Type: application/json" \
        -d '{"code": "your-auth-code"}'
   ```

4. **Use Bearer Token for MCP Calls**
   ```bash
   curl -X POST https://your-worker.workers.dev/mcp \
        -H "Authorization: Bearer your-token" \
        -H "Content-Type: application/json" \
        -d '{
          "jsonrpc": "2.0",
          "id": 1,
          "method": "tools/call",
          "params": {
            "name": "store_memory",
            "arguments": {
              "content": "Important meeting notes",
              "namespace": "work",
              "labels": ["meeting", "important"]
            }
          }
        }'
   ```

### Available MCP Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `store_memory` | Store a new memory | `content`, `namespace?`, `labels?` |
| `search_memories` | Search memories by similarity | `query?`, `namespace?`, `labels?`, `limit?` |
| `list_memories` | List all memories | `namespace?` |
| `delete_memory` | Delete memory by ID | `memory_id` |
| `create_namespace` | Create memory namespace | `name`, `description?` |
| `list_namespaces` | List all namespaces | - |

## 🛡️ Security Features

- **OAuth2 Authentication**: All endpoints except health check require valid tokens
- **Token Validation**: Real-time verification with Google's userinfo API
- **User Isolation**: Each user can only access their own memories
- **CORS Protection**: Restricted to trusted origins only
- **Request Logging**: All authentication attempts and tool calls are logged
- **Email Verification**: Only verified Google accounts can access

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- src/mcp-server/__tests__/index.test.ts
```

Test coverage includes:
- OAuth2 authentication flows
- MCP tool functionality
- CORS configuration
- Error handling
- User isolation

## 📁 Project Structure

```
mcp-memory/
├── src/
│   ├── shared/                 # Shared utilities
│   │   ├── auth/              # OAuth2 implementation
│   │   ├── memory/            # Memory storage logic
│   │   ├── mcp/               # MCP HTTP server
│   │   ├── utils/             # Logging and utilities
│   │   └── validation/        # Zod schemas
│   └── mcp-server/            # Cloudflare Worker
│       ├── index.ts           # Main worker entry point
│       └── __tests__/         # Test suite
├── OAUTH_SETUP.md             # Detailed OAuth setup guide
├── PROJECT_PLAN.md            # Technical architecture docs
└── wrangler.jsonc.example     # Cloudflare configuration
```

## 🔧 Configuration

### Environment Variables

- `GOOGLE_CLIENT_ID`: Google OAuth2 client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth2 client secret
- `ENVIRONMENT`: `development` or `production`

### Cloudflare Resources

- **Vectorize Index**: `memory-embeddings`
- **Durable Object**: `MemoryStorage`

## 📚 Documentation

- [OAuth2 Setup Guide](OAUTH_SETUP.md) - Detailed authentication setup
- [Project Plan](PROJECT_PLAN.md) - Technical architecture and implementation status
- [API Documentation](OAUTH_SETUP.md#mcp-tools-available) - Complete MCP tool reference

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Troubleshooting

### Common Issues

1. **"Invalid or expired token"**
   - Tokens expire after 1 hour, re-authenticate to get a new token

2. **"Email address is not verified"**
   - Ensure your Google account has a verified email address

3. **CORS errors**
   - Check that your client origin is in the allowed origins list

4. **Build errors**
   - Run `npm run test` to ensure all tests pass before deployment

### Support

For support, please open an issue on GitHub or refer to the comprehensive documentation in the repository.