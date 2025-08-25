/**
 * Tests for the Workers-compatible OAuth2 handler
 */

import { OAuth2Handler } from '../oauth'

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

// Mock fetch for userinfo fallback
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('OAuth2Handler (Workers Compatible)', () => {
  let handler: OAuth2Handler

  beforeEach(() => {
    handler = new OAuth2Handler({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/auth/callback',
    })
    
    // Clear fetch mock
    mockFetch.mockClear()
  })

  describe('generateAuthUrl', () => {
    it('should use the correct Google OAuth v2 endpoint', () => {
      const url = handler.generateAuthUrl()
      
      expect(url).toMatch(/^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/)
    })

    it('should generate OAuth2 authorization URL with correct parameters', () => {
      const url = handler.generateAuthUrl()

      const urlObj = new URL(url)
      expect(urlObj.origin + urlObj.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
      expect(urlObj.searchParams.get('client_id')).toBe('test-client-id')
      expect(urlObj.searchParams.get('response_type')).toBe('code')
      expect(urlObj.searchParams.get('scope')).toBe('openid email profile')
      expect(urlObj.searchParams.get('access_type')).toBe('offline')
      expect(urlObj.searchParams.get('include_granted_scopes')).toBe('true')
      expect(urlObj.searchParams.get('redirect_uri')).toBe('http://localhost:3000/auth/callback')
    })

    it('should accept custom scopes and state', () => {
      const customScopes = ['openid', 'email']
      const state = 'custom-state-123'
      
      const url = handler.generateAuthUrl(customScopes, state)
      
      const urlObj = new URL(url)
      expect(urlObj.searchParams.get('scope')).toBe('openid email')
      expect(urlObj.searchParams.get('state')).toBe('custom-state-123')
    })

    it('should NOT use the deprecated oauth2/auth endpoint', () => {
      const url = handler.generateAuthUrl()
      
      // Ensure we're not using the old endpoint that caused 404 errors
      expect(url).not.toMatch(/\/oauth2\/auth\?/)
      expect(url).toMatch(/\/o\/oauth2\/v2\/auth\?/)
    })
  })

  describe('exchangeCodeForToken', () => {
    it('should successfully exchange authorization code for tokens', async () => {
      const mockTokens = {
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'openid email profile',
        id_token: 'id-token-789',
      }
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockTokens),
      })

      const result = await handler.exchangeCodeForToken('auth-code-123')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      )
      
      expect(result).toEqual({
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'openid email profile',
        id_token: 'id-token-789',
      })
    })

    it('should handle token exchange errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: jest.fn().mockResolvedValue({
          error: 'invalid_grant',
          error_description: 'Invalid authorization code'
        }),
        statusText: 'Bad Request'
      })

      await expect(handler.exchangeCodeForToken('invalid-code'))
        .rejects.toThrow('Token exchange failed: Invalid authorization code')
    })

    it('should use the correct Google token endpoint', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ access_token: 'test' }),
      })

      await handler.exchangeCodeForToken('test-code')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.any(Object)
      )
    })
  })

  describe('refreshToken', () => {
    it('should successfully refresh access token', async () => {
      const mockTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'openid email profile',
      }
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockTokenResponse),
      })

      const result = await handler.refreshToken('old-refresh-token')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      )
      expect(result).toEqual({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'openid email profile',
      })
    })

    it('should handle refresh token errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: jest.fn().mockResolvedValue({
          error: 'invalid_grant',
          error_description: 'Invalid refresh token'
        }),
        statusText: 'Bad Request'
      })

      await expect(handler.refreshToken('invalid-refresh-token'))
        .rejects.toThrow('Token refresh failed: Invalid refresh token')
    })
  })

  describe('validateToken', () => {
    it('should handle MCP service tokens', async () => {
      const serviceToken = 'mcp_service_token_123_abc'
      
      const result = await handler.validateToken(serviceToken)
      
      expect(result).toEqual({
        id: 'mcp_service_user',
        email: 'mcp-service@internal',
        verified_email: true,
        name: 'MCP Service',
        given_name: 'MCP',
        family_name: 'Service',
        picture: '',
        locale: 'en',
      })
      
      // Should not call Google API for service tokens
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should validate Google access tokens via userinfo endpoint', async () => {
      const mockUserInfo = {
        id: 'google-user-123',
        email: 'user@example.com',
        verified_email: true,
        name: 'Test User',
        given_name: 'Test',
        family_name: 'User',
        picture: 'https://example.com/photo.jpg',
        locale: 'en',
      }
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockUserInfo),
      })

      const result = await handler.validateToken('google-access-token')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        {
          headers: {
            'Authorization': 'Bearer google-access-token',
          },
        }
      )
      expect(result).toEqual(mockUserInfo)
    })

    it('should reject unverified email addresses from userinfo endpoint', async () => {
      const mockUserInfo = {
        id: 'google-user-123',
        email: 'unverified@example.com',
        verified_email: false,
        name: 'Unverified User',
      }
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockUserInfo),
      })

      await expect(handler.validateToken('token-with-unverified-email'))
        .rejects.toThrow('Email address is not verified')
    })

    it('should handle token validation failures', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      await expect(handler.validateToken('invalid-token'))
        .rejects.toThrow('Failed to validate access token')
    })
  })

  describe('extractBearerToken', () => {
    it('should extract token from Bearer authorization header', () => {
      expect(handler.extractBearerToken('Bearer token123')).toBe('token123')
    })

    it('should handle case-insensitive Bearer prefix', () => {
      expect(handler.extractBearerToken('bearer token456')).toBe('token456')
      expect(handler.extractBearerToken('BEARER token789')).toBe('token789')
    })

    it('should return null for invalid headers', () => {
      expect(handler.extractBearerToken(null)).toBe(null)
      expect(handler.extractBearerToken(undefined)).toBe(null)
      expect(handler.extractBearerToken('')).toBe(null)
      expect(handler.extractBearerToken('Basic credentials')).toBe(null)
      expect(handler.extractBearerToken('Bearer')).toBe(null)
    })
  })

  describe('authenticateRequest', () => {
    it('should successfully authenticate request with valid token', async () => {
      const mockRequest = new Request('http://localhost:3000/api/test', {
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      })

      const mockUserInfo = {
        id: 'user-123',
        email: 'test@example.com',
        verified_email: true,
        name: 'Test User',
        given_name: 'Test',
        family_name: 'User',
        picture: '',
        locale: 'en',
      }
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockUserInfo),
      })

      const result = await handler.authenticateRequest(mockRequest)

      expect(result.user.id).toBe('user-123')
      expect(result.user.email).toBe('test@example.com')
      expect(result.token).toBe('valid-token')
    })

    it('should throw error for missing authorization header', async () => {
      const mockRequest = new Request('http://localhost:3000/api/test')

      await expect(handler.authenticateRequest(mockRequest))
        .rejects.toThrow('Authorization header is missing or invalid')
    })

    it('should handle authentication failures', async () => {
      const mockRequest = new Request('http://localhost:3000/api/test', {
        headers: {
          'Authorization': 'Bearer invalid-token',
        },
      })

      mockFetch.mockRejectedValue(new Error('Network error'))

      await expect(handler.authenticateRequest(mockRequest))
        .rejects.toThrow('Failed to validate access token')
    })
  })
})