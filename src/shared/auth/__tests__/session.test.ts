/**
 * Tests for the refactored session management
 */

import { 
  SessionManager, 
  MemorySessionStore, 
  SessionData,
  SessionConfig 
} from '../session'

// Mock logger
jest.mock('../../utils/logger', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    withContext: jest.fn(),
  }
  mockLogger.withContext.mockReturnValue(mockLogger)
  return { logger: mockLogger }
})

// Mock crypto for session ID generation
const mockRandomUUID = jest.fn()
const mockGetRandomValues = jest.fn()

Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: mockRandomUUID,
    getRandomValues: mockGetRandomValues,
  },
  writable: true,
})

describe('MemorySessionStore', () => {
  let store: MemorySessionStore

  beforeEach(() => {
    store = new MemorySessionStore({ maxAge: 60000 }) // 1 minute
  })

  it('should store and retrieve sessions', async () => {
    const session: SessionData = {
      id: 'test-session',
      userId: 'user-123',
      email: 'test@example.com',
      createdAt: Date.now(),
      lastAccess: Date.now(),
    }

    await store.set('test-session', session)
    const retrieved = await store.get('test-session')

    expect(retrieved).toEqual(session)
  })

  it('should return null for non-existent sessions', async () => {
    const retrieved = await store.get('non-existent')
    expect(retrieved).toBeNull()
  })

  it('should destroy sessions', async () => {
    const session: SessionData = {
      id: 'test-session',
      userId: 'user-123',
      createdAt: Date.now(),
      lastAccess: Date.now(),
    }

    await store.set('test-session', session)
    await store.destroy('test-session')
    
    const retrieved = await store.get('test-session')
    expect(retrieved).toBeNull()
  })

  it('should expire old sessions', async () => {
    const session: SessionData = {
      id: 'test-session',
      userId: 'user-123',
      createdAt: Date.now() - 120000, // 2 minutes ago
      lastAccess: Date.now() - 120000, // 2 minutes ago
    }

    await store.set('test-session', session)
    
    // Session should be expired and return null
    const retrieved = await store.get('test-session')
    expect(retrieved).toBeNull()
  })

  it('should update last access time on touch', async () => {
    const originalTime = Date.now() - 30000 // 30 seconds ago
    const session: SessionData = {
      id: 'test-session',
      userId: 'user-123',
      createdAt: originalTime,
      lastAccess: originalTime,
    }

    await store.set('test-session', session)
    
    // Wait a bit, then touch
    await new Promise(resolve => setTimeout(resolve, 10))
    await store.touch('test-session')
    
    const retrieved = await store.get('test-session')
    expect(retrieved!.lastAccess).toBeGreaterThan(originalTime)
  })
})

