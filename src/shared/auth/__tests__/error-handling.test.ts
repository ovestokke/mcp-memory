/**
 * Authentication Error Handling and Recovery Tests
 * 
 * These tests ensure our authentication system handles various failure
 * scenarios gracefully and provides good error recovery mechanisms.
 * 
 * Covers:
 * - Network failures and timeouts
 * - Token expiration and refresh scenarios  
 * - Invalid credentials and malformed requests
 * - Google API rate limiting and downtime
 * - Edge cases and boundary conditions
 */

import { OAuth2Handler, OAuthError } from '../oauth'

// Mock fetch with detailed control for different scenarios
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

describe('Authentication Error Handling and Recovery', () => {
  let oauthHandler: OAuth2Handler

  beforeEach(() => {
    oauthHandler = new OAuth2Handler({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:8787/auth/callback',
    })
    mockFetch.mockClear()
  })

  describe('Network Failure Scenarios', () => {
    it('should handle complete network failures gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      await expect(oauthHandler.exchangeCodeForToken('test-code'))
        .rejects
        .toThrow('Failed to exchange authorization code for token')

      await expect(oauthHandler.refreshToken('test-refresh-token'))
        .rejects
        .toThrow('Failed to refresh access token')

      await expect(oauthHandler.validateToken('test-token'))
        .rejects
        .toThrow('Failed to validate access token')
    })

    it('should handle DNS resolution failures', async () => {
      mockFetch.mockRejectedValue(new Error('getaddrinfo ENOTFOUND accounts.google.com'))

      await expect(oauthHandler.exchangeCodeForToken('test-code'))
        .rejects
        .toThrow('Failed to exchange authorization code for token')
    })

    it('should handle connection timeouts', async () => {
      mockFetch.mockRejectedValue(new Error('Request timeout'))

      await expect(oauthHandler.validateToken('test-token'))
        .rejects
        .toThrow('Failed to validate access token')
    })

    it('should handle SSL certificate errors', async () => {
      mockFetch.mockRejectedValue(new Error('certificate verify failed'))

      await expect(oauthHandler.exchangeCodeForToken('test-code'))
        .rejects
        .toThrow('Failed to exchange authorization code for token')
    })
  })

  describe('Google API Error Responses', () => {
    it('should handle invalid_grant errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: jest.fn().mockResolvedValue({
          error: 'invalid_grant',
          error_description: 'The provided authorization grant is invalid, expired, revoked, does not match the redirection URI used in the authorization request, or was issued to another client.',
        }),
      })

      try {
        await oauthHandler.exchangeCodeForToken('expired-code')
        fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeInstanceOf(OAuthError)
        expect((error as OAuthError).code).toBe('invalid_grant')
        expect(error.message).toContain('authorization grant')
        expect((error as OAuthError).status).toBe(400)
      }
    })

    it('should handle invalid_client errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: jest.fn().mockResolvedValue({
          error: 'invalid_client',
          error_description: 'The OAuth client was not found.',
        }),
      })

      try {
        await oauthHandler.exchangeCodeForToken('valid-code')
        fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeInstanceOf(OAuthError)
        expect((error as OAuthError).code).toBe('invalid_client')
        expect((error as OAuthError).status).toBe(401)
      }
    })

    it('should handle access_denied errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: jest.fn().mockResolvedValue({
          error: 'access_denied',
          error_description: 'The resource owner denied the request.',
        }),
      })

      try {
        await oauthHandler.exchangeCodeForToken('denied-code')
        fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeInstanceOf(OAuthError)
        expect((error as OAuthError).code).toBe('access_denied')
        expect(error.message).toContain('resource owner denied')
      }
    })

    it('should handle rate limiting (HTTP 429)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: jest.fn().mockResolvedValue({
          error: 'rate_limit_exceeded',
          error_description: 'Too many requests. Please try again later.',
        }),
      })

      try {
        await oauthHandler.validateToken('rate-limited-token')
        fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeInstanceOf(OAuthError)
        expect((error as OAuthError).status).toBe(429)
        expect(error.message).toContain('try again later')
      }
    })

    it('should handle Google API server errors (HTTP 500)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: jest.fn().mockResolvedValue({
          error: 'server_error',
          error_description: 'The server encountered an unexpected condition.',
        }),
      })

      try {
        await oauthHandler.refreshToken('server-error-token')
        fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeInstanceOf(OAuthError)
        expect((error as OAuthError).status).toBe(500)
        expect(error.message).toContain('server encountered')
      }
    })

    it('should handle Google API service unavailable (HTTP 503)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: jest.fn().mockResolvedValue({
          error: 'temporarily_unavailable',
          error_description: 'The service is temporarily overloaded or under maintenance.',
        }),
      })

      try {
        await oauthHandler.validateToken('unavailable-token')
        fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeInstanceOf(OAuthError)
        expect((error as OAuthError).status).toBe(503)
        expect(error.message).toContain('temporarily')
      }
    })
  })

  describe('Malformed Response Handling', () => {
    it('should handle non-JSON responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: jest.fn().mockRejectedValue(new SyntaxError('Unexpected token in JSON')),
      })

      try {
        await oauthHandler.exchangeCodeForToken('malformed-response-code')
        fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeInstanceOf(OAuthError)
        expect(error.message).toContain('Token exchange failed')
        expect((error as OAuthError).status).toBe(400)
      }
    })

    it('should handle empty responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: jest.fn().mockResolvedValue(null),
      })

      try {
        await oauthHandler.validateToken('empty-response-token')
        fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeInstanceOf(OAuthError)
        expect(error.message).toContain('Invalid or expired token')
      }
    })

    it('should handle responses with missing required fields', async () => {
      // Token exchange response missing access_token
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          token_type: 'Bearer',
          expires_in: 3600,
          // Missing access_token field
        }),
      })

      const result = await oauthHandler.exchangeCodeForToken('missing-field-code')
      expect(result.access_token).toBeUndefined()
      expect(result.token_type).toBe('Bearer')
    })

    it('should handle userinfo responses with missing required fields', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: '12345',
          email: 'test@example.com',
          // Missing verified_email field (will be undefined)
          name: 'Test User',
        }),
      })

      try {
        await oauthHandler.validateToken('missing-verification-token')
        fail('Should have thrown an error due to missing verified_email')
      } catch (error) {
        expect(error).toBeInstanceOf(OAuthError)
        expect((error as OAuthError).status).toBe(403)
        expect((error as OAuthError).code).toBe('email_not_verified')
        expect(error.message).toContain('Email address is not verified')
      }
    })
  })

  describe('Token Validation Edge Cases', () => {
    it('should handle tokens with unusual formats', async () => {
      const edgeCaseTokens = [
        '', // Empty token
        '   ', // Whitespace only
        'a', // Single character
        'x'.repeat(2000), // Very long token
        'token-with-special-chars!@#$%^&*()',
        'token.with.dots',
        'token_with_underscores',
        'token-with-hyphens',
        '12345', // Numeric token
        'UPPERCASE_TOKEN',
        'MiXeD_cAsE_tOkEn',
      ]

      for (const token of edgeCaseTokens) {
        if (token.trim() === '') {
          // Empty tokens should be rejected early
          continue
        }

        if (token.startsWith('mcp_service_token_')) {
          // MCP tokens should be handled without API calls
          const userInfo = await oauthHandler.validateToken(token)
          expect(userInfo.id).toBe('mcp_service_user')
        } else {
          // Regular tokens should be sent to Google API
          mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 401,
            json: jest.fn().mockResolvedValue({
              error: 'invalid_token',
            }),
          })

          await expect(oauthHandler.validateToken(token))
            .rejects
            .toThrow(OAuthError)
        }
      }
    })

    it('should handle authorization headers with edge cases', async () => {
      const testCases = [
        { header: 'Bearer ', expectedToken: null, reason: 'Bearer with space but no token' },
        { header: 'Bearer', expectedToken: null, reason: 'Bearer without space' },
        { header: 'bearer token123', expectedToken: 'token123', reason: 'Lowercase bearer' },
        { header: 'BEARER TOKEN123', expectedToken: 'TOKEN123', reason: 'Uppercase bearer' },
        { header: 'Bearer  token123', expectedToken: 'token123', reason: 'Multiple spaces' },
        { header: 'Bearer\ttoken123', expectedToken: 'token123', reason: 'Tab character' },
        { header: 'Bearer\ntoken123', expectedToken: 'token123', reason: 'Newline character' },
        { header: 'Bearer token123 ', expectedToken: 'token123 ', reason: 'Trailing space' },
        { header: ' Bearer token123', expectedToken: null, reason: 'Leading space' },
      ]

      for (const testCase of testCases) {
        const token = oauthHandler.extractBearerToken(testCase.header)
        
        if (testCase.expectedToken === null) {
          expect(token).toBeNull()
        } else {
          expect(token).toBe(testCase.expectedToken)
        }
      }
    })

    it('should handle concurrent token validations', async () => {
      const tokens = [
        'mcp_service_token_1_a',
        'mcp_service_token_2_b', 
        'mcp_service_token_3_c',
      ]

      // All should be service tokens, no API calls needed
      const promises = tokens.map(token => oauthHandler.validateToken(token))
      const results = await Promise.all(promises)

      for (const result of results) {
        expect(result.id).toBe('mcp_service_user')
        expect(result.email).toBe('mcp-service@internal')
      }

      // Should not have made any API calls for service tokens
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should handle mixed token types concurrently', async () => {
      const tokens = [
        'mcp_service_token_123_abc', // Service token
        'google-token-456', // Google token (valid)
        'google-token-789', // Google token (invalid)
      ]

      // Mock responses for Google tokens
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: '456',
            email: 'valid@example.com',
            verified_email: true,
            name: 'Valid User',
            given_name: 'Valid',
            family_name: 'User',
            picture: '',
            locale: 'en',
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: jest.fn().mockResolvedValue({
            error: 'invalid_token',
          }),
        })

      const promises = tokens.map(async (token) => {
        try {
          return await oauthHandler.validateToken(token)
        } catch (error) {
          return { error: error.message }
        }
      })

      const results = await Promise.all(promises)

      expect(results[0]).toEqual(expect.objectContaining({
        id: 'mcp_service_user',
        email: 'mcp-service@internal',
      }))

      expect(results[1]).toEqual(expect.objectContaining({
        id: '456',
        email: 'valid@example.com',
      }))

      expect(results[2]).toEqual(expect.objectContaining({
        error: expect.stringContaining('Invalid or expired token'),
      }))
    })
  })

  describe('Authentication Request Error Handling', () => {
    it('should provide detailed error information for debugging', async () => {
      const testCases = [
        {
          name: 'Missing Authorization header',
          request: new Request('http://example.com/api', {
            method: 'GET',
          }),
          expectedCode: 'missing_token',
          expectedStatus: 401,
        },
        {
          name: 'Invalid Authorization header format',
          request: new Request('http://example.com/api', {
            method: 'GET',
            headers: { 'Authorization': 'Basic dXNlcjpwYXNz' },
          }),
          expectedCode: 'missing_token',
          expectedStatus: 401,
        },
        {
          name: 'Malformed Bearer token',
          request: new Request('http://example.com/api', {
            method: 'GET',
            headers: { 'Authorization': 'Bearer' }, // No token
          }),
          expectedCode: 'missing_token',
          expectedStatus: 401,
        },
      ]

      for (const testCase of testCases) {
        try {
          await oauthHandler.authenticateRequest(testCase.request)
          fail(`${testCase.name} should have thrown an error`)
        } catch (error) {
          expect(error).toBeInstanceOf(OAuthError)
          expect((error as OAuthError).code).toBe(testCase.expectedCode)
          expect((error as OAuthError).status).toBe(testCase.expectedStatus)
        }
      }
    })

    it('should handle token validation failures with proper error propagation', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: jest.fn().mockResolvedValue({
          error: 'insufficient_scope',
          error_description: 'Token does not have required scope',
        }),
      })

      const request = new Request('http://example.com/api', {
        headers: { 'Authorization': 'Bearer insufficient-scope-token' },
      })

      try {
        await oauthHandler.authenticateRequest(request)
        fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeInstanceOf(OAuthError)
        expect((error as OAuthError).status).toBe(403)
        expect(error.message).toContain('Token does not have required scope')
      }
    })

    it('should handle unexpected errors during authentication', async () => {
      // Simulate unexpected error in token validation
      mockFetch.mockRejectedValue(new TypeError('Cannot read property of undefined'))

      const request = new Request('http://example.com/api', {
        headers: { 'Authorization': 'Bearer unexpected-error-token' },
      })

      try {
        await oauthHandler.authenticateRequest(request)
        fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeInstanceOf(OAuthError)
        expect((error as OAuthError).status).toBe(401) // validateToken wraps the error with default 401
        expect(error.message).toBe('Failed to validate access token')
      }
    })
  })

  describe('Error Recovery and Retry Logic', () => {
    it('should not retry on client errors (4xx)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({
          error: 'invalid_request',
        }),
      })

      await expect(oauthHandler.exchangeCodeForToken('bad-code'))
        .rejects
        .toThrow(OAuthError)

      // Should only make one request, no retries for 4xx
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should handle multiple consecutive failures gracefully', async () => {
      const errors = [
        new Error('Network timeout'),
        new Error('Connection refused'),
        new Error('DNS resolution failed'),
      ]

      for (const error of errors) {
        mockFetch.mockRejectedValueOnce(error)

        await expect(oauthHandler.validateToken('failing-token'))
          .rejects
          .toThrow('Failed to validate access token')
      }

      expect(mockFetch).toHaveBeenCalledTimes(3)
    })
  })
})