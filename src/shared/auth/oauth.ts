/**
 * OAuth2 Authentication Handler for Cloudflare Workers
 * 
 * This provides OAuth2 functionality using Web APIs compatible with Cloudflare Workers.
 */

import { logger } from '../utils/logger'

// OAuthError class definition (moved here from oauth-original.ts)
export class OAuthError extends Error {
  constructor(
    message: string,
    public status: number = 401,
    public code?: string
  ) {
    super(message)
    this.name = 'OAuthError'
  }
}

export interface GoogleUserInfo {
  id: string
  email: string
  verified_email: boolean
  name: string
  given_name: string
  family_name: string
  picture: string
  locale: string
}

export interface GoogleOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri?: string
}

export interface AuthenticationResult {
  user: GoogleUserInfo
  token: string
}

export class OAuth2Handler {
  private authLogger = logger.withContext({ module: 'OAuth2Handler' })

  constructor(private config: GoogleOAuthConfig) {}

  /**
   * Generate OAuth2 authorization URL
   */
  generateAuthUrl(scopes = ['openid', 'email', 'profile'], state?: string): string {
    const requestLogger = this.authLogger.withContext({ operation: 'generateAuthUrl' })
    
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      include_granted_scopes: 'true',
    })

    if (this.config.redirectUri) {
      params.set('redirect_uri', this.config.redirectUri)
    }
    
    if (state) {
      params.set('state', state)
    }
    
    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    
    requestLogger.info('Generated OAuth2 authorization URL')
    return url
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForToken(code: string): Promise<any> {
    const requestLogger = this.authLogger.withContext({ operation: 'exchangeCodeForToken' })
    
    try {
      const params = new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code: code,
        grant_type: 'authorization_code',
      })

      if (this.config.redirectUri) {
        params.set('redirect_uri', this.config.redirectUri)
      }

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as any
        throw new Error(`Token exchange failed: ${errorData.error_description || response.statusText}`)
      }

      const tokens = await response.json() as any
      
      requestLogger.info('Successfully exchanged authorization code for tokens', {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiresIn: tokens.expires_in,
      })
      
      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        token_type: tokens.token_type || 'Bearer',
        scope: tokens.scope,
        id_token: tokens.id_token,
      }
    } catch (error) {
      requestLogger.error('Token exchange failed', { 
        error: error instanceof Error ? error.message : String(error) 
      })
      throw error
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<any> {
    const requestLogger = this.authLogger.withContext({ operation: 'refreshToken' })
    
    try {
      const params = new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      })

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as any
        throw new Error(`Token refresh failed: ${errorData.error_description || response.statusText}`)
      }

      const tokens = await response.json() as any
      
      requestLogger.info('Successfully refreshed access token')
      
      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || refreshToken, // Keep original if not returned
        expires_in: tokens.expires_in,
        token_type: tokens.token_type || 'Bearer',
        scope: tokens.scope,
      }
    } catch (error) {
      requestLogger.error('Token refresh failed', { 
        error: error instanceof Error ? error.message : String(error) 
      })
      throw error
    }
  }

  /**
   * Validate access token and get user info
   */
  async validateToken(accessToken: string): Promise<GoogleUserInfo> {
    const requestLogger = this.authLogger.withContext({ operation: 'validateToken' })

    // Handle MCP service tokens (backward compatibility)
    if (accessToken.startsWith('mcp_service_token_')) {
      requestLogger.info('MCP service token detected', {
        tokenPrefix: accessToken.substring(0, 20) + '...',
      })
      
      return {
        id: 'mcp_service_user',
        email: 'mcp-service@internal',
        verified_email: true,
        name: 'MCP Service',
        given_name: 'MCP',
        family_name: 'Service',
        picture: '',
        locale: 'en'
      }
    }

    try {
      // Try to parse as JWT/ID token first
      if (accessToken.includes('.')) {
        try {
          const payload = this.parseJWT(accessToken)
          if (payload && payload.sub && payload.email_verified) {
            requestLogger.info('Token validation successful (ID token)', {
              userId: payload.sub,
              email: payload.email,
            })

            return {
              id: payload.sub,
              email: payload.email!,
              verified_email: payload.email_verified!,
              name: payload.name || `${payload.given_name || ''} ${payload.family_name || ''}`.trim(),
              given_name: payload.given_name || '',
              family_name: payload.family_name || '',
              picture: payload.picture || '',
              locale: payload.locale || 'en',
            }
          } else if (payload && payload.sub && !payload.email_verified) {
            throw new Error('Email address is not verified')
          }
        } catch (idTokenError) {
          if (idTokenError instanceof Error && 
              idTokenError.message.includes('Email address is not verified')) {
            throw idTokenError
          }
          // Not a valid ID token, fall back to userinfo endpoint
          requestLogger.info('ID token parsing failed, falling back to userinfo endpoint')
        }
      }

      // Fall back to userinfo endpoint for access tokens
      try {
        const response = await fetch(
          'https://www.googleapis.com/oauth2/v2/userinfo',
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        )

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({})) as any
          throw new Error(`Token validation failed: ${errorData.error_description || response.statusText}`)
        }

        const userInfo = await response.json() as any
        
        if (!userInfo.verified_email) {
          throw new Error('Email address is not verified')
        }

        requestLogger.info('Token validation successful (userinfo endpoint)', {
          userId: userInfo.id,
          email: userInfo.email,
        })

        return {
          id: userInfo.id,
          email: userInfo.email,
          verified_email: userInfo.verified_email,
          name: userInfo.name || `${userInfo.given_name || ''} ${userInfo.family_name || ''}`.trim(),
          given_name: userInfo.given_name || '',
          family_name: userInfo.family_name || '',
          picture: userInfo.picture || '',
          locale: userInfo.locale || 'en',
        }
      } catch (userinfoError) {
        throw new Error(`Failed to validate access token: ${userinfoError instanceof Error ? userinfoError.message : String(userinfoError)}`)
      }

    } catch (error) {
      requestLogger.error('Token validation error', { 
        error: error instanceof Error ? error.message : String(error) 
      })
      
      // Check for specific error types and messages
      if (error instanceof Error) {
        if (error.message.includes('Email address is not verified') || 
            error.message.includes('email_verified')) {
          throw new OAuthError('Email address is not verified', 403, 'email_not_verified')
        }
        
        // If it's already an OAuthError, re-throw it
        if (error.name === 'OAuthError') {
          throw error
        }
      }
      
      throw new OAuthError('Failed to validate access token', 401, 'invalid_token')
    }
  }

  /**
   * Extract Bearer token from Authorization header
   */
  extractBearerToken(authHeader?: string | null | undefined): string | null {
    if (!authHeader) return null
    
    const match = authHeader.match(/^Bearer\s+(.+)$/i)
    return match?.[1] ?? null
  }

  /**
   * Authenticate a request using the Authorization header
   */
  async authenticateRequest(request: Request): Promise<AuthenticationResult> {
    const requestLogger = this.authLogger.withContext({ operation: 'authenticateRequest' })
    
    const authHeader = request.headers.get('Authorization')
    const token = this.extractBearerToken(authHeader)
    
    if (!token) {
      requestLogger.warn('Missing or invalid authorization header')
      throw new OAuthError('Authorization header is missing or invalid', 401, 'missing_token')
    }

    try {
      const user = await this.validateToken(token)
      
      requestLogger.info('Request authenticated', {
        userId: user.id,
        email: user.email,
      })
      
      return { user, token }
    } catch (error) {
      if (error instanceof Error && 'status' in error) {
        requestLogger.warn('Authentication failed', {
          error: error.message,
          code: (error as any).code,
        })
        throw error
      }
      
      requestLogger.error('Authentication error', { 
        error: error instanceof Error ? error : String(error) 
      })
      
      throw new OAuthError('Authentication failed', 500)
    }
  }

  /**
   * Parse JWT token payload (basic implementation for ID tokens)
   */
  private parseJWT(token: string): any {
    try {
      const parts = token.split('.')
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format')
      }
      
      const payloadPart = parts[1]
      if (!payloadPart) {
        throw new Error('Missing JWT payload')
      }
      const decoded = atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/'))
      return JSON.parse(decoded)
    } catch (error) {
      throw new Error('Failed to parse JWT token')
    }
  }
}