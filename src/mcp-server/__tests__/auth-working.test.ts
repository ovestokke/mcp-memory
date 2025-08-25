/**
 * Working Authentication Tests
 * 
 * Simplified integration tests that focus on the actual authentication
 * functionality without complex endpoint simulation.
 */

import { OAuth2Handler } from '../../shared/auth/oauth'

// Mock google-auth-library
const mockVerifyIdToken = jest.fn()
const mockSetCredentials = jest.fn()

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: mockVerifyIdToken,
    setCredentials: mockSetCredentials,
  })),
}))

// Mock fetch for userinfo fallback
const mockFetch = jest.fn()
global.fetch = mockFetch

// Mock logger
jest.mock('../../shared/utils/logger', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    time: jest.fn((name, fn) => fn()),
    withContext: jest.fn(),
  }
  
  mockLogger.withContext.mockReturnValue(mockLogger)
  
  return {
    logger: mockLogger,
  }
})

describe('Authentication Working Tests', () => {
  let oauthHandler: OAuth2Handler

  beforeEach(() => {
    oauthHandler = new OAuth2Handler({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    })
    
    // Clear all mocks
    mockFetch.mockClear()
    mockVerifyIdToken.mockClear()
    mockSetCredentials.mockClear()
  })

  describe('MCP Service Token Authentication', () => {
    it('should authenticate MCP service tokens correctly', async () => {
      const serviceToken = 'mcp_service_token_123456789_abcdef'
      
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
      
      // Should not make any HTTP requests for service tokens
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should authenticate MCP requests end-to-end', async () => {
      const request = new Request('http://localhost:8787/mcp', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer mcp_service_token_test_123',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 1,
        }),
      })

      const { user, token } = await oauthHandler.authenticateRequest(request)

      expect(user.id).toBe('mcp_service_user')
      expect(user.email).toBe('mcp-service@internal')
      expect(token).toBe('mcp_service_token_test_123')
    })
  })

  describe('Google OAuth Authentication', () => {
    it('should authenticate Google OAuth tokens correctly', async () => {
      // Mock verifyIdToken to fail (not an ID token)
      const mockTicket = {
        getPayload: jest.fn().mockReturnValue(null)
      }
      mockVerifyIdToken.mockResolvedValue(mockTicket)
      
      // Mock userinfo fallback response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: '12345',
          email: 'user@example.com',
          verified_email: true,
          name: 'Test User',
          given_name: 'Test',
          family_name: 'User',
          picture: 'https://example.com/photo.jpg',
          locale: 'en',
        }),
      })

      const userInfo = await oauthHandler.validateToken('google-oauth-token')

      expect(userInfo.id).toBe('12345')
      expect(userInfo.email).toBe('user@example.com')
      expect(userInfo.verified_email).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        expect.any(Object)
      )
    })

    it('should authenticate web UI requests end-to-end', async () => {
      // Mock verifyIdToken to fail (not an ID token)
      const mockTicket = {
        getPayload: jest.fn().mockReturnValue(null)
      }
      mockVerifyIdToken.mockResolvedValue(mockTicket)
      
      // Mock userinfo fallback response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: '67890',
          email: 'webuser@example.com',
          verified_email: true,
          name: 'Web User',
          given_name: 'Web',
          family_name: 'User',
          picture: '',
          locale: 'en',
        }),
      })

      const request = new Request('http://localhost:8787/api/memories', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ya29.google-web-token',
        },
      })

      const { user, token } = await oauthHandler.authenticateRequest(request)

      expect(user.id).toBe('67890')
      expect(user.email).toBe('webuser@example.com')
      expect(token).toBe('ya29.google-web-token')
    })
  })

  describe('Authentication Flow Differentiation', () => {
    it('should handle both MCP and Google tokens in same system', async () => {
      // Test MCP token first
      const mcpUser = await oauthHandler.validateToken('mcp_service_token_abc_123')
      expect(mcpUser.id).toBe('mcp_service_user')

      // Test Google token second
      // Mock verifyIdToken to fail (not an ID token)
      const mockTicket = {
        getPayload: jest.fn().mockReturnValue(null)
      }
      mockVerifyIdToken.mockResolvedValue(mockTicket)
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: '999',
          email: 'mixed@example.com',
          verified_email: true,
          name: 'Mixed User',
          given_name: 'Mixed',
          family_name: 'User',
          picture: '',
          locale: 'en',
        }),
      })

      const googleUser = await oauthHandler.validateToken('ya29.different-token')
      expect(googleUser.id).toBe('999')

      // Verify they are different users
      expect(mcpUser.id).not.toBe(googleUser.id)
      expect(mcpUser.email).not.toBe(googleUser.email)
    })

    it('should properly identify token types', () => {
      // MCP tokens start with 'mcp_service_token_'
      expect(oauthHandler.extractBearerToken('Bearer mcp_service_token_123_abc')).toBe('mcp_service_token_123_abc')
      
      // Google tokens are various formats
      expect(oauthHandler.extractBearerToken('Bearer ya29.google-token')).toBe('ya29.google-token')
      expect(oauthHandler.extractBearerToken('Bearer 1//some-google-token')).toBe('1//some-google-token')
    })
  })

  describe('Error Scenarios', () => {
    const fail = (message?: string) => {
      throw new Error(message || 'Test should not reach this point')
    }

    it('should handle missing auth headers', async () => {
      const request = new Request('http://localhost:8787/api/test')

      try {
        await oauthHandler.authenticateRequest(request)
        fail('Should have thrown an error')
      } catch (error: any) {
        expect(error.message).toContain('Authorization header')
        expect(error.status).toBe(401)
      }
    })

    it('should handle invalid Google tokens', async () => {
      // Mock verifyIdToken to fail
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'))
      
      // Mock userinfo fallback to also fail
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: jest.fn().mockResolvedValue({
          error: 'invalid_token',
        }),
      })

      try {
        await oauthHandler.validateToken('invalid-google-token')
        fail('Should have thrown an error')
      } catch (error: any) {
        expect(error.message).toContain('Failed to validate access token')
        expect(error.status).toBe(401)
      }
    })

    it('should handle network failures gracefully', async () => {
      // Mock verifyIdToken to fail
      mockVerifyIdToken.mockRejectedValue(new Error('Network timeout'))
      
      // Mock userinfo fallback to also fail
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'))

      try {
        await oauthHandler.validateToken('network-error-token')
        fail('Should have thrown an error')
      } catch (error: any) {
        expect(error.message).toBe('Failed to validate access token')
      }
    })
  })
})

// Helper function
const fail = (message?: string) => {
  throw new Error(message || 'Test should not reach this point')
}