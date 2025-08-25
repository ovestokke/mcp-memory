import { logger } from '../utils/logger'

export interface GoogleOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri?: string
}

export interface OAuthTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  scope: string
  id_token?: string
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

export class OAuth2Handler {
  private config: GoogleOAuthConfig
  private authLogger: typeof logger

  constructor(config: GoogleOAuthConfig) {
    this.config = config
    this.authLogger = logger.withContext({ component: 'OAuth2Handler' })
  }

  /**
   * Generate OAuth2 authorization URL for Google
   */
  generateAuthUrl(state?: string, scopes: string[] = ['openid', 'email', 'profile']): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      scope: scopes.join(' '),
      redirect_uri: this.config.redirectUri || 'http://localhost:8787/auth/callback',
      access_type: 'offline',
      prompt: 'consent',
      ...(state && { state }),
    })

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<OAuthTokenResponse> {
    const requestLogger = this.authLogger.withContext({ operation: 'exchangeCodeForToken' })

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: this.config.redirectUri || 'http://localhost:8787/auth/callback',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as any
        requestLogger.error('Token exchange failed', {
          status: response.status,
          error: errorData instanceof Error ? errorData : JSON.stringify(errorData),
        })
        throw new OAuthError(
          `Token exchange failed: ${errorData?.error_description || response.statusText}`,
          response.status,
          errorData?.error
        )
      }

      const tokenData: OAuthTokenResponse = await response.json()
      requestLogger.info('Token exchange successful', {
        expiresIn: tokenData.expires_in,
        scope: tokenData.scope,
      })

      return tokenData
    } catch (error) {
      if (error instanceof OAuthError) throw error
      requestLogger.error('Token exchange error', { error: error instanceof Error ? error : String(error) })
      throw new OAuthError('Failed to exchange authorization code for token')
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<OAuthTokenResponse> {
    const requestLogger = this.authLogger.withContext({ operation: 'refreshToken' })

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as any
        requestLogger.error('Token refresh failed', {
          status: response.status,
          error: errorData instanceof Error ? errorData : JSON.stringify(errorData),
        })
        throw new OAuthError(
          `Token refresh failed: ${errorData?.error_description || response.statusText}`,
          response.status,
          errorData?.error
        )
      }

      const tokenData: OAuthTokenResponse = await response.json()
      requestLogger.info('Token refresh successful', {
        expiresIn: tokenData.expires_in,
      })

      return tokenData
    } catch (error) {
      if (error instanceof OAuthError) throw error
      requestLogger.error('Token refresh error', { error: error instanceof Error ? error : String(error) })
      throw new OAuthError('Failed to refresh access token')
    }
  }

  /**
   * Validate access token and get user info
   */
  async validateToken(accessToken: string): Promise<GoogleUserInfo> {
    const requestLogger = this.authLogger.withContext({ operation: 'validateToken' })

    // Check if this is an MCP service token
    if (accessToken.startsWith('mcp_service_token_')) {
      requestLogger.info('MCP service token detected', {
        tokenPrefix: accessToken.substring(0, 20) + '...',
      })
      
      // For MCP service tokens, return a synthetic user info
      // In production, you might want to validate the token format or store/lookup token info
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
      const response = await fetch(
        `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as any
        requestLogger.warn('Token validation failed', {
          status: response.status,
          error: errorData instanceof Error ? errorData : JSON.stringify(errorData),
        })
        throw new OAuthError(
          `Invalid or expired token: ${errorData?.error_description || response.statusText}`,
          response.status,
          errorData?.error
        )
      }

      const userInfo: GoogleUserInfo = await response.json()
      requestLogger.info('Token validation successful', {
        userId: userInfo.id,
        email: userInfo.email,
        verified: userInfo.verified_email,
      })

      if (!userInfo.verified_email) {
        throw new OAuthError('Email address is not verified', 403, 'email_not_verified')
      }

      return userInfo
    } catch (error) {
      if (error instanceof OAuthError) throw error
      requestLogger.error('Token validation error', { error: error instanceof Error ? error : String(error) })
      throw new OAuthError('Failed to validate access token')
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
   * Middleware to authenticate requests
   */
  async authenticateRequest(request: Request): Promise<{ user: GoogleUserInfo; token: string }> {
    const requestLogger = this.authLogger.withContext({ 
      operation: 'authenticateRequest',
      path: new URL(request.url).pathname,
    })

    const authHeader = request.headers.get('Authorization')
    const token = this.extractBearerToken(authHeader)

    if (!token) {
      requestLogger.warn('Missing authorization token')
      throw new OAuthError('Authorization header with Bearer token is required', 401, 'missing_token')
    }

    try {
      const user = await this.validateToken(token)
      requestLogger.info('Request authenticated', {
        userId: user.id,
        email: user.email,
      })

      return { user, token }
    } catch (error) {
      if (error instanceof OAuthError) {
        requestLogger.warn('Authentication failed', {
          error: error.message,
          code: error.code,
        })
        throw error
      }
      
      requestLogger.error('Authentication error', { error: error instanceof Error ? error : String(error) })
      throw new OAuthError('Authentication failed', 500)
    }
  }
}