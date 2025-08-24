// Mock the OAuth2Handler and other dependencies
const mockAuthenticateRequest = jest.fn().mockResolvedValue({
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    verified_email: true,
    picture: 'https://example.com/avatar.jpg',
  },
  token: 'mock-token',
})

jest.mock('@shared/auth/oauth', () => ({
  OAuth2Handler: jest.fn().mockImplementation(() => ({
    generateAuthUrl: jest.fn().mockReturnValue('https://mock-auth-url.com'),
    exchangeCodeForToken: jest.fn().mockResolvedValue({
      access_token: 'mock-token',
      expires_in: 3600,
      refresh_token: 'mock-refresh-token',
    }),
    validateToken: jest.fn().mockResolvedValue({
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      verified_email: true,
      picture: 'https://example.com/avatar.jpg',
    }),
    authenticateRequest: mockAuthenticateRequest,
  })),
  OAuthError: class OAuthError extends Error {
    constructor(message: string, public status: number = 401, public code?: string) {
      super(message)
      this.name = 'OAuthError'
    }
  },
}))

// Mock the MCPHttpServer
jest.mock('@shared/mcp/http-server', () => ({
  MCPHttpServer: jest.fn().mockImplementation(() => ({
    setCurrentUser: jest.fn(),
    handleRequest: jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ result: 'mcp-response' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    ),
  })),
}))

// Mock the MemoryStorage class
jest.mock('@shared/memory/storage', () => ({
  MemoryStorage: jest.fn().mockImplementation(() => ({
    fetch: jest.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    ),
  })),
}))

// Now import the worker and types
import worker, { Env } from '../index'
import { OAuth2Handler, OAuthError } from '@shared/auth/oauth'
import { MCPHttpServer } from '@shared/mcp/http-server'

describe('MCP Server Worker', () => {
  let mockEnv: Env
  let mockDurableObjectNamespace: DurableObjectNamespace
  let mockDurableObject: DurableObjectStub

  beforeEach(() => {
    jest.clearAllMocks()

    mockDurableObject = {
      fetch: jest.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      ),
    } as any

    mockDurableObjectNamespace = {
      idFromName: jest.fn().mockReturnValue('test-id'),
      get: jest.fn().mockReturnValue(mockDurableObject),
      idFromString: jest.fn(),
      newUniqueId: jest.fn(),
    } as any

    mockEnv = {
      MEMORY_STORAGE: mockDurableObjectNamespace,
      VECTORIZE: {} as VectorizeIndex,
      ENVIRONMENT: 'test',
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
    }
  })

  describe('GET /', () => {
    it('should return health check response', async () => {
      const request = new Request('https://example.com/')
      const response = await worker.fetch(request, mockEnv)

      expect(response.status).toBe(200)
      expect(await response.text()).toBe('MCP Memory Server - Ready for connections')
    })
  })

  describe('GET /auth', () => {
    it('should return OAuth authorization URL', async () => {
      const request = new Request('https://example.com/auth')
      const response = await worker.fetch(request, mockEnv)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.authUrl).toBe('https://mock-auth-url.com')
      expect(data.message).toContain('authenticate with Google')
    })
  })

  describe('POST /auth/callback', () => {
    it('should exchange authorization code for token', async () => {
      const request = new Request('https://example.com/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'test-auth-code' }),
      })
      
      const response = await worker.fetch(request, mockEnv)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.access_token).toBe('mock-token')
      expect(data.user.email).toBe('test@example.com')
    })

    it('should return error if code is missing', async () => {
      const request = new Request('https://example.com/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      
      const response = await worker.fetch(request, mockEnv)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Authorization code is required')
    })
  })

  describe('POST /mcp (protected)', () => {
    it('should handle MCP requests with valid authentication', async () => {
      const request = new Request('https://example.com/mcp', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
        }),
      })

      const response = await worker.fetch(request, mockEnv)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.result).toBe('mcp-response')
    })

    it('should return 401 for MCP requests without authentication', async () => {
      const request = new Request('https://example.com/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
        }),
      })

      // Mock authentication to fail
      mockAuthenticateRequest.mockRejectedValueOnce(new OAuthError('Missing token', 401))

      const response = await worker.fetch(request, mockEnv)

      expect(response.status).toBe(401)
    })
  })

  describe('OPTIONS requests', () => {
    it('should handle CORS preflight requests', async () => {
      const request = new Request('https://example.com/api/memories', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:3002', // Valid origin
        },
      })

      const response = await worker.fetch(request, mockEnv)

      expect(response.status).toBe(200)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3002')
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
        'GET, POST, PUT, DELETE, OPTIONS'
      )
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization')
    })

    it('should reject CORS requests from unauthorized origins', async () => {
      const request = new Request('https://example.com/api/memories', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://malicious-site.com',
        },
      })

      const response = await worker.fetch(request, mockEnv)

      expect(response.status).toBe(200)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('null')
    })
  })

  describe('API proxy to Durable Object (protected)', () => {
    it('should proxy requests to Durable Object with authenticated user', async () => {
      const request = new Request('https://example.com/api/memories', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer mock-token',
          'Origin': 'http://localhost:3002',
        },
      })

      const response = await worker.fetch(request, mockEnv)

      expect(mockDurableObjectNamespace.idFromName).toHaveBeenCalledWith('test-user-id')
      expect(mockDurableObjectNamespace.get).toHaveBeenCalledWith('test-id')
      
      expect(response.status).toBe(200)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3002')
    })

    it('should require authentication for API requests', async () => {
      // Mock authentication failure
      mockAuthenticateRequest.mockRejectedValueOnce(new OAuthError('Missing token', 401))
      
      const request = new Request('https://example.com/api/memories', {
        method: 'GET',
      })

      const response = await worker.fetch(request, mockEnv)

      expect(response.status).toBe(401)
    })

    it('should handle Durable Object errors with authentication', async () => {
      mockDurableObject.fetch.mockRejectedValueOnce(new Error('Durable Object error'))

      const request = new Request('https://example.com/api/memories', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer mock-token',
          'Origin': 'http://localhost:3002',
        },
      })

      const response = await worker.fetch(request, mockEnv)

      expect(response.status).toBe(500)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3002')

      const errorData = await response.json()
      expect(errorData.error).toContain('Server error:')
    })
  })

  describe('Environment configuration', () => {
    it('should work with different environment values', async () => {
      const prodEnv = { ...mockEnv, ENVIRONMENT: 'production' }

      const request = new Request('https://example.com/')
      const response = await worker.fetch(request, prodEnv)

      expect(response.status).toBe(200)
      expect(await response.text()).toBe('MCP Memory Server - Ready for connections')
    })

    it('should require OAuth environment variables', async () => {
      // This test verifies that the OAuth config is being used
      const request = new Request('https://example.com/auth')
      const response = await worker.fetch(request, mockEnv)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.authUrl).toBeDefined()
    })
  })
})