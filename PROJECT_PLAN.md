# MCP Memory Server Project Plan

## Overview
An MCP (Model Context Protocol) server that provides persistent memory capabilities for AI agents, with a web UI for browsing and managing memories. Built on Cloudflare's stack for global distribution and scalability.

## Tech Stack
- **MCP Server**: Cloudflare Workers + TypeScript + @modelcontextprotocol/sdk
- **Storage**: Cloudflare Durable Objects + Vectorize (vector database)
- **Web UI**: Next.js with server-side rendering
- **Authentication**: Cloudflare Access + Google OAuth2
- **Language**: TypeScript throughout

## Project Structure
```
mcp-memory/
├── src/
│   ├── shared/              # Shared by concept
│   │   ├── memory/          # All memory-related shared code
│   │   │   ├── types.ts     # Memory types, labels included
│   │   │   ├── storage.ts   # Storage interface + Durable Objects
│   │   │   ├── constants.ts # Namespaces, limits, defaults
│   │   │   └── utils.ts     # Memory utilities
│   │   ├── api/             # HTTP API contracts
│   │   │   ├── routes.ts    # API endpoint definitions
│   │   │   ├── types.ts     # Request/response types
│   │   │   └── client.ts    # Typed API client
│   │   ├── auth/
│   │   │   ├── types.ts     # Auth types
│   │   │   └── oauth.ts     # OAuth utilities
│   │   └── validation/
│   │       └── schemas.ts   # Zod schemas for validation
│   │
│   ├── mcp-server/          # Cloudflare Worker MCP server
│   │   ├── index.ts         # Worker entry point (handles both MCP + HTTP)
│   │   ├── mcp/
│   │   │   └── tools.ts     # MCP memory tools
│   │   └── api/
│   │       └── routes.ts    # HTTP API route handlers
│   │
│   └── web-ui/              # Next.js web interface  
│       ├── app/
│       │   ├── page.tsx     # Main memory browser
│       │   └── api/         # Next.js API routes (proxy to CF Worker)
│       └── components/
│           └── memory/      # Memory UI components
│
├── wrangler.toml
├── next.config.js  
├── package.json
└── README.md
```

## Core Features

### Memory Management
- **Dynamic Namespaces**: Users can create custom namespaces (relationships, projects, people, recipes, etc.)
- **Vector Storage**: Memories stored with embeddings for semantic search
- **Labels**: Part of memory objects, not separate entities
- **CRUD Operations**: Create, read, update, delete memories via MCP tools

### MCP Server Capabilities
- **Memory Tools**: Store, retrieve, search, and manage memories
- **Vector Search**: Semantic similarity search across memories
- **Namespace Management**: Dynamic namespace creation and management
- **HTTP API**: RESTful endpoints for web UI access

### Web UI Features
- **Memory Browser**: Browse memories by namespace
- **Search Interface**: Vector-based and text-based search
- **Memory Management**: Add, edit, delete memories
- **Namespace Overview**: Visual organization of memory namespaces

### Authentication & Security
- **Google OAuth2**: Integration via Cloudflare Access
- **User Isolation**: Each user's memories are completely isolated
- **Secure Access**: All requests authenticated and authorized

## Implementation Phases

### Phase 1: Core Infrastructure
1. Set up Cloudflare Worker with MCP SDK
2. Implement basic Durable Objects for memory storage
3. Create fundamental memory types and validation schemas
4. Basic MCP tool registration

### Phase 2: Memory Storage
1. Implement vector storage with Cloudflare Vectorize
2. Create memory CRUD operations
3. Add namespace management
4. Implement vector similarity search

### Phase 3: HTTP API
1. Add HTTP route handling to Worker
2. Implement REST endpoints for web UI
3. Create typed API client
4. Add request validation

### Phase 4: Authentication
1. Set up Cloudflare Access with Google OAuth2
2. Implement user session management
3. Add user isolation to storage layer
4. Secure all endpoints

### Phase 5: Web UI
1. Create Next.js application structure
2. Implement memory browsing interface
3. Add search functionality
4. Create memory management forms

### Phase 6: Polish & Deploy
1. Add error handling and logging
2. Performance optimization
3. UI/UX improvements
4. Documentation and testing

## Key Technical Decisions

### Unified Worker Architecture
The Cloudflare Worker serves dual purposes:
- **MCP Protocol Handler**: For AI agent connections
- **HTTP API Server**: For web UI requests

### Concept-Based Sharing
Shared code organized by domain concepts (memory, auth, api) rather than technical layers, keeping related functionality together.

### Storage Strategy
- **Durable Objects**: For transactional memory operations
- **Vectorize**: For vector similarity search
- **User Isolation**: Each user gets isolated storage namespaces

### Authentication Flow
- Google OAuth2 via Cloudflare Access
- Session tokens for API authentication
- User context available in both MCP and HTTP handlers