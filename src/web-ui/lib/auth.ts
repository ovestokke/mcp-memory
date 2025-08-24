// Authentication utilities for the web app
import { NextRequest } from 'next/server'

export interface User {
  id: string
  email: string
  name?: string
  picture?: string
}

export interface AuthSession {
  user: User
  accessToken?: string
  refreshToken?: string
  expiresAt: number
}

// Simple session management (in production, use proper session store)
const sessions = new Map<string, AuthSession>()

export class AuthError extends Error {
  constructor(message: string, public code: string) {
    super(message)
    this.name = 'AuthError'
  }
}

// Generate secure session ID
function generateSessionId(): string {
  return crypto.randomUUID() + '-' + Date.now()
}

// Mock Google OAuth for development (replace with real OAuth in production)
export async function authenticateWithGoogle(): Promise<AuthSession> {
  // In real implementation, this would:
  // 1. Redirect to Google OAuth consent screen
  // 2. Handle OAuth callback with authorization code
  // 3. Exchange code for access token
  // 4. Fetch user profile from Google API
  
  // For demo purposes, simulate successful Google OAuth
  return new Promise((resolve) => {
    // Simulate OAuth redirect and callback
    setTimeout(() => {
      const mockGoogleUser: User = {
        id: 'google_' + crypto.randomUUID(),
        email: 'demo@gmail.com',
        name: 'Demo User',
        picture: 'https://lh3.googleusercontent.com/a/default-user=s96-c' // Mock Google profile picture
      }
      
      const session: AuthSession = {
        user: mockGoogleUser,
        accessToken: 'mock_google_access_token',
        refreshToken: 'mock_google_refresh_token',
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      }
      
      resolve(session)
    }, 1500) // Simulate OAuth flow delay
  })
}

// Store session with secure cookie
export function createSession(session: AuthSession): string {
  const sessionId = generateSessionId()
  sessions.set(sessionId, session)
  
  // Clean up expired sessions
  setTimeout(() => cleanupExpiredSessions(), 60000) // 1 minute
  
  return sessionId
}

// Retrieve session by ID
export function getSession(sessionId: string): AuthSession | null {
  const session = sessions.get(sessionId)
  
  if (!session) {
    return null
  }
  
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId)
    return null
  }
  
  return session
}

// Remove session
export function destroySession(sessionId: string): void {
  sessions.delete(sessionId)
}

// Clean up expired sessions
export function cleanupExpiredSessions(): void {
  const now = Date.now()
  for (const [sessionId, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(sessionId)
    }
  }
}

// Extract user from request (for API routes)
export function getUserFromRequest(request: NextRequest): User | null {
  const sessionId = request.cookies.get('session-id')?.value
  if (!sessionId) {
    return null
  }
  
  const session = getSession(sessionId)
  return session?.user || null
}

// Require authentication middleware
export function requireAuth(handler: (request: NextRequest, user: User) => Promise<Response>) {
  return async (request: NextRequest): Promise<Response> => {
    const user = getUserFromRequest(request)
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    return handler(request, user)
  }
}

// Client-side auth utilities
export const clientAuth = {
  async loginWithGoogle(): Promise<User> {
    const response = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new AuthError(error.message || 'Google login failed', error.code || 'GOOGLE_LOGIN_FAILED')
    }
    
    return response.json()
  },
  
  async logout(): Promise<void> {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    })
    
    if (!response.ok) {
      throw new AuthError('Logout failed', 'LOGOUT_FAILED')
    }
  },
  
  async getCurrentUser(): Promise<User | null> {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      })
      
      if (response.status === 401) {
        return null
      }
      
      if (!response.ok) {
        throw new AuthError('Failed to get user', 'GET_USER_FAILED')
      }
      
      return response.json()
    } catch (error) {
      return null
    }
  }
}