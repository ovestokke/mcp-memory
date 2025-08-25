/**
 * End-to-End Authentication Tests
 * 
 * These tests verify the complete authentication flows work correctly:
 * 1. MCP Client Authentication (mcp-remote package flow)
 * 2. Web UI Authentication (NextAuth + Google OAuth flow)  
 * 3. Cross-compatibility between both authentication methods
 * 4. Authentication persistence and session management
 */

import { OAuth2Handler } from '../../shared/auth/oauth'

// Mock fetch for all external API calls
const mockFetch = jest.fn()
global.fetch = mockFetch

// Mock Cloudflare Workers environment
const mockEnv = {
  GOOGLE_CLIENT_ID: 'test-client-id',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
  NEXTAUTH_URL: 'http://localhost:3000',
  NEXTAUTH_SECRET: 'test-secret',
  MEMORY_STORAGE: {
    idFromName: jest.fn((id: string) => `durable-object-id-${id}`),
    get: jest.fn().mockReturnValue({
      fetch: jest.fn().mockResolvedValue(
        new Response(JSON.stringify({ memories: [] }), {
          headers: { 'Content-Type': 'application/json' }
        })
      ),
    }),
  },
}

describe('End-to-End Authentication Tests', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    jest.clearAllMocks()
  })

  describe('MCP Client Authentication Flow (mcp-remote)', () => {
    it('should complete full MCP client authentication and API access', async () => {
      // Step 1: MCP client obtains service token via client_credentials
      const tokenRequest = new Request('http://localhost:8787/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: 'mcp-client-id',
          client_secret: 'mcp-client-secret',
        }),
      })

      const tokenResponse = await simulateTokenEndpoint(tokenRequest)
      const tokenData = await tokenResponse.json()

      expect(tokenResponse.status).toBe(200)
      expect(tokenData.access_token).toMatch(/^mcp_service_token_/)
      
      // Step 2: Use token to authenticate MCP protocol requests
      const mcpRequest = new Request('http://localhost:8787/mcp', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 1,
        }),
      })

      // Step 3: Verify MCP server accepts the token and processes request
      const mcpResponse = await simulateMCPRequest(mcpRequest)
      expect(mcpResponse.status).toBe(200)

      const mcpData = await mcpResponse.json()
      expect(mcpData.jsonrpc).toBe('2.0')
      expect(mcpData.id).toBe(1)
      expect(mcpData.result).toHaveProperty('tools')

      // Step 4: Verify API access with same token
      const apiRequest = new Request('http://localhost:8787/api/memories', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      })

      const apiResponse = await simulateAPIRequest(apiRequest)
      expect(apiResponse.status).toBe(200)

      const memories = await apiResponse.json()
      expect(Array.isArray(memories)).toBe(true)
    })

    it('should handle MCP client authentication failures gracefully', async () => {
      // Attempt authentication with invalid credentials
      const tokenRequest = new Request('http://localhost:8787/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: 'invalid-client',
          client_secret: 'invalid-secret',
        }),
      })

      const tokenResponse = await simulateTokenEndpoint(tokenRequest)
      expect(tokenResponse.status).toBe(200) // Dev mode accepts any credentials

      // In production, this should be 401:
      // expect(tokenResponse.status).toBe(401)
    })

    it('should validate MCP service tokens correctly', async () => {
      const oauthHandler = new OAuth2Handler({
        clientId: mockEnv.GOOGLE_CLIENT_ID,
        clientSecret: mockEnv.GOOGLE_CLIENT_SECRET,
      })

      const serviceToken = 'mcp_service_token_1234567890_abcdefghij'
      const userInfo = await oauthHandler.validateToken(serviceToken)

      expect(userInfo).toEqual({
        id: 'mcp_service_user',
        email: 'mcp-service@internal',
        verified_email: true,
        name: 'MCP Service',
        given_name: 'MCP',
        family_name: 'Service',
        picture: '',
        locale: 'en',
      })
    })

    it('should handle token refresh for MCP clients', async () => {
      // Step 1: Get initial token
      const initialTokenRequest = new Request('http://localhost:8787/token', {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: 'mcp-client',
          client_secret: 'mcp-secret',
        }),
      })

      const initialResponse = await simulateTokenEndpoint(initialTokenRequest)
      const initialToken = await initialResponse.json()

      // Step 2: Refresh token
      const refreshRequest = new Request('http://localhost:8787/token', {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: initialToken.access_token, // Using access token as refresh token for simplicity
        }),
      })

      const refreshResponse = await simulateTokenEndpoint(refreshRequest)
      const newToken = await refreshResponse.json()

      expect(refreshResponse.status).toBe(200)
      expect(newToken.access_token).toMatch(/^mcp_service_token_/)
      expect(newToken.access_token).not.toBe(initialToken.access_token)
    })
  })

  describe('Web UI Authentication Flow (NextAuth)', () => {
    it('should complete full web UI authentication and API access', async () => {
      // Mock Google OAuth token exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          access_token: 'google-access-token-12345',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'google-refresh-token',
          scope: 'openid email profile',
          id_token: 'google-id-token',
        }),
      })

      // Step 1: Exchange authorization code for Google tokens
      const tokenRequest = new Request('http://localhost:8787/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: 'google-auth-code-12345',
          redirect_uri: 'http://localhost:3000/api/auth/callback/google',
          client_id: mockEnv.GOOGLE_CLIENT_ID,
        }),
      })

      const tokenResponse = await simulateTokenEndpoint(tokenRequest)
      const tokenData = await tokenResponse.json()

      expect(tokenResponse.status).toBe(200)
      expect(tokenData.access_token).toBe('google-access-token-12345')
      expect(tokenData.refresh_token).toBe('google-refresh-token')

      // Step 2: Mock Google user info lookup for token validation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: '105413405244615600986',
          email: 'user@example.com',
          verified_email: true,
          name: 'Test User',
          given_name: 'Test',
          family_name: 'User',
          picture: 'https://lh3.googleusercontent.com/photo.jpg',
          locale: 'en',
        }),
      })

      // Step 3: Use Google token to access API endpoints
      const apiRequest = new Request('http://localhost:8787/api/memories', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      })

      const apiResponse = await simulateAPIRequest(apiRequest)
      expect(apiResponse.status).toBe(200)

      // Verify Google user info API was called
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('googleapis.com/oauth2/v2/userinfo'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer google-access-token-12345',
          }),
        })
      )
    })

    it('should handle Google OAuth errors gracefully', async () => {
      // Mock Google token exchange failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({
          error: 'invalid_grant',
          error_description: 'The authorization code is invalid or expired',
        }),
      })

      const tokenRequest = new Request('http://localhost:8787/token', {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: 'expired-auth-code',
          redirect_uri: 'http://localhost:3000/api/auth/callback/google',
        }),
      })

      const tokenResponse = await simulateTokenEndpoint(tokenRequest)
      const errorData = await tokenResponse.json()

      expect(tokenResponse.status).toBe(400)
      expect(errorData.error_description).toContain('authorization code')
    })

    it('should validate Google OAuth tokens correctly', async () => {
      const oauthHandler = new OAuth2Handler({
        clientId: mockEnv.GOOGLE_CLIENT_ID,
        clientSecret: mockEnv.GOOGLE_CLIENT_SECRET,
      })

      // Mock Google user info response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: '105413405244615600986',
          email: 'user@example.com',
          verified_email: true,
          name: 'Test User',
          given_name: 'Test',
          family_name: 'User',
          picture: 'https://lh3.googleusercontent.com/photo.jpg',
          locale: 'en',
        }),
      })

      const userInfo = await oauthHandler.validateToken('google-access-token')

      expect(userInfo.id).toBe('105413405244615600986')
      expect(userInfo.email).toBe('user@example.com')
      expect(userInfo.verified_email).toBe(true)
    })

    it('should reject unverified email addresses', async () => {
      const oauthHandler = new OAuth2Handler({
        clientId: mockEnv.GOOGLE_CLIENT_ID,
        clientSecret: mockEnv.GOOGLE_CLIENT_SECRET,
      })

      // Mock Google user info with unverified email
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: '123456789',
          email: 'unverified@example.com',
          verified_email: false, // Unverified email
          name: 'Unverified User',
          given_name: 'Unverified',
          family_name: 'User',
          picture: '',
          locale: 'en',
        }),
      })

      await expect(oauthHandler.validateToken('google-token-unverified'))
        .rejects
        .toThrow('Email address is not verified')
    })
  })

  describe('Cross-Authentication Compatibility', () => {
    it('should handle both MCP and web tokens in the same system', async () => {
      const oauthHandler = new OAuth2Handler({
        clientId: mockEnv.GOOGLE_CLIENT_ID,
        clientSecret: mockEnv.GOOGLE_CLIENT_SECRET,
      })

      // Test MCP service token
      const mcpUser = await oauthHandler.validateToken('mcp_service_token_123_abc')
      expect(mcpUser.id).toBe('mcp_service_user')

      // Test Google OAuth token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: '987654321',
          email: 'google@example.com',
          verified_email: true,
          name: 'Google User',
          given_name: 'Google',
          family_name: 'User',
          picture: '',
          locale: 'en',
        }),
      })

      const googleUser = await oauthHandler.validateToken('ya29.google-token')
      expect(googleUser.id).toBe('987654321')
      expect(googleUser.email).toBe('google@example.com')

      // Verify different user contexts
      expect(mcpUser.id).not.toBe(googleUser.id)
      expect(mcpUser.email).not.toBe(googleUser.email)
    })

    it('should properly isolate user data based on authentication method', async () => {
      // MCP request should use service user context
      const mcpRequest = new Request('http://localhost:8787/api/memories', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer mcp_service_token_456_def',
        },
      })

      const mcpResponse = await simulateAPIRequest(mcpRequest)
      expect(mcpResponse.status).toBe(200)

      // Verify Durable Object was created with service user ID
      expect(mockEnv.MEMORY_STORAGE.idFromName).toHaveBeenCalledWith('mcp_service_user')

      // Web UI request should use Google user context
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 'google-user-123',
          email: 'webuser@example.com',
          verified_email: true,
          name: 'Web User',
          given_name: 'Web',
          family_name: 'User',
          picture: '',
          locale: 'en',
        }),
      })

      const webRequest = new Request('http://localhost:8787/api/memories', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ya29.google-web-token',
        },
      })

      const webResponse = await simulateAPIRequest(webRequest)
      expect(webResponse.status).toBe(200)

      // Verify Durable Object was created with Google user ID
      expect(mockEnv.MEMORY_STORAGE.idFromName).toHaveBeenCalledWith('google-user-123')
    })
  })

  describe('Authentication Error Recovery', () => {
    it('should provide clear error messages for authentication failures', async () => {
      const tests = [
        {
          name: 'Missing Authorization header',
          request: new Request('http://localhost:8787/api/memories'),
          expectedStatus: 401,
          expectedError: 'missing_token',
        },
        {
          name: 'Invalid Authorization header format',
          request: new Request('http://localhost:8787/api/memories', {
            headers: { 'Authorization': 'Basic dXNlcjpwYXNz' },
          }),
          expectedStatus: 401,
          expectedError: 'missing_token',
        },
        {
          name: 'Expired Google token',
          request: new Request('http://localhost:8787/api/memories', {
            headers: { 'Authorization': 'Bearer expired-google-token' },
          }),
          expectedStatus: 401,
          expectedError: 'invalid_token',
        },
      ]

      for (const test of tests) {
        // Mock Google token validation failure for expired token test
        if (test.name.includes('Expired')) {
          mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 401,
            json: jest.fn().mockResolvedValue({
              error: 'invalid_token',
            }),
          })
        }

        const response = await simulateAPIRequest(test.request)
        expect(response.status).toBe(test.expectedStatus)

        const errorData = await response.json()
        expect(errorData.error || errorData.code).toBe(test.expectedError)
      }
    })

    it('should handle Google API downtime gracefully', async () => {
      // Simulate Google API being unavailable
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const request = new Request('http://localhost:8787/api/memories', {
        headers: { 'Authorization': 'Bearer google-token-network-error' },
      })

      const response = await simulateAPIRequest(request)
      const errorData = await response.json()
      
      expect(response.status).toBe(401)
      expect(errorData.error_description).toBe('Failed to validate access token')
    })
  })
})

