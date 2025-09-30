# Implementation Plan: Full MCP Memory Server

## Overview
Extend the current basic `create_memory` tool to support all 9 tools from the official MCP memory server implementation, with user-scoped data isolation and persistent storage.

## Current State
- ✅ OAuth 2.1 + PKCE authentication flow
- ✅ NextAuth.js for web authentication
- ✅ Basic MCP server with single `create_memory` tool
- ✅ JWT-based token verification
- ✅ File-based JSON storage (simple, works for current needs)
- ⚠️ No knowledge graph implementation (entities, relations, observations)

## Storage Strategy

**Current**: File-based JSON storage in `/app/data` (Docker volume)
- ✅ Simple, no dependencies
- ✅ Works perfectly for basic memory tool
- ✅ Easy to backup and migrate
- ⚠️ Not suitable for complex graph queries

**Future Options** (Phase 1):
- **PostgreSQL** - Best for ACID compliance, relational integrity, proven scalability
- **Neo4j** - Optimal for graph traversal, relationship queries, visual exploration
- **Hybrid** - PostgreSQL for data + Neo4j for graph queries

Choose based on:
1. Query patterns (simple lookups vs. complex graph traversal)
2. Scale requirements (thousands vs. millions of entities)
3. Operational complexity (managed service availability)

## Target State
Full-featured knowledge graph memory system with:
- 9 MCP tools (entities, relations, observations management)
- User-scoped data isolation
- Persistent database storage
- Search and retrieval capabilities

---

## Phase 1: Database Schema & Models

### 1.1 Set up Prisma ORM
- [ ] Install Prisma dependencies (`prisma`, `@prisma/client`)
- [ ] Initialize Prisma with PostgreSQL
- [ ] Create `prisma/schema.prisma`

### 1.2 Define Database Schema
Create tables for:
- [ ] `User` - Store user information from OAuth
- [ ] `Entity` - Knowledge graph entities
  - `id` (UUID, primary key)
  - `userId` (foreign key to User)
  - `name` (string, unique per user)
  - `entityType` (string)
  - `createdAt`, `updatedAt` (timestamps)
- [ ] `Observation` - Entity observations
  - `id` (UUID, primary key)
  - `entityId` (foreign key to Entity)
  - `content` (text)
  - `createdAt` (timestamp)
- [ ] `Relation` - Entity relationships
  - `id` (UUID, primary key)
  - `userId` (foreign key to User)
  - `fromEntityId` (foreign key to Entity)
  - `toEntityId` (foreign key to Entity)
  - `relationType` (string)
  - `createdAt` (timestamp)
  - Unique constraint on (userId, fromEntityId, toEntityId, relationType)

### 1.3 Generate Prisma Client
- [ ] Run `npx prisma generate`
- [ ] Run `npx prisma migrate dev --name init_memory_schema`
- [ ] Create database client singleton (`/src/lib/db.ts`)

---

## Phase 2: Data Access Layer

### 2.1 Create Repository Pattern
Create `/src/lib/memory/repository.ts` with functions:
- [ ] `createEntities(userId, entities[])`
- [ ] `createRelations(userId, relations[])`
- [ ] `addObservations(userId, observations[])`
- [ ] `deleteEntities(userId, entityNames[])`
- [ ] `deleteObservations(userId, deletions[])`
- [ ] `deleteRelations(userId, relations[])`
- [ ] `readGraph(userId)`
- [ ] `searchNodes(userId, query)`
- [ ] `openNodes(userId, names[])`

### 2.2 Implement Graph Operations
- [ ] Entity CRUD with duplicate name handling
- [ ] Relation CRUD with duplicate prevention
- [ ] Observation management
- [ ] Cascading deletes (entities → relations)
- [ ] Full-text search across names, types, and observations

### 2.3 Add Type Definitions
Create `/src/lib/memory/types.ts`:
- [ ] `Entity` interface
- [ ] `Relation` interface
- [ ] `KnowledgeGraph` interface
- [ ] Zod schemas for validation

---

## Phase 3: MCP Tool Implementation

### 3.1 Update MCP Server Handler
Modify `/src/app/api/mcp/route.ts`:

- [ ] **Tool: create_entities**
  - Input: `entities: { name, entityType, observations }[]`
  - Validates entity structure
  - Ignores duplicates by name
  - Returns created entities

- [ ] **Tool: create_relations**
  - Input: `relations: { from, to, relationType }[]`
  - Validates both entities exist
  - Prevents duplicate relations
  - Returns created relations

- [ ] **Tool: add_observations**
  - Input: `observations: { entityName, contents }[]`
  - Validates entities exist
  - Adds observations to existing entities
  - Returns updated entities

- [ ] **Tool: delete_entities**
  - Input: `entityNames: string[]`
  - Cascades to delete related observations and relations
  - Returns deleted entity names

- [ ] **Tool: delete_observations**
  - Input: `deletions: { entityName, observations }[]`
  - Removes specific observation strings
  - Silently skips non-existent observations
  - Returns confirmation

- [ ] **Tool: delete_relations**
  - Input: `relations: { from, to, relationType }[]`
  - Removes matching relations
  - Silently skips non-existent relations
  - Returns confirmation

- [ ] **Tool: read_graph**
  - No input parameters
  - Returns complete user's knowledge graph
  - Format: `{ entities: [], relations: [] }`

- [ ] **Tool: search_nodes**
  - Input: `query: string`
  - Searches entity names, types, and observation content
  - Returns matching entities with their relations

- [ ] **Tool: open_nodes**
  - Input: `names: string[]`
  - Retrieves specific entities by name
  - Returns entities with their relations

### 3.2 Extract User Context
- [ ] Modify `verifyToken` to extract and pass `userId` (from JWT `sub`)
- [ ] Update tool handlers to receive authenticated user context
- [ ] Ensure all operations are scoped to authenticated user

### 3.3 Remove Old Tool
- [ ] Remove basic `create_memory` tool
- [ ] Remove `memories` resource (or adapt to use new graph)

---

## Phase 4: Authentication Integration

### 4.1 Update JWT Payload
- [ ] Ensure `sub` field contains user ID in authorization code
- [ ] Verify access tokens include user ID for scoping

### 4.2 User Management
- [ ] Create user record on first OAuth sign-in (NextAuth callback)
- [ ] Update `/src/auth.ts` with Prisma adapter or custom user creation
- [ ] Ensure consistent user IDs between web auth and API auth

### 4.3 Authorization Checks
- [ ] Verify all repository functions enforce user scoping
- [ ] Add integration tests for cross-user data isolation
- [ ] Document security model in README

---

## Phase 5: Testing & Validation

### 5.1 Unit Tests
- [ ] Test repository functions with mock database
- [ ] Test tool input validation with Zod schemas
- [ ] Test PKCE verification and token flows

### 5.2 Integration Tests
- [ ] Test complete OAuth flow → tool execution
- [ ] Test knowledge graph operations (create, read, update, delete)
- [ ] Test search functionality
- [ ] Verify user data isolation

### 5.3 Manual Testing
- [ ] Test with MCP Inspector (`npx @modelcontextprotocol/inspector`)
- [ ] Test with Claude Desktop client
- [ ] Verify all 9 tools work end-to-end

---

## Phase 6: Documentation & Deployment

### 6.1 Update Documentation
- [ ] Update `CLAUDE.md` with new architecture
- [ ] Document all 9 tools and their parameters
- [ ] Add database setup instructions
- [ ] Add example usage scenarios

### 6.2 Environment Configuration
- [ ] Document required environment variables
- [ ] Add `DATABASE_URL` configuration
- [ ] Update `.env.example` if needed

### 6.3 Deployment Preparation
- [ ] Add database migration instructions
- [ ] Document production deployment steps
- [ ] Consider connection pooling for Prisma in serverless

---

## Dependencies to Add

```json
{
  "dependencies": {
    "@prisma/client": "^6.x"
  },
  "devDependencies": {
    "prisma": "^6.x"
  }
}
```

---

## File Structure Changes

```
src/
├── lib/
│   ├── memory/
│   │   ├── repository.ts      (NEW - database operations)
│   │   ├── types.ts           (NEW - TypeScript interfaces)
│   │   └── search.ts          (NEW - search logic)
│   └── db.ts                  (NEW - Prisma client singleton)
├── app/
│   └── api/
│       └── mcp/
│           └── route.ts       (MODIFY - add all 9 tools)
prisma/
├── schema.prisma              (NEW - database schema)
└── migrations/                (NEW - migration files)
```

---

## Estimated Effort

- **Phase 1**: 2-3 hours (schema design, Prisma setup)
- **Phase 2**: 3-4 hours (repository implementation)
- **Phase 3**: 4-5 hours (tool implementation, validation)
- **Phase 4**: 1-2 hours (auth integration)
- **Phase 5**: 2-3 hours (testing)
- **Phase 6**: 1-2 hours (documentation)

**Total**: ~15-20 hours

---

## Risk Mitigation

1. **Database connection in serverless**: Use Prisma Data Proxy or connection pooling
2. **Search performance**: Add database indexes on entity names and observation content
3. **Data migration**: Consider export/import tools if switching storage backends
4. **Breaking changes**: Version the API if deploying to production with existing users

---

## Success Criteria

✅ All 9 tools from reference implementation work correctly
✅ User data is properly isolated by authentication
✅ Knowledge graph persists across sessions
✅ Search returns relevant results
✅ Performance is acceptable for typical usage (<500ms per operation)
✅ Documentation is complete and accurate