/**
 * Modern Session Management for Cloudflare Workers
 * 
 * This provides session management functionality adapted for the Workers environment,
 * using modern libraries and best practices.
 */

import { logger } from '../utils/logger'

export interface SessionData {
  id: string
  userId?: string
  email?: string
  name?: string
  accessToken?: string
  refreshToken?: string
  tokenExpiry?: number
  createdAt: number
  lastAccess: number
  [key: string]: any
}

export interface SessionConfig {
  secret: string
  maxAge?: number // Session duration in milliseconds (default: 24 hours)
  secure?: boolean // Whether to use secure cookies
  sameSite?: 'strict' | 'lax' | 'none'
  domain?: string
  path?: string
  httpOnly?: boolean
}

export interface SessionStore {
  get(sessionId: string): Promise<SessionData | null>
  set(sessionId: string, session: SessionData): Promise<void>
  destroy(sessionId: string): Promise<void>
  touch(sessionId: string): Promise<void>
}

// Simple in-memory store for development
export class MemorySessionStore implements SessionStore {
  private sessions = new Map<string, SessionData>()
  private timers = new Map<string, any>()

  constructor(private config: { maxAge: number }) {}

  async get(sessionId: string): Promise<SessionData | null> {
    const session = this.sessions.get(sessionId)
    if (!session) return null
    
    // Check if session has expired
    if (Date.now() - session.lastAccess > this.config.maxAge) {
      await this.destroy(sessionId)
      return null
    }
    
    return session
  }

  async set(sessionId: string, session: SessionData): Promise<void> {
    this.sessions.set(sessionId, session)
    
    // Clear existing timer
    if (this.timers.has(sessionId)) {
      clearTimeout(this.timers.get(sessionId))
    }
    
    // Set expiry timer
    const timer = setTimeout(() => {
      this.destroy(sessionId)
    }, this.config.maxAge)
    
    this.timers.set(sessionId, timer)
  }

  async destroy(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId)
    
    if (this.timers.has(sessionId)) {
      clearTimeout(this.timers.get(sessionId))
      this.timers.delete(sessionId)
    }
  }

  async touch(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.lastAccess = Date.now()
      await this.set(sessionId, session)
    }
  }
}

// Cloudflare Durable Objects session store for production
export class DurableObjectSessionStore implements SessionStore {
  constructor(
    private durableObjectNamespace: DurableObjectNamespace,
    private config: { maxAge: number }
  ) {}

  private getSessionObjectId(sessionId: string): DurableObjectId {
    return this.durableObjectNamespace.idFromName(`session:${sessionId}`)
  }

  async get(sessionId: string): Promise<SessionData | null> {
    try {
      const id = this.getSessionObjectId(sessionId)
      const obj = this.durableObjectNamespace.get(id)
      
      const response = await obj.fetch(`http://session/get`)
      if (!response.ok) return null
      
      const session = await response.json() as SessionData
      
      // Check if session has expired
      if (Date.now() - session.lastAccess > this.config.maxAge) {
        await this.destroy(sessionId)
        return null
      }
      
      return session
    } catch (error) {
      logger.error('Failed to get session', { sessionId, error: error instanceof Error ? error : String(error) })
      return null
    }
  }

  async set(sessionId: string, session: SessionData): Promise<void> {
    try {
      const id = this.getSessionObjectId(sessionId)
      const obj = this.durableObjectNamespace.get(id)
      
      await obj.fetch(`http://session/set`, {
        method: 'POST',
        body: JSON.stringify(session),
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      logger.error('Failed to set session', { sessionId, error: error instanceof Error ? error : String(error) })
      throw error
    }
  }

  async destroy(sessionId: string): Promise<void> {
    try {
      const id = this.getSessionObjectId(sessionId)
      const obj = this.durableObjectNamespace.get(id)
      
      await obj.fetch(`http://session/destroy`, { method: 'DELETE' })
    } catch (error) {
      logger.error('Failed to destroy session', { sessionId, error: error instanceof Error ? error : String(error) })
    }
  }

  async touch(sessionId: string): Promise<void> {
    try {
      const session = await this.get(sessionId)
      if (session) {
        session.lastAccess = Date.now()
        await this.set(sessionId, session)
      }
    } catch (error) {
      logger.error('Failed to touch session', { sessionId, error: error instanceof Error ? error : String(error) })
    }
  }
}

export class SessionManager {
  private sessionLogger = logger.withContext({ module: 'SessionManager' })

  constructor(
    private config: SessionConfig,
    private store: SessionStore
  ) {}

  /**
   * Generate a secure session ID
   */
  generateSessionId(): string {
    // Use crypto.randomUUID if available, otherwise fallback to random string
    try {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID()
      }
    } catch (error) {
      // Fall through to manual generation
    }
    
    // Fallback: generate secure random string
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    const values = new Uint8Array(32)
    crypto.getRandomValues(values)
    
    for (let i = 0; i < values.length; i++) {
      result += chars[values[i] % chars.length]
    }
    
    return result
  }

  /**
   * Create a new session
   */
  async createSession(userId?: string, initialData: Partial<SessionData> = {}): Promise<SessionData> {
    const requestLogger = this.sessionLogger.withContext({ operation: 'createSession' })
    
    const sessionId = this.generateSessionId()
    const now = Date.now()
    
    const session: SessionData = {
      id: sessionId,
      createdAt: now,
      lastAccess: now,
      ...initialData,
    }
    
    if (userId) {
      session.userId = userId
    }

    await this.store.set(sessionId, session)
    
    requestLogger.info('Session created', {
      sessionId: sessionId.substring(0, 8) + '...',
      ...(userId && { userId }),
    })
    
    return session
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    if (!sessionId) return null
    
    try {
      const session = await this.store.get(sessionId)
      
      if (session) {
        // Touch session to update last access time
        await this.store.touch(sessionId)
      }
      
      return session
    } catch (error) {
      this.sessionLogger.error('Failed to get session', { sessionId, error: error instanceof Error ? error : String(error) })
      return null
    }
  }

  /**
   * Update session data
   */
  async updateSession(sessionId: string, updates: Partial<SessionData>): Promise<void> {
    const requestLogger = this.sessionLogger.withContext({ operation: 'updateSession' })
    
    try {
      const session = await this.store.get(sessionId)
      if (!session) {
        throw new Error('Session not found')
      }
      
      const updatedSession = {
        ...session,
        ...updates,
        lastAccess: Date.now(),
      }
      
      await this.store.set(sessionId, updatedSession)
      
      requestLogger.info('Session updated', {
        sessionId: sessionId.substring(0, 8) + '...',
      })
    } catch (error) {
      requestLogger.error('Failed to update session', { sessionId, error: error instanceof Error ? error : String(error) })
      throw error
    }
  }

  /**
   * Destroy session
   */
  async destroySession(sessionId: string): Promise<void> {
    const requestLogger = this.sessionLogger.withContext({ operation: 'destroySession' })
    
    try {
      await this.store.destroy(sessionId)
      
      requestLogger.info('Session destroyed', {
        sessionId: sessionId.substring(0, 8) + '...',
      })
    } catch (error) {
      requestLogger.error('Failed to destroy session', { sessionId, error: error instanceof Error ? error : String(error) })
      throw error
    }
  }

  /**
   * Extract session ID from request headers (Cookie or Authorization)
   */
  extractSessionId(request: Request): string | null {
    // Try cookie first
    const cookieHeader = request.headers.get('Cookie')
    if (cookieHeader) {
      const cookies = this.parseCookies(cookieHeader)
      const sessionId = cookies['session-id'] || cookies['sessionId']
      if (sessionId) return sessionId
    }
    
    // Try Authorization header as fallback
    const authHeader = request.headers.get('Authorization')
    if (authHeader) {
      const match = authHeader.match(/^Session\s+(.+)$/i)
      if (match) return match[1] || null
    }
    
    return null
  }

  /**
   * Create session cookie
   */
  createSessionCookie(sessionId: string): string {
    const maxAge = this.config.maxAge || 24 * 60 * 60 * 1000 // 24 hours
    const expires = new Date(Date.now() + maxAge)
    
    let cookie = `session-id=${sessionId}`
    cookie += `; Expires=${expires.toUTCString()}`
    cookie += `; Max-Age=${Math.floor(maxAge / 1000)}`
    
    if (this.config.path) cookie += `; Path=${this.config.path}`
    if (this.config.domain) cookie += `; Domain=${this.config.domain}`
    if (this.config.secure) cookie += '; Secure'
    if (this.config.httpOnly !== false) cookie += '; HttpOnly'
    
    const sameSite = this.config.sameSite || 'lax'
    cookie += `; SameSite=${sameSite}`
    
    return cookie
  }

  /**
   * Create session destruction cookie
   */
  createDestroySessionCookie(): string {
    let cookie = 'session-id=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0'
    
    if (this.config.path) cookie += `; Path=${this.config.path}`
    if (this.config.domain) cookie += `; Domain=${this.config.domain}`
    if (this.config.secure) cookie += '; Secure'
    if (this.config.httpOnly !== false) cookie += '; HttpOnly'
    
    const sameSite = this.config.sameSite || 'lax'
    cookie += `; SameSite=${sameSite}`
    
    return cookie
  }

  /**
   * Parse cookies from header string
   */
  private parseCookies(cookieHeader: string): Record<string, string> {
    const cookies: Record<string, string> = {}
    
    cookieHeader.split(';').forEach(cookie => {
      const [name, ...rest] = cookie.trim().split('=')
      if (name && rest.length > 0) {
        cookies[name] = rest.join('=').trim()
      }
    })
    
    return cookies
  }

  /**
   * Middleware-style session handler for Workers
   */
  async handleSession(request: Request): Promise<{
    session: SessionData | null
    createSession: (userId?: string, data?: Partial<SessionData>) => Promise<SessionData>
    updateSession: (updates: Partial<SessionData>) => Promise<void>
    destroySession: () => Promise<void>
    getSessionCookie: () => string | null
  }> {
    const sessionId = this.extractSessionId(request)
    const session = sessionId ? await this.getSession(sessionId) : null
    
    return {
      session,
      createSession: async (userId?: string, data: Partial<SessionData> = {}) => {
        return this.createSession(userId, data)
      },
      updateSession: async (updates: Partial<SessionData>) => {
        if (!sessionId) throw new Error('No active session')
        return this.updateSession(sessionId, updates)
      },
      destroySession: async () => {
        if (!sessionId) return
        return this.destroySession(sessionId)
      },
      getSessionCookie: () => {
        return session ? this.createSessionCookie(session.id) : null
      }
    }
  }
}