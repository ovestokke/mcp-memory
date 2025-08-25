# Fragmented API Client Architecture

## Issue: Multiple Overlapping HTTP Client Patterns

### Current State: 4 Different API Client Approaches

#### 1. `MemoryStorageClient` (Durable Object Communication)
```typescript
// src/shared/memory/client.ts
class MemoryStorageClient {
  async storeMemory(params) {
    const response = await this.durableObject.fetch('http://localhost/api/memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': params.userId },
      body: JSON.stringify({ /* ... */ }),
    })
    // Manual error handling, no typing
  }
}
```

#### 2. `MemoryApiClient` (Web UI Client)  
```typescript
// src/web-ui/lib/api-client.ts
class MemoryApiClient {
  async getMemories(): Promise<Memory[]> {
    const response = await apiRequest<Memory[]>(`${this.baseUrl}/memories`)
    return Array.isArray(response) ? response : [] // Manual type coercion
  }
}
```

#### 3. `AuthenticatedWorkerClient` (NextJS → Worker)
```typescript
// src/web-ui/lib/worker-client.ts  
class AuthenticatedWorkerClient {
  static async request(options: WorkerClientOptions): Promise<NextResponse> {
    const headers = { 'Authorization': `Bearer ${session.accessToken}` }
    const response = await fetch(`${WORKER_URL}${options.path}`, { /* ... */ })
    // Manual response handling, returns NextResponse
  }
}
```

#### 4. Raw Fetch Calls (Scattered Throughout)
```typescript
// Multiple locations
const response = await fetch(url, {
  method: 'POST', 
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
})
```

### Problems

1. **Inconsistent Error Handling**
   - Some throw errors, some return error objects
   - Different error message formats
   - No centralized error logging

2. **No Request/Response Type Safety**
   ```typescript
   // Manual type assertions everywhere
   return Array.isArray(response) ? response : []
   return response.json() // No typing!
   ```

3. **Duplicate Authentication Logic**
   - Bearer token handling in multiple places
   - Session management scattered across files
   - No centralized auth interceptors

4. **Manual Response Processing**
   - JSON parsing duplicated everywhere
   - Status code checking repeated
   - No automatic retry logic

5. **Configuration Duplication**
   - Base URLs hardcoded in multiple places
   - Header setup repeated
   - Timeout/retry settings inconsistent

### Solution: Single Typed HTTP Client

Use a mature HTTP client library like **ky** or **axios** with centralized configuration:

#### Recommended: `ky` (Modern, TypeScript-first)

```typescript
// src/shared/api/client.ts
import ky from 'ky'

interface ApiConfig {
  baseUrl: string
  auth?: { token: string }
}

export class ApiClient {
  private http: typeof ky

  constructor(config: ApiConfig) {
    this.http = ky.create({
      prefixUrl: config.baseUrl,
      headers: config.auth ? {
        'Authorization': `Bearer ${config.auth.token}`
      } : {},
      retry: {
        limit: 3,
        statusCodes: [408, 413, 429, 500, 502, 503, 504]
      },
      timeout: 10000,
      hooks: {
        beforeRequest: [(request) => {
          // Centralized request logging
        }],
        afterResponse: [(request, options, response) => {
          // Centralized response logging
        }]
      }
    })
  }

  // Type-safe methods
  async get<T>(url: string): Promise<T> {
    return this.http.get(url).json<T>()
  }

  async post<T>(url: string, body: unknown): Promise<T> {
    return this.http.post(url, { json: body }).json<T>()
  }
  
  async delete(url: string): Promise<void> {
    await this.http.delete(url)
  }
}

// Memory-specific client
export class MemoryApiClient {
  constructor(private api: ApiClient) {}

  async storeMemory(data: MemoryFormData): Promise<Memory> {
    return this.api.post<Memory>('memories', data)
  }

  async getMemories(): Promise<Memory[]> {
    return this.api.get<Memory[]>('memories')
  }

  async searchMemories(query: string): Promise<Memory[]> {
    return this.api.post<Memory[]>('search', { query })
  }
}
```

### Benefits of Consolidation

1. **Type Safety**
   ```typescript
   // Before: Manual type assertions
   const memories = await response.json() as Memory[] // Unsafe!
   
   // After: Compile-time type checking  
   const memories = await api.get<Memory[]>('memories') // Safe!
   ```

2. **Centralized Error Handling**
   ```typescript
   // Automatic error mapping
   const api = ky.create({
     hooks: {
       beforeError: [(error) => {
         // Transform all API errors to consistent format
         return new ApiError(error.response.status, error.message)
       }]
     }
   })
   ```

3. **Request/Response Interceptors**
   ```typescript
   // Authentication, logging, transforms - all centralized
   beforeRequest: [(request) => {
     request.headers.set('X-Request-ID', generateId())
     logRequest(request)
   }]
   ```

4. **Automatic Retry & Timeout**
   - No more manual retry logic
   - Consistent timeout handling  
   - Exponential backoff built-in

### Migration Strategy

1. **Phase 1**: Install `ky` and create base `ApiClient`
2. **Phase 2**: Replace `MemoryApiClient` with typed version  
3. **Phase 3**: Migrate `AuthenticatedWorkerClient` to use base client
4. **Phase 4**: Update `MemoryStorageClient` to use consistent patterns
5. **Phase 5**: Replace remaining raw fetch calls

### Files Affected

- 🆕 **CREATE**: `src/shared/api/client.ts` 
- ✏️ **REFACTOR**: `src/web-ui/lib/api-client.ts`
- ✏️ **REFACTOR**: `src/web-ui/lib/worker-client.ts` 
- ✏️ **REFACTOR**: `src/shared/memory/client.ts`
- 🗑️ **REMOVE**: Scattered fetch calls

### Estimated Impact

- **Lines Reduced**: ~300 lines of duplicate HTTP logic
- **Type Safety**: +100% (fully typed requests/responses)
- **Error Handling**: Consistent across all API calls
- **Testing**: Easier mocking and interceptors
- **Maintenance**: Single place for HTTP configuration