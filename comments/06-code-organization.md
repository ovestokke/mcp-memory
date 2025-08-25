# Code Organization & Architecture Issues

## Issue: Good Structure with Minor Improvements

### Current Architecture ✅

The project follows a **good concept-based organization**:

```
src/
├── shared/           # Shared by concept (good!)
│   ├── memory/       # All memory-related code
│   ├── auth/         # Authentication logic  
│   ├── mcp/          # MCP protocol handling
│   ├── utils/        # Utilities
│   └── validation/   # Schema validation
├── mcp-server/       # Cloudflare Worker
└── web-ui/           # Next.js application
```

**This is actually well done!** Most codebases organize by technical layer (controllers, services, models) which creates scattered domain logic.

### Minor Issues to Address

#### 1. Test File Organization

**Current**: Tests scattered in `__tests__` folders
```
src/shared/memory/__tests__/storage.test.ts
src/shared/auth/__tests__/oauth.test.ts
src/web-ui/components/memory/__tests__/MemoryForm.test.tsx
tests/e2e/memory-management.spec.ts
tests/unit/components/memory/MemoryCard.test.tsx  # Duplicate location!
```

**Problem**: Tests exist in multiple places - both `src/**/__tests__` AND `tests/unit/`

**Solution**: Choose one consistent pattern
```
# Option 1: Co-located (Recommended)
src/shared/memory/storage.test.ts
src/shared/auth/oauth.test.ts

# Option 2: Separate test directory  
tests/unit/shared/memory/storage.test.ts
tests/unit/shared/auth/oauth.test.ts
```

#### 2. API Route Duplication

**Current**: API routes defined in multiple places
```typescript
// src/shared/memory/storage.ts - Durable Object routes  
switch (`${method} ${apiPath}`) {
  case 'POST /memories': return await this.handleStoreMemory(request)
  case 'GET /memories': return await this.handleListMemories(request)
}

// src/web-ui/app/api/ - Next.js API routes (proxies to worker)
// src/mcp-server/index.ts - Worker HTTP routes
```

**Solution**: Centralized route definitions
```typescript
// src/shared/api/routes.ts
export const API_ROUTES = {
  memories: {
    list: 'GET /api/memories',
    create: 'POST /api/memories', 
    delete: 'DELETE /api/memories/:id'
  },
  search: {
    memories: 'POST /api/search'
  }
} as const

// Generate OpenAPI spec from route definitions
export function generateOpenAPISpec() {
  // Auto-generate API documentation
}
```

#### 3. Configuration Management

**Current**: Environment variables scattered across files
```typescript
// src/mcp-server/index.ts
env.GOOGLE_CLIENT_ID
env.GOOGLE_CLIENT_SECRET
env.VECTORIZE

// src/web-ui/lib/worker-client.ts  
const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787'
```

**Solution**: Centralized configuration with validation
```typescript
// src/shared/config/index.ts
import { z } from 'zod'

const configSchema = z.object({
  googleAuth: z.object({
    clientId: z.string(),
    clientSecret: z.string()
  }),
  worker: z.object({
    url: z.string().url()
  }),
  vectorize: z.object({
    indexName: z.string()
  })
})

export const config = configSchema.parse({
  googleAuth: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET
  },
  worker: {
    url: process.env.WORKER_URL || 'http://localhost:8787'  
  },
  vectorize: {
    indexName: process.env.VECTORIZE_INDEX || 'memories'
  }
})
```

#### 4. Error Handling Consistency

**Current**: Different error patterns across modules
```typescript
// Some places throw errors
throw new Error('Failed to store memory')

// Others return error responses  
return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 })

// Others use custom error classes
throw new OAuthError('Token expired', 401)
```

**Solution**: Consistent error handling
```typescript
// src/shared/utils/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const ErrorCodes = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  MEMORY_NOT_FOUND: 'MEMORY_NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR'
} as const

// Usage across app
throw new AppError('Memory not found', ErrorCodes.MEMORY_NOT_FOUND, 404)
```

### Positive Architecture Decisions ✅

1. **Concept-based organization** (memory/, auth/, mcp/) ✅
2. **Shared code properly abstracted** ✅  
3. **TypeScript throughout** ✅
4. **Separation of concerns** (Worker vs Web UI) ✅
5. **Domain-driven structure** ✅

### Minor Improvements Needed

| Issue | Current | Recommended |
|-------|---------|-------------|
| Test Organization | Mixed locations | Co-located with source |
| API Route Definitions | Scattered | Centralized route config |
| Configuration | Environment vars everywhere | Typed config object |
| Error Handling | Inconsistent patterns | Standardized error classes |
| Documentation | Scattered README files | Single source of truth |

### Implementation Priority

1. **Low Priority** - Architecture is fundamentally sound
2. **Focus on Library Integration** first (OAuth, MCP SDK)
3. **Then tackle these organizational improvements**

### Estimated Effort

- **Test Organization**: 2 hours (move files)
- **Route Centralization**: 4 hours (refactor)  
- **Config Management**: 3 hours (create + migrate)
- **Error Standardization**: 6 hours (create + update all usage)

**Total**: ~15 hours of organizational cleanup

### Files to Create

- ➕ `src/shared/config/index.ts` - Centralized configuration
- ➕ `src/shared/api/routes.ts` - Route definitions  
- ➕ `src/shared/utils/errors.ts` - Error handling
- ➕ `docs/ARCHITECTURE.md` - Document decisions

The current architecture is actually quite good - these are polish improvements rather than fundamental issues.