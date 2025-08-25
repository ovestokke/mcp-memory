/**
 * Tests for the refactored OAuth2 handler using google-auth-library
 */

import { OAuth2Handler } from '../oauth'

// Mock google-auth-library
const mockGenerateAuthUrl = jest.fn()
const mockGetToken = jest.fn()
const mockRefreshAccessToken = jest.fn()
const mockVerifyIdToken = jest.fn()
const mockSetCredentials = jest.fn()

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    generateAuthUrl: mockGenerateAuthUrl,
    getToken: mockGetToken,
    refreshAccessToken: mockRefreshAccessToken,
    verifyIdToken: mockVerifyIdToken,
    setCredentials: mockSetCredentials,
  })),
}))

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

describe('OAuth2Handler (Refactored)', () => {
  let handler: OAuth2Handler

  beforeEach(() => {
    handler = new OAuth2Handler({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/auth/callback',
    })
    
    // Clear all mocks
    mockGenerateAuthUrl.mockClear()
    mockGetToken.mockClear()
    mockRefreshAccessToken.mockClear()
    mockVerifyIdToken.mockClear()
    mockSetCredentials.mockClear()
    mockFetch.mockClear()
  })

  describe('generateAuthUrl', () => {
    it('should generate OAuth2 authorization URL', () => {
      const mockUrl = 'https://accounts.google.com/oauth2/auth?client_id=test&scope=openid%20email%20profile'
      mockGenerateAuthUrl.mockReturnValue(mockUrl)

      const url = handler.generateAuthUrl()

      expect(mockGenerateAuthUrl).toHaveBeenCalledWith({
        access_type: 'offline',
        scope: ['openid', 'email', 'profile'],
        state: undefined,
        include_granted_scopes: true,
      })
      expect(url).toBe(mockUrl)
    })

    it('should accept custom scopes and state', () => {
      const customScopes = ['openid', 'email']
      const state = 'custom-state-123'
      const mockUrl = 'https://accounts.google.com/oauth2/auth?state=custom-state-123'
      mockGenerateAuthUrl.mockReturnValue(mockUrl)

      const url = handler.generateAuthUrl(customScopes, state)

      expect(mockGenerateAuthUrl).toHaveBeenCalledWith({
        access_type: 'offline',
        scope: customScopes,
        state,
        include_granted_scopes: true,
      })
      expect(url).toBe(mockUrl)
    })
  })

  describe('exchangeCodeForToken', () => {
    it('should successfully exchange authorization code for tokens', async () => {
      const mockTokens = {
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        expiry_date: Date.now() + 3600000,
        scope: 'openid email profile',
        id_token: 'id-token-789',
      }
      
      mockGetToken.mockResolvedValue({ tokens: mockTokens })

      const result = await handler.exchangeCodeForToken('auth-code-123')

      expect(mockGetToken).toHaveBeenCalledWith('auth-code-123')
      expect(result).toEqual({
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        expires_in: expect.any(Number),
        token_type: 'Bearer',
        scope: 'openid email profile',
        id_token: 'id-token-789',
      })
    })

    it('should handle token exchange errors', async () => {
      const error = new Error('Invalid authorization code')
      mockGetToken.mockRejectedValue(error)

      await expect(handler.exchangeCodeForToken('invalid-code'))
        .rejects.toThrow('Invalid authorization code')
    })
  })

  describe('refreshToken', () => {
    it('should successfully refresh access token', async () => {
      const mockCredentials = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expiry_date: Date.now() + 3600000,
        scope: 'openid email profile',
      }
      
      mockRefreshAccessToken.mockResolvedValue({ credentials: mockCredentials })

      const result = await handler.refreshToken('old-refresh-token')

      expect(mockSetCredentials).toHaveBeenCalledWith({ 
        refresh_token: 'old-refresh-token' 
      })
      expect(mockRefreshAccessToken).toHaveBeenCalled()
      expect(result).toEqual({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: expect.any(Number),
        token_type: 'Bearer',
        scope: 'openid email profile',
      })
    })

    it('should handle refresh token errors', async () => {
      const error = new Error('Invalid refresh token')
      mockRefreshAccessToken.mockRejectedValue(error)

      await expect(handler.refreshToken('invalid-refresh-token'))
        .rejects.toThrow('Invalid refresh token')
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
      
      // Should not call Google Auth Library for service tokens
      expect(mockVerifyIdToken).not.toHaveBeenCalled()
    })

    it('should validate Google ID tokens', async () => {
      const mockPayload = {
        sub: 'google-user-123',
        email: 'user@example.com',
        email_verified: true,
        name: 'Test User',
        given_name: 'Test',
        family_name: 'User',
        picture: 'https://example.com/photo.jpg',
        locale: 'en',
      }
      
      const mockTicket = {
        getPayload: jest.fn().mockReturnValue(mockPayload)
      }
      
      mockVerifyIdToken.mockResolvedValue(mockTicket)

      const result = await handler.validateToken('google-id-token')

      expect(mockSetCredentials).toHaveBeenCalledWith({
        access_token: 'google-id-token'
      })
      expect(mockVerifyIdToken).toHaveBeenCalledWith({
        idToken: 'google-id-token',
        audience: 'test-client-id',
      })
      expect(result).toEqual({
        id: 'google-user-123',
        email: 'user@example.com',
        verified_email: true,
        name: 'Test User',
        given_name: 'Test',
        family_name: 'User',
        picture: 'https://example.com/photo.jpg',
        locale: 'en',
      })
    })

    it('should fall back to userinfo endpoint for access tokens', async () => {
      // Mock verifyIdToken to fail (indicating it's not an ID token)
      const mockTicket = {
        getPayload: jest.fn().mockReturnValue(null)
      }
      mockVerifyIdToken.mockResolvedValue(mockTicket)
      
      // Mock userinfo API response
      const mockUserInfo = {
        id: 'google-user-456',
        email: 'access@example.com',
        verified_email: true,
        name: 'Access User',
        given_name: 'Access',
        family_name: 'User',
        picture: '',
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
      expect(result).toEqual({
        id: 'google-user-456',
        email: 'access@example.com',
        verified_email: true,
        name: 'Access User',
        given_name: 'Access',
        family_name: 'User',
        picture: '',
        locale: 'en',
      })
    })

    it('should reject unverified email addresses', async () => {
      // Mock ID token with unverified email
      const mockPayload = {
        sub: 'google-user-123',
        email: 'unverified@example.com',
        email_verified: false,
        name: 'Unverified User',
        given_name: 'Unverified',
        family_name: 'User',
        picture: '',
        locale: 'en',
      }
      
      const mockTicket = {
        getPayload: jest.fn().mockReturnValue(mockPayload)
      }
      
      // Reset all mocks first
      mockVerifyIdToken.mockClear()
      mockFetch.mockClear()
      mockSetCredentials.mockClear()
      
      // Set up the specific mock for this test
      mockVerifyIdToken.mockResolvedValue(mockTicket)

      await expect(handler.validateToken('token-with-unverified-email'))
        .rejects.toThrow('Email address is not verified')
    })

    it('should handle token validation failures', async () => {
      const error = new Error('Token verification failed')
      mockVerifyIdToken.mockRejectedValue(error)
      
      // Also mock fetch to fail for userinfo fallback
      mockFetch.mockClear()
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

      const mockPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        email_verified: true,
        name: 'Test User',
        given_name: 'Test',
        family_name: 'User',
        picture: '',
        locale: 'en',
      }
      
      const mockTicket = {
        getPayload: jest.fn().mockReturnValue(mockPayload)
      }
      
      mockVerifyIdToken.mockResolvedValue(mockTicket)

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

      const error = new Error('Invalid token')
      mockVerifyIdToken.mockRejectedValue(error)
      
      // Also mock fetch to fail for userinfo fallback
      mockFetch.mockClear()
      mockFetch.mockRejectedValue(new Error('Network error'))

      await expect(handler.authenticateRequest(mockRequest))
        .rejects.toThrow('Failed to validate access token')
    })
  })
})