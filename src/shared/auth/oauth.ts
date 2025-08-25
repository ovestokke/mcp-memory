/**
 * Modern OAuth2 Authentication Handler using Google Auth Library
 * 
 * This replaces the custom OAuth2 implementation with Google's official library
 * for better security, reliability, and maintenance.
 */

import { OAuth2Client } from 'google-auth-library'
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
  private client: OAuth2Client
  private authLogger = logger.withContext({ module: 'OAuth2Handler' })

  constructor(private config: GoogleOAuthConfig) {
    this.client = new OAuth2Client(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    )
  }

  /**
   * Generate OAuth2 authorization URL
   */
  generateAuthUrl(scopes = ['openid', 'email', 'profile'], state?: string): string {
    const requestLogger = this.authLogger.withContext({ operation: 'generateAuthUrl' })
    
    const authOptions: any = {
      access_type: 'offline',
      scope: scopes,
      include_granted_scopes: true,
    }
    
    if (state) {
      authOptions.state = state
    }
    
    const url = this.client.generateAuthUrl(authOptions)
    
    requestLogger.info('Generated OAuth2 authorization URL')
    return url
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForToken(code: string): Promise<any> {
    const requestLogger = this.authLogger.withContext({ operation: 'exchangeCodeForToken' })
    
    try {
      const { tokens } = await this.client.getToken(code)
      
      requestLogger.info('Successfully exchanged authorization code for tokens', {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiresIn: tokens.expiry_date,
      })
      
      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : undefined,
        token_type: 'Bearer',
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
      this.client.setCredentials({ refresh_token: refreshToken })
      const { credentials } = await this.client.refreshAccessToken()
      
      requestLogger.info('Successfully refreshed access token')
      
      return {
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token || refreshToken, // Keep original if not returned
        expires_in: credentials.expiry_date ? Math.floor((credentials.expiry_date - Date.now()) / 1000) : undefined,
        token_type: 'Bearer',
        scope: credentials.scope,
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
      // Use Google Auth Library to verify and get user info
      this.client.setCredentials({ access_token: accessToken })
      
      try {
        // Try to verify as ID token first
        const ticket = await this.client.verifyIdToken({
          idToken: accessToken,
          audience: this.config.clientId,
        })
        
        const payload = ticket.getPayload()
        if (payload && payload.sub) {
          // Process ID token payload
          if (!payload.email_verified) {
            // Don't fall back to userinfo for ID tokens with unverified email
            throw new Error('Email address is not verified')
          }

          requestLogger.info('Token validation successful (ID token)', {
            userId: payload.sub,
            email: payload.email,
          })

          return {
            id: payload.sub,
            email: payload.email!,
            verified_email: payload.email_verified!,
            name: payload.name || `${payload.given_name} ${payload.family_name}`.trim(),
            given_name: payload.given_name || '',
            family_name: payload.family_name || '',
            picture: payload.picture || '',
            locale: payload.locale || 'en',
          }
        }
      } catch (idTokenError) {
        // If error is about email verification, don't fall back
        if (idTokenError instanceof Error && 
            idTokenError.message.includes('Email address is not verified')) {
          throw idTokenError
        }
        // Otherwise, not an ID token, fall back to userinfo endpoint
        requestLogger.info('ID token verification failed, falling back to userinfo endpoint')
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
}