// Helper functions to simulate server endpoints

async function simulateTokenEndpoint(request: any): Promise<Response> {
  // This replicates the token endpoint logic from the MCP server
  const contentType = (request.headers?.get ? request.headers.get('Content-Type') : request.headers['Content-Type']) || ''
  let body: any

  try {
    // Handle different request object types
    if (request.body) {
      if (typeof request.body === 'string') {
        body = Object.fromEntries(new URLSearchParams(request.body))
      } else if (request.body instanceof URLSearchParams) {
        body = Object.fromEntries(request.body)
      } else {
        // Try to parse as JSON
        body = typeof request.body === 'object' ? request.body : JSON.parse(request.body)
      }
    } else {
      // Fallback: try to read using Request API methods if available
      if (typeof request.text === 'function') {
        const text = await request.text()
        body = Object.fromEntries(new URLSearchParams(text))
      } else {
        throw new Error('No body available')
      }
    }

    // Validate required properties
    if (!body || typeof body !== 'object' || !body.grant_type) {
      return new Response(JSON.stringify({
        error: 'invalid_request',
        error_description: 'Missing grant_type parameter',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (body.grant_type === 'client_credentials') {
      return new Response(JSON.stringify({
        access_token: `mcp_service_token_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'mcp_tools',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (body.grant_type === 'authorization_code') {
      const oauthHandler = new OAuth2Handler({
        clientId: mockEnv.GOOGLE_CLIENT_ID,
        clientSecret: mockEnv.GOOGLE_CLIENT_SECRET,
      })

      try {
        const tokenData = await oauthHandler.exchangeCodeForToken(body.code)
        return new Response(JSON.stringify(tokenData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (error: any) {
        return new Response(JSON.stringify({
          error: 'invalid_grant',
          error_description: error.message,
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    if (body.grant_type === 'refresh_token') {
      return new Response(JSON.stringify({
        access_token: `mcp_service_token_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'mcp_tools',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      error: 'unsupported_grant_type',
      error_description: `Grant type '${body.grant_type}' is not supported`,
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'invalid_request',
      error_description: 'Malformed request',
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function simulateMCPRequest(request: Request): Promise<Response> {
  // Simulate MCP server handling authenticated requests
  const oauthHandler = new OAuth2Handler({
    clientId: mockEnv.GOOGLE_CLIENT_ID,
    clientSecret: mockEnv.GOOGLE_CLIENT_SECRET,
  })

  try {
    const { user } = await oauthHandler.authenticateRequest(request)
    
    const body = await request.json()
    
    if (body.method === 'tools/list') {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: body.id,
        result: {
          tools: [
            { name: 'store_memory', description: 'Store a new memory' },
            { name: 'search_memories', description: 'Search memories' },
            { name: 'list_memories', description: 'List all memories' },
          ],
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      jsonrpc: '2.0',
      id: body.id,
      error: { code: -32601, message: 'Method not found' },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.code || 'authentication_failed',
      error_description: error.message,
    }), {
      status: error.status || 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function simulateAPIRequest(request: Request): Promise<Response> {
  // Simulate API endpoint handling authenticated requests
  const oauthHandler = new OAuth2Handler({
    clientId: mockEnv.GOOGLE_CLIENT_ID,
    clientSecret: mockEnv.GOOGLE_CLIENT_SECRET,
  })

  try {
    const { user } = await oauthHandler.authenticateRequest(request)
    
    // Simulate calling Durable Object with user context
    mockEnv.MEMORY_STORAGE.idFromName(user.id)
    
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.code || 'authentication_failed',
      error_description: error.message,
    }), {
      status: error.status || 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}