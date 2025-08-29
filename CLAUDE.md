# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production with Turbopack
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Architecture Overview

This is a Next.js 15 application that implements an **MCP (Model Context Protocol) server** for memory management with **OAuth 2.1 + PKCE authentication**.

### Key Components

**MCP Server Implementation**
- `/src/app/api/[transport]/route.ts` - Main MCP handler using `createMcpHandler` with OAuth authentication
- Exposes a `create_memory` tool for storing user memories
- Uses `mcp-handler` package with `withMcpAuth` wrapper for secure access
- Supports dynamic routing for different transport methods

**OAuth 2.1 + PKCE Authentication Flow**
- **Authorization Server**: Implements OAuth 2.1 with PKCE for MCP client authentication
- **Web Authentication**: NextAuth.js v5 beta with Google OAuth for web users
- **Dual Authentication**: Separate auth systems for web users vs API clients

**OAuth API Endpoints**
- `/api/authorize` - OAuth authorization endpoint with PKCE support
- `/api/token` - Token exchange endpoint with PKCE verification  
- `/api/oauth/register` - Dynamic Client Registration (RFC 7591)
- `/.well-known/oauth-authorization-server` - OAuth server metadata
- `/.well-known/oauth-protected-resource` - Protected resource metadata

**Authentication Architecture**
- **Web Auth**: NextAuth.js sessions for web interface (`/src/auth.ts`)
- **API Auth**: JWT-based OAuth tokens for MCP clients (`/src/lib/jwt/`)
- **PKCE Implementation**: Code challenge/verifier validation (`/src/lib/oauth/`)
- **Middleware**: Request logging and auth handling (`/src/middleware.ts`)

**Tech Stack**
- Next.js 15 with Turbopack
- React 19
- NextAuth.js v5 beta (web auth)
- JWT/JOSE for OAuth tokens
- TypeScript 5
- Tailwind CSS v4
- Zod for schema validation
- MCP SDK and mcp-handler for protocol implementation

**Environment Configuration**
- `DATABASE_URL` - PostgreSQL connection (port 5433)
- `NEXTAUTH_SECRET` & `NEXTAUTH_URL` - NextAuth configuration
- `AUTH_GOOGLE_ID` & `AUTH_GOOGLE_SECRET` - Google OAuth credentials
- `JWT_SECRET` - For signing OAuth JWTs
- `OAUTH_JWT_SECRET` - Additional OAuth security
- `OPENAI_API_KEY` - For future embeddings integration

### MCP Protocol Implementation

The server implements a complete MCP server with OAuth 2.1 security:

1. **Client Registration**: Dynamic registration generates client IDs
2. **Authorization Flow**: PKCE-secured OAuth with browser redirect
3. **Token Exchange**: Authorization codes exchanged for access tokens
4. **Authenticated Requests**: Bearer token validation for MCP endpoints
5. **Tool Execution**: Secure access to `create_memory` tool

### Import Aliases

Using '@' as alias for src/ directory:
- `@/env` → `src/env.ts`  
- `@/lib/jwt` → `src/lib/jwt/`
- `@/auth` → `src/auth.ts`