describe('SessionManager (Refactored)', () => {
  let sessionManager: SessionManager
  let store: MemorySessionStore

  const config: SessionConfig = {
    secret: 'test-secret',
    maxAge: 60000, // 1 minute
    secure: false,
    httpOnly: true,
    sameSite: 'lax',
  }

  beforeEach(() => {
    store = new MemorySessionStore({ maxAge: config.maxAge! })
    sessionManager = new SessionManager(config, store)
    
    // Reset mocks
    mockRandomUUID.mockClear()
    mockGetRandomValues.mockClear()
  })

  describe('generateSessionId', () => {
    it('should use crypto.randomUUID when available', () => {
      mockRandomUUID.mockReturnValue('550e8400-e29b-41d4-a716-446655440000')
      
      const sessionId = sessionManager.generateSessionId()
      
      expect(mockRandomUUID).toHaveBeenCalled()
      expect(sessionId).toBe('550e8400-e29b-41d4-a716-446655440000')
    })

    it('should fallback to crypto.getRandomValues when randomUUID not available', () => {
      mockRandomUUID.mockImplementation(() => {
        throw new Error('randomUUID not available')
      })
      
      const mockValues = new Uint8Array(32)
      for (let i = 0; i < 32; i++) {
        mockValues[i] = i % 62 // Ensure valid character indices
      }
      mockGetRandomValues.mockImplementation((array) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = mockValues[i]
        }
      })

      const sessionId = sessionManager.generateSessionId()
      
      expect(mockGetRandomValues).toHaveBeenCalled()
      expect(sessionId).toHaveLength(32)
    })
  })

  describe('createSession', () => {
    it('should create a new session', async () => {
      mockRandomUUID.mockReturnValue('test-session-id')
      
      const session = await sessionManager.createSession('user-123', {
        email: 'test@example.com',
      })

      expect(session.id).toBe('test-session-id')
      expect(session.userId).toBe('user-123')
      expect(session.email).toBe('test@example.com')
      expect(session.createdAt).toBeCloseTo(Date.now(), -2)
      expect(session.lastAccess).toBeCloseTo(Date.now(), -2)
    })

    it('should create session without userId', async () => {
      mockRandomUUID.mockReturnValue('anonymous-session')
      
      const session = await sessionManager.createSession()
      
      expect(session.id).toBe('anonymous-session')
      expect(session.userId).toBeUndefined()
    })
  })

  describe('getSession', () => {
    it('should retrieve existing session and touch it', async () => {
      mockRandomUUID.mockReturnValue('test-session')
      
      const originalSession = await sessionManager.createSession('user-123')
      const originalLastAccess = originalSession.lastAccess
      
      // Wait a bit, then get session
      await new Promise(resolve => setTimeout(resolve, 10))
      const retrievedSession = await sessionManager.getSession('test-session')
      
      expect(retrievedSession).not.toBeNull()
      expect(retrievedSession!.id).toBe('test-session')
      expect(retrievedSession!.userId).toBe('user-123')
      expect(retrievedSession!.lastAccess).toBeGreaterThanOrEqual(originalLastAccess)
    })

    it('should return null for non-existent session', async () => {
      const session = await sessionManager.getSession('non-existent')
      expect(session).toBeNull()
    })

    it('should return null for empty session ID', async () => {
      const session = await sessionManager.getSession('')
      expect(session).toBeNull()
    })
  })

  describe('updateSession', () => {
    it('should update existing session', async () => {
      mockRandomUUID.mockReturnValue('test-session')
      
      await sessionManager.createSession('user-123')
      
      await sessionManager.updateSession('test-session', {
        email: 'updated@example.com',
        accessToken: 'new-token',
      })
      
      const session = await sessionManager.getSession('test-session')
      expect(session!.email).toBe('updated@example.com')
      expect(session!.accessToken).toBe('new-token')
    })

    it('should throw error for non-existent session', async () => {
      await expect(sessionManager.updateSession('non-existent', { email: 'test@example.com' }))
        .rejects.toThrow('Session not found')
    })
  })

  describe('destroySession', () => {
    it('should destroy existing session', async () => {
      mockRandomUUID.mockReturnValue('test-session')
      
      await sessionManager.createSession('user-123')
      await sessionManager.destroySession('test-session')
      
      const session = await sessionManager.getSession('test-session')
      expect(session).toBeNull()
    })

    it('should not throw error for non-existent session', async () => {
      await expect(sessionManager.destroySession('non-existent'))
        .resolves.not.toThrow()
    })
  })

  describe('extractSessionId', () => {
    it('should extract session ID from cookie', () => {
      const request = new Request('http://localhost:3000', {
        headers: {
          'Cookie': 'session-id=cookie-session-123; other-cookie=value',
        },
      })

      const sessionId = sessionManager.extractSessionId(request)
      expect(sessionId).toBe('cookie-session-123')
    })

    it('should extract session ID from sessionId cookie name', () => {
      const request = new Request('http://localhost:3000', {
        headers: {
          'Cookie': 'sessionId=alt-cookie-session; other=value',
        },
      })

      const sessionId = sessionManager.extractSessionId(request)
      expect(sessionId).toBe('alt-cookie-session')
    })

    it('should extract session ID from Authorization header', () => {
      const request = new Request('http://localhost:3000', {
        headers: {
          'Authorization': 'Session auth-session-456',
        },
      })

      const sessionId = sessionManager.extractSessionId(request)
      expect(sessionId).toBe('auth-session-456')
    })

    it('should prefer cookie over Authorization header', () => {
      const request = new Request('http://localhost:3000', {
        headers: {
          'Cookie': 'session-id=cookie-session',
          'Authorization': 'Session auth-session',
        },
      })

      const sessionId = sessionManager.extractSessionId(request)
      expect(sessionId).toBe('cookie-session')
    })

    it('should return null when no session ID found', () => {
      const request = new Request('http://localhost:3000')

      const sessionId = sessionManager.extractSessionId(request)
      expect(sessionId).toBeNull()
    })
  })

  describe('createSessionCookie', () => {
    it('should create valid session cookie', () => {
      const cookie = sessionManager.createSessionCookie('test-session-123')
      
      expect(cookie).toContain('session-id=test-session-123')
      expect(cookie).toContain('HttpOnly')
      expect(cookie).toContain('SameSite=lax')
      expect(cookie).toContain('Expires=')
      expect(cookie).toContain('Max-Age=')
    })

    it('should include secure flag when configured', () => {
      const secureConfig = { ...config, secure: true }
      const secureManager = new SessionManager(secureConfig, store)
      
      const cookie = secureManager.createSessionCookie('test-session')
      
      expect(cookie).toContain('Secure')
    })

    it('should include domain and path when configured', () => {
      const domainConfig = { 
        ...config, 
        domain: '.example.com',
        path: '/api',
      }
      const domainManager = new SessionManager(domainConfig, store)
      
      const cookie = domainManager.createSessionCookie('test-session')
      
      expect(cookie).toContain('Domain=.example.com')
      expect(cookie).toContain('Path=/api')
    })
  })

  describe('createDestroySessionCookie', () => {
    it('should create session destruction cookie', () => {
      const cookie = sessionManager.createDestroySessionCookie()
      
      expect(cookie).toContain('session-id=;')
      expect(cookie).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT')
      expect(cookie).toContain('Max-Age=0')
    })
  })

  describe('handleSession', () => {
    it('should handle request with existing session', async () => {
      mockRandomUUID.mockReturnValue('test-session')
      
      // Create session first
      const originalSession = await sessionManager.createSession('user-123', {
        email: 'test@example.com'
      })

      const request = new Request('http://localhost:3000', {
        headers: {
          'Cookie': 'session-id=test-session',
        },
      })

      const handler = await sessionManager.handleSession(request)
      
      expect(handler.session).not.toBeNull()
      expect(handler.session!.id).toBe('test-session')
      expect(handler.session!.userId).toBe('user-123')
      expect(handler.getSessionCookie()).toContain('session-id=test-session')
    })

    it('should handle request without session', async () => {
      const request = new Request('http://localhost:3000')

      const handler = await sessionManager.handleSession(request)
      
      expect(handler.session).toBeNull()
      expect(handler.getSessionCookie()).toBeNull()
    })

    it('should allow creating new session', async () => {
      mockRandomUUID.mockReturnValue('new-session')
      
      const request = new Request('http://localhost:3000')
      const handler = await sessionManager.handleSession(request)
      
      const newSession = await handler.createSession('user-456', {
        email: 'new@example.com'
      })
      
      expect(newSession.id).toBe('new-session')
      expect(newSession.userId).toBe('user-456')
    })

    it('should allow updating session', async () => {
      mockRandomUUID.mockReturnValue('test-session')
      
      await sessionManager.createSession('user-123')
      
      const request = new Request('http://localhost:3000', {
        headers: { 'Cookie': 'session-id=test-session' },
      })
      
      const handler = await sessionManager.handleSession(request)
      await handler.updateSession({ email: 'updated@example.com' })
      
      const updatedSession = await sessionManager.getSession('test-session')
      expect(updatedSession!.email).toBe('updated@example.com')
    })

    it('should allow destroying session', async () => {
      mockRandomUUID.mockReturnValue('test-session')
      
      await sessionManager.createSession('user-123')
      
      const request = new Request('http://localhost:3000', {
        headers: { 'Cookie': 'session-id=test-session' },
      })
      
      const handler = await sessionManager.handleSession(request)
      await handler.destroySession()
      
      const session = await sessionManager.getSession('test-session')
      expect(session).toBeNull()
    })
  })
})