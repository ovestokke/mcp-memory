import { OAuth2Handler, OAuthError, GoogleOAuthConfig } from '../oauth'

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

// Helper function for tests
const fail = (message?: string) => {
  throw new Error(message || 'Test should not reach this point')
}

// Mock logger with proper chaining
jest.mock('../../utils/logger', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    time: jest.fn((name, fn) => fn()),
    withContext: jest.fn(),
  }
  
  // Set up recursive withContext chaining
  mockLogger.withContext.mockReturnValue(mockLogger)
  
  return {
    logger: mockLogger,
  }
})

describe('OAuth2Handler', () => {
  let oauthHandler: OAuth2Handler
  let mockConfig: GoogleOAuthConfig

  beforeEach(() => {
    mockConfig = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:8787/auth/callback',
    }
    oauthHandler = new OAuth2Handler(mockConfig)
    mockFetch.mockClear()
  })

  describe('generateAuthUrl', () => {
    it('should generate correct OAuth2 authorization URL with default parameters', () => {
      const url = oauthHandler.generateAuthUrl()
      const parsedUrl = new URL(url)

      expect(parsedUrl.origin).toBe('https://accounts.google.com')
      expect(parsedUrl.pathname).toBe('/o/oauth2/v2/auth')
      expect(parsedUrl.searchParams.get('client_id')).toBe('test-client-id')
      expect(parsedUrl.searchParams.get('response_type')).toBe('code')
      expect(parsedUrl.searchParams.get('scope')).toBe('openid email profile')
      expect(parsedUrl.searchParams.get('redirect_uri')).toBe('http://localhost:8787/auth/callback')
      expect(parsedUrl.searchParams.get('access_type')).toBe('offline')
      expect(parsedUrl.searchParams.get('prompt')).toBe('consent')
    })

    it('should include state parameter when provided', () => {
      const state = 'test-state-value'
      const url = oauthHandler.generateAuthUrl(state)
      const parsedUrl = new URL(url)

      expect(parsedUrl.searchParams.get('state')).toBe(state)
    })

    it('should accept custom scopes', () => {
      const customScopes = ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/drive']
      const url = oauthHandler.generateAuthUrl(undefined, customScopes)
      const parsedUrl = new URL(url)

      expect(parsedUrl.searchParams.get('scope')).toBe(customScopes.join(' '))
    })

    it('should use default redirect URI when none provided in config', () => {
      const configWithoutRedirect = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      }
      const handler = new OAuth2Handler(configWithoutRedirect)
      const url = handler.generateAuthUrl()
      const parsedUrl = new URL(url)

      expect(parsedUrl.searchParams.get('redirect_uri')).toBe('http://localhost:8787/auth/callback')
    })
  })

  describe('exchangeCodeForToken', () => {
    const mockTokenResponse = {
      access_token: 'test-access-token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'test-refresh-token',
      scope: 'openid email profile',
      id_token: 'test-id-token',
    }

    it('should successfully exchange authorization code for tokens', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockTokenResponse),
      })

      const result = await oauthHandler.exchangeCodeForToken('test-code')

      expect(result).toEqual(mockTokenResponse)
      expect(mockFetch).toHaveBeenCalledWith('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: expect.any(URLSearchParams),
      })

      const [, options] = mockFetch.mock.calls[0]
      const body = options.body as URLSearchParams
      expect(body.get('client_id')).toBe('test-client-id')
      expect(body.get('client_secret')).toBe('test-client-secret')
      expect(body.get('code')).toBe('test-code')
      expect(body.get('grant_type')).toBe('authorization_code')
    })

    it('should handle token exchange failures with error details', async () => {
      const errorResponse = {
        error: 'invalid_grant',
        error_description: 'The provided authorization grant is invalid',
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: jest.fn().mockResolvedValue(errorResponse),
      })

      try {
        await oauthHandler.exchangeCodeForToken('invalid-code')
        fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeInstanceOf(OAuthError)
        expect((error as OAuthError).status).toBe(400)
        expect((error as OAuthError).code).toBe('invalid_grant')
        expect(error.message).toContain('The provided authorization grant is invalid')
      }
    })

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(oauthHandler.exchangeCodeForToken('test-code'))
        .rejects
        .toThrow('Failed to exchange authorization code for token')
    })

    it('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      })

      await expect(oauthHandler.exchangeCodeForToken('test-code'))
        .rejects
        .toThrow(OAuthError)
    })
  })

  describe('refreshToken', () => {
    const mockRefreshResponse = {
      access_token: 'new-access-token',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'openid email profile',
    }

    it('should successfully refresh access token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockRefreshResponse),
      })

      const result = await oauthHandler.refreshToken('test-refresh-token')

      expect(result).toEqual(mockRefreshResponse)
      expect(mockFetch).toHaveBeenCalledWith('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: expect.any(URLSearchParams),
      })

      const [, options] = mockFetch.mock.calls[0]
      const body = options.body as URLSearchParams
      expect(body.get('grant_type')).toBe('refresh_token')
      expect(body.get('refresh_token')).toBe('test-refresh-token')
    })

    it('should handle refresh token failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({
          error: 'invalid_grant',
          error_description: 'The refresh token is invalid',
        }),
      })

      await expect(oauthHandler.refreshToken('invalid-refresh-token'))
        .rejects
        .toThrow(OAuthError)
    })
  })

  describe('validateToken', () => {
    const mockUserInfo = {
      id: '12345',
      email: 'test@example.com',
      verified_email: true,
      name: 'Test User',
      given_name: 'Test',
      family_name: 'User',
      picture: 'https://example.com/picture.jpg',
      locale: 'en',
    }

    it('should validate Google OAuth tokens and return user info', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockUserInfo),
      })

      const result = await oauthHandler.validateToken('valid-access-token')

      expect(result).toEqual(mockUserInfo)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/oauth2/v2/userinfo?access_token=valid-access-token',
        {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer valid-access-token',
          },
        }
      )
    })

    it('should handle MCP service tokens correctly', async () => {
      const result = await oauthHandler.validateToken('mcp_service_token_12345_abcdef')

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
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should reject invalid tokens', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: jest.fn().mockResolvedValue({
          error: 'invalid_token',
          error_description: 'Invalid access token',
        }),
      })

      await expect(oauthHandler.validateToken('invalid-token'))
        .rejects
        .toThrow(OAuthError)
    })

    it('should reject tokens for unverified email addresses', async () => {
      const unverifiedUserInfo = {
        ...mockUserInfo,
        verified_email: false,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(unverifiedUserInfo),
      })

      try {
        await oauthHandler.validateToken('token-unverified-email')
        fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeInstanceOf(OAuthError)
        expect((error as OAuthError).status).toBe(403)
        expect((error as OAuthError).code).toBe('email_not_verified')
        expect(error.message).toContain('Email address is not verified')
      }
    })
  })

  describe('extractBearerToken', () => {
    it('should extract token from valid Bearer authorization header', () => {
      const token = oauthHandler.extractBearerToken('Bearer test-token-123')
      expect(token).toBe('test-token-123')
    })

    it('should handle case-insensitive Bearer prefix', () => {
      const token = oauthHandler.extractBearerToken('bearer test-token-123')
      expect(token).toBe('test-token-123')
    })

    it('should return null for invalid authorization headers', () => {
      expect(oauthHandler.extractBearerToken('Invalid auth-header')).toBeNull()
      expect(oauthHandler.extractBearerToken('Basic dXNlcjpwYXNz')).toBeNull()
      expect(oauthHandler.extractBearerToken('')).toBeNull()
      expect(oauthHandler.extractBearerToken(null)).toBeNull()
      expect(oauthHandler.extractBearerToken(undefined)).toBeNull()
    })
  })

  describe('authenticateRequest', () => {
    it('should successfully authenticate request with valid token', async () => {
      const mockUserInfo = {
        id: '12345',
        email: 'test@example.com',
        verified_email: true,
        name: 'Test User',
        given_name: 'Test',
        family_name: 'User',
        picture: 'https://example.com/picture.jpg',
        locale: 'en',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockUserInfo),
      })

      const mockRequest = new Request('https://example.com/api/test', {
        headers: {
          'Authorization': 'Bearer valid-access-token',
        },
      })

      const result = await oauthHandler.authenticateRequest(mockRequest)

      expect(result.user).toEqual(mockUserInfo)
      expect(result.token).toBe('valid-access-token')
    })

    it('should handle MCP service token authentication', async () => {
      const mockRequest = new Request('https://example.com/mcp', {
        headers: {
          'Authorization': 'Bearer mcp_service_token_12345_abcdef',
        },
      })

      const result = await oauthHandler.authenticateRequest(mockRequest)

      expect(result.user.id).toBe('mcp_service_user')
      expect(result.user.email).toBe('mcp-service@internal')
      expect(result.token).toBe('mcp_service_token_12345_abcdef')
    })

    it('should throw error for missing authorization header', async () => {
      const mockRequest = new Request('https://example.com/api/test')

      await expect(oauthHandler.authenticateRequest(mockRequest))
        .rejects
        .toThrow('Authorization header with Bearer token is required')

      try {
        await oauthHandler.authenticateRequest(mockRequest)
      } catch (error) {
        expect(error).toBeInstanceOf(OAuthError)
        expect((error as OAuthError).status).toBe(401)
        expect((error as OAuthError).code).toBe('missing_token')
      }
    })

    it('should throw error for invalid authorization header format', async () => {
      const mockRequest = new Request('https://example.com/api/test', {
        headers: {
          'Authorization': 'Basic dXNlcjpwYXNz',
        },
      })

      await expect(oauthHandler.authenticateRequest(mockRequest))
        .rejects
        .toThrow('Authorization header with Bearer token is required')
    })

    it('should handle token validation failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: jest.fn().mockResolvedValue({
          error: 'invalid_token',
        }),
      })

      const mockRequest = new Request('https://example.com/api/test', {
        headers: {
          'Authorization': 'Bearer invalid-token',
        },
      })

      await expect(oauthHandler.authenticateRequest(mockRequest))
        .rejects
        .toThrow(OAuthError)
    })
  })

  describe('OAuthError', () => {
    it('should create error with default status and no code', () => {
      const error = new OAuthError('Test error message')
      
      expect(error.message).toBe('Test error message')
      expect(error.status).toBe(401)
      expect(error.code).toBeUndefined()
      expect(error.name).toBe('OAuthError')
    })

    it('should create error with custom status and code', () => {
      const error = new OAuthError('Custom error', 403, 'custom_error')
      
      expect(error.message).toBe('Custom error')
      expect(error.status).toBe(403)
      expect(error.code).toBe('custom_error')
    })
  })
})