# Multiple Session Management Systems

## Issue: Three Competing Authentication Approaches

### Current State: Authentication Scattered Everywhere

#### 1. Custom Session Management (`web-ui/lib/auth.ts`)
```typescript
// In-memory session store (will lose data on restart!)
const sessions = new Map<string, AuthSession>()

export function createSession(session: AuthSession): string {
  const sessionId = generateSessionId()
  sessions.set(sessionId, session) // ⚠️ Memory only!
  return sessionId
}

// Mock Google OAuth (not production ready)
export async function authenticateWithGoogle(): Promise<AuthSession> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const mockGoogleUser = { /* fake data */ }
      resolve(session)
    }, 1500) // ⚠️ Simulated delay
  })
}
```

#### 2. NextAuth Integration (`web-ui/lib/worker-client.ts`)
```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '../app/api/auth/[...nextauth]/route'

const session = await getServerSession(authOptions)
if (!session?.user || !session.accessToken) {
  return { error: 'Authentication required' }
}
```

#### 3. Custom OAuth Handler (`shared/auth/oauth.ts`) 
```typescript
export class OAuth2Handler {
  async authenticateRequest(request: Request) {
    const token = this.extractBearerToken(authHeader)
    const user = await this.validateToken(token)
    return { user, token }
  }
}
```

### Problems

1. **Conflicting Session Stores**
   - In-memory Map (loses data on restart)
   - NextAuth session (persisted to database/cookies)  
   - OAuth token validation (stateless)

2. **Inconsistent User Objects**
   ```typescript
   // Three different user type definitions:
   
   // auth.ts
   interface User { id: string; email: string; name?: string; picture?: string }
   
   // oauth.ts  
   interface GoogleUserInfo { id: string; email: string; verified_email: boolean; /* ... */ }
   
   // next-auth
   interface User { id: string; name?: string; email?: string; image?: string }
   ```

3. **Security Vulnerabilities**
   ```typescript
   // In-memory sessions lost on server restart
   const sessions = new Map<string, AuthSession>() // ⚠️ Not persistent!
   
   // Mock authentication in production path
   const mockGoogleUser = { id: 'google_' + crypto.randomUUID() } // ⚠️ Fake!
   ```

4. **Authentication State Confusion**
   - Web UI uses NextAuth
   - Worker uses custom OAuth validation
   - No shared authentication state

### Root Cause

The project evolved with different authentication needs:
1. Started with mock auth for development
2. Added NextAuth for web UI
3. Added custom OAuth for MCP/Worker auth
4. Never cleaned up the layers!

### Solution: Standardize on NextAuth.js

NextAuth.js is already partially integrated and provides:

#### Benefits
- ✅ **Persistent sessions** (database/cookie based)
- ✅ **Multiple provider support** (Google, GitHub, etc.)
- ✅ **Security best practices** (CSRF, PKCE, etc.)  
- ✅ **TypeScript support** with proper typing
- ✅ **Server/client session sharing**
- ✅ **Automatic token refresh**

#### Implementation
```typescript
// pages/api/auth/[...nextauth].ts (already exists!)
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
      }
      return token
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken
      return session
    },
  },
}
```

#### Unified Session Access
```typescript
// Server-side (API routes, middleware)
const session = await getServerSession(authOptions)

// Client-side (React components)
const { data: session } = useSession()

// Custom hook for type safety
export function useAuth() {
  const { data: session, status } = useSession()
  return {
    user: session?.user,
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
    token: session?.accessToken
  }
}
```

### Migration Steps

1. **Remove Custom Session Management**
   ```typescript
   // DELETE: web-ui/lib/auth.ts (180 lines)
   // All session logic handled by NextAuth
   ```

2. **Update Worker Authentication**
   ```typescript
   // Replace OAuth2Handler with NextAuth token validation
   export async function validateNextAuthToken(token: string) {
     // Use NextAuth's JWT verification
     return jwt.verify(token, process.env.NEXTAUTH_SECRET)
   }
   ```

3. **Standardize User Types**
   ```typescript
   // Single user interface across the app
   interface User {
     id: string
     name?: string | null  
     email?: string | null
     image?: string | null
   }
   ```

4. **Update Components**
   ```typescript
   // Before: Multiple auth patterns
   const user = getUserFromRequest(request)
   const session = await getServerSession()
   const mockUser = await authenticateWithGoogle()
   
   // After: Single pattern everywhere
   const { user, isAuthenticated } = useAuth()
   ```

### Files to Change

- 🗑️ **DELETE**: `src/web-ui/lib/auth.ts` (180 lines of custom auth)
- ✏️ **UPDATE**: `src/shared/auth/oauth.ts` (integrate with NextAuth)  
- ✏️ **UPDATE**: `src/mcp-server/index.ts` (use NextAuth token validation)
- ✏️ **UPDATE**: All components using authentication
- ➕ **ADD**: `src/shared/auth/next-auth.ts` (centralized config)

### Security Benefits

| Issue | Current | After NextAuth |
|-------|---------|---------------|
| Session Persistence | ❌ Lost on restart | ✅ Database/cookie stored |
| CSRF Protection | ❌ Custom/incomplete | ✅ Built-in |
| Token Security | ❌ Custom validation | ✅ JWT with secrets |
| Provider Integration | ❌ Manual OAuth | ✅ Official SDK |
| Session Expiry | ❌ Manual cleanup | ✅ Automatic |

### Estimated Impact

- **Lines Removed**: ~200 lines of custom auth code
- **Security**: +90% (production-ready auth)
- **Maintenance**: -70% (no custom session logic)
- **Consistency**: Single auth pattern across app