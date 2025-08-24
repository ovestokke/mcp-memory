import { MemoryStorage } from '@shared/memory/storage'
import { MemoryStorageClient } from '@shared/memory/client'
import { OAuth2Handler, OAuthError, GoogleOAuthConfig } from '@shared/auth/oauth'
import { MCPHttpServer } from '@shared/mcp/http-server'
import { logger } from '@shared/utils/logger'

export interface Env {
  MEMORY_STORAGE: DurableObjectNamespace
  VECTORIZE: VectorizeIndex
  ENVIRONMENT: string

  // OAuth2 Configuration
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
}

// Export the Durable Object class
export { MemoryStorage }


// Helper function to create CORS headers for authenticated endpoints
function createCorsHeaders(origin?: string): Record<string, string> {
  // In production, restrict to specific origins. For development, allow localhost.
  const allowedOrigins = [
    'https://your-app.com', // Replace with your actual domain
    'http://localhost:3002', // Development web UI
  ]

  const requestOrigin = origin || ''
  const corsOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : 'null'

  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  }
}

// Helper function to handle OAuth errors
function handleOAuthError(error: unknown, origin?: string, serverUrl?: string): Response {
  const corsHeaders = createCorsHeaders(origin)

  if (error instanceof OAuthError) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...corsHeaders,
    }

    // Add WWW-Authenticate header for 401 responses per MCP spec
    if (error.status === 401 && serverUrl) {
      headers['WWW-Authenticate'] = `Bearer realm="${serverUrl}", error="invalid_token", error_description="${error.message}"`
    }

    return new Response(
      JSON.stringify({
        error: error.message,
        code: error.code,
      }),
      {
        status: error.status,
        headers,
      },
    )
  }

  logger.error('Unexpected authentication error', { error: error instanceof Error ? error : String(error) })
  return new Response(JSON.stringify({ error: 'Authentication failed' }), {
    status: 500,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const requestLogger = logger.withContext({
      method: request.method,
      path: url.pathname,
      userAgent: request.headers.get('User-Agent'),
    })

    try {
      // Initialize OAuth2 handler
      const oauthConfig: GoogleOAuthConfig = {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      }
      const oauth = new OAuth2Handler(oauthConfig)

      // Basic health check (public endpoint)
      if (url.pathname === '/') {
        return new Response('MCP Memory Server - Ready for connections', { status: 200 })
      }

      // OAuth 2.0 Authorization Server Metadata (RFC 8414) - Required by MCP spec
      if (url.pathname === '/.well-known/oauth-authorization-server') {
        const baseUrl = `${url.protocol}//${url.host}`
        const metadata = {
          issuer: baseUrl,
          authorization_endpoint: `${baseUrl}/auth`,
          token_endpoint: `${baseUrl}/token`,
          registration_endpoint: `${baseUrl}/register`,
          jwks_uri: `${baseUrl}/.well-known/jwks.json`,
          response_types_supported: ["code"],
          grant_types_supported: ["authorization_code", "refresh_token"],
          scopes_supported: ["openid", "email", "profile"],
          code_challenge_methods_supported: ["S256"],
          authorization_response_iss_parameter_supported: true
        }

        return new Response(JSON.stringify(metadata), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...createCorsHeaders(request.headers.get('Origin') || undefined),
          },
        })
      }

      // OpenID Connect Discovery (RFC 8414) - Alternative discovery mechanism
      if (url.pathname === '/.well-known/openid-configuration') {
        const baseUrl = `${url.protocol}//${url.host}`
        const metadata = {
          issuer: baseUrl,
          authorization_endpoint: `${baseUrl}/auth`,
          token_endpoint: `${baseUrl}/token`,
          registration_endpoint: `${baseUrl}/register`,
          jwks_uri: `${baseUrl}/.well-known/jwks.json`,
          response_types_supported: ["code"],
          grant_types_supported: ["authorization_code", "refresh_token"],
          scopes_supported: ["openid", "email", "profile"],
          code_challenge_methods_supported: ["S256"],
          authorization_response_iss_parameter_supported: true,
          subject_types_supported: ["public"],
          id_token_signing_alg_values_supported: ["RS256"]
        }

        return new Response(JSON.stringify(metadata), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...createCorsHeaders(request.headers.get('Origin') || undefined),
          },
        })
      }

      // OAuth 2.0 Protected Resource Metadata (RFC 8707) - Required by MCP spec
      if (url.pathname === '/.well-known/oauth-protected-resource') {
        const baseUrl = `${url.protocol}//${url.host}`
        const metadata = {
          resource: baseUrl,
          authorization_servers: [baseUrl],
          scopes_supported: ["openid", "email", "profile"],
          bearer_methods_supported: ["header"],
          resource_documentation: `${baseUrl}/docs`
        }

        return new Response(JSON.stringify(metadata), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...createCorsHeaders(request.headers.get('Origin') || undefined),
          },
        })
      }

      // JWKS endpoint (placeholder - in production you'd have actual keys)
      if (url.pathname === '/.well-known/jwks.json') {
        return new Response(JSON.stringify({ keys: [] }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...createCorsHeaders(request.headers.get('Origin') || undefined),
          },
        })
      }

      // RFC 7591 Dynamic Client Registration endpoint (public)
      if (url.pathname === '/register' && request.method === 'POST') {
        try {
          const clientData = await request.json() as any

          // Generate a simple client ID for this registration
          const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
          const clientSecret = `secret_${Math.random().toString(36).substring(2, 34)}`

          // For now, accept any client registration (in production, you'd validate and store these)
          const response = {
            client_id: clientId,
            client_secret: clientSecret,
            client_secret_expires_at: 0, // Never expires for demo
            registration_access_token: `registration_${Math.random().toString(36).substring(2, 34)}`,
            registration_client_uri: `${url.protocol}//${url.host}/register/${clientId}`,
            ...clientData // Echo back the client metadata
          }

          return new Response(JSON.stringify(response), {
            status: 201,
            headers: {
              'Content-Type': 'application/json',
              ...createCorsHeaders(request.headers.get('Origin') || undefined),
            },
          })
        } catch (error) {
          return new Response(JSON.stringify({
            error: 'invalid_request',
            error_description: 'Invalid client metadata'
          }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...createCorsHeaders(request.headers.get('Origin') || undefined),
            },
          })
        }
      }

      // OAuth2 authorization endpoint (public)
      if (url.pathname === '/auth' && (request.method === 'GET' || request.method === 'HEAD')) {
        const state = url.searchParams.get('state')
        const clientId = url.searchParams.get('client_id')
        const redirectUri = url.searchParams.get('redirect_uri')
        const responseType = url.searchParams.get('response_type')

        // If this is a proper OAuth authorization request with parameters, redirect to Google
        if (clientId && redirectUri && responseType === 'code') {
          // Store the original redirect URI in a way we can retrieve it later
          // For now, encode it in the state parameter
          const originalState = state || ''
          const stateWithRedirect = JSON.stringify({
            original_state: originalState,
            redirect_uri: redirectUri,
            client_id: clientId
          })
          const encodedState = btoa(stateWithRedirect) // Base64 encode

          const authUrl = oauth.generateAuthUrl(encodedState)

          // Redirect directly to Google OAuth
          return new Response(null, {
            status: 302,
            headers: {
              'Location': authUrl,
              ...createCorsHeaders(request.headers.get('Origin') || undefined),
            },
          })
        }

        // If it's just a simple request for auth URL (no OAuth params), return JSON
        const authUrl = oauth.generateAuthUrl(state || undefined)
        return new Response(
          JSON.stringify({
            authUrl,
            message: 'Visit this URL to authenticate with Google',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...createCorsHeaders(request.headers.get('Origin') || undefined),
            },
          },
        )
      }

      // OAuth2 token exchange endpoint (public) - handles both GET (Google callback) and POST
      if (url.pathname === '/auth/callback' && (request.method === 'GET' || request.method === 'POST')) {
        try {
          let code: string
          let state: string | null = null

          if (request.method === 'GET') {
            // Google OAuth callback with query parameters
            code = url.searchParams.get('code') || ''
            state = url.searchParams.get('state')
          } else {
            // POST request with JSON body
            const body = (await request.json()) as { code: string, state?: string }
            code = body.code
            state = body.state || null
          }

          if (!code) {
            return new Response(JSON.stringify({ error: 'Authorization code is required' }), {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
                ...createCorsHeaders(request.headers.get('Origin') || undefined),
              },
            })
          }

          // Check if this is an MCP OAuth flow (with encoded state) BEFORE token exchange
          let mcpRedirectUri: string | null = null
          let originalState: string | null = null

          if (state) {
            try {
              const decodedState = atob(state)
              const stateData = JSON.parse(decodedState)
              mcpRedirectUri = stateData.redirect_uri
              originalState = stateData.original_state
            } catch (e) {
              // If decode fails, treat as regular state
              originalState = state
            }
          }

          if (mcpRedirectUri && request.method === 'GET') {
            // This is an MCP OAuth flow - redirect back to MCP client with the original code
            // The MCP client will handle the token exchange itself
            // IMPORTANT: Do not exchange the code here - let MCP client do it!
            const redirectUrl = new URL(mcpRedirectUri)
            redirectUrl.searchParams.set('code', code)
            if (originalState) {
              redirectUrl.searchParams.set('state', originalState)
            }

            requestLogger.info('Redirecting to MCP client callback', {
              redirectUri: mcpRedirectUri,
              originalState,
              note: 'Code passed through without exchange - MCP client will exchange it',
            })

            return new Response(null, {
              status: 302,
              headers: {
                'Location': redirectUrl.toString(),
                ...createCorsHeaders(request.headers.get('Origin') || undefined),
              },
            })
          }

          // For non-MCP flows, exchange the token and validate user
          const tokenResponse = await oauth.exchangeCodeForToken(code)
          const userInfo = await oauth.validateToken(tokenResponse.access_token)

          requestLogger.info('User authenticated successfully', {
            userId: userInfo.id,
            email: userInfo.email,
          })

          if (request.method === 'GET') {
            // For regular GET requests (browser redirects), return HTML success page
            const htmlResponse = `
<!DOCTYPE html>
<html>
<head>
    <title>Authentication Successful</title>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
        .success { color: #28a745; }
        .user-info { background: #f8f9fa; padding: 20px; border-radius: 8px; max-width: 400px; margin: 20px auto; }
    </style>
</head>
<body>
    <h1 class="success">✓ Authentication Successful</h1>
    <p>Welcome, ${userInfo.name}!</p>
    <div class="user-info">
        <p><strong>Email:</strong> ${userInfo.email}</p>
        <p>You can now close this window and return to Claude Desktop.</p>
    </div>
</body>
</html>`
            return new Response(htmlResponse, {
              status: 200,
              headers: {
                'Content-Type': 'text/html; charset=utf-8',
                ...createCorsHeaders(request.headers.get('Origin') || undefined),
              },
            })
          } else {
            // For POST requests (API calls), return JSON
            return new Response(
              JSON.stringify({
                access_token: tokenResponse.access_token,
                expires_in: tokenResponse.expires_in,
                refresh_token: tokenResponse.refresh_token,
                user: {
                  id: userInfo.id,
                  email: userInfo.email,
                  name: userInfo.name,
                  picture: userInfo.picture,
                },
              }),
              {
                status: 200,
                headers: {
                  'Content-Type': 'application/json',
                  ...createCorsHeaders(request.headers.get('Origin') || undefined),
                },
              },
            )
          }
        } catch (error) {
          requestLogger.error('OAuth callback failed', {
            error: error instanceof Error ? error : String(error),
          })
          return handleOAuthError(error, request.headers.get('Origin') || undefined, `${url.protocol}//${url.host}`)
        }
      }

      // OAuth2 token exchange endpoint for MCP clients (public)
      if (url.pathname === '/token' && request.method === 'POST') {
        try {
          const contentType = request.headers.get('Content-Type') || ''
          let body: {
            grant_type: string
            code: string
            redirect_uri?: string
            client_id?: string
            code_verifier?: string
          }

          if (contentType.includes('application/x-www-form-urlencoded')) {
            // Parse form-encoded data (standard OAuth format)
            const formData = await request.text()
            const params = new URLSearchParams(formData)
            const redirectUri = params.get('redirect_uri')
            const clientId = params.get('client_id')
            const codeVerifier = params.get('code_verifier')

            body = {
              grant_type: params.get('grant_type') || '',
              code: params.get('code') || '',
              ...(redirectUri && { redirect_uri: redirectUri }),
              ...(clientId && { client_id: clientId }),
              ...(codeVerifier && { code_verifier: codeVerifier }),
            }
          } else {
            // Parse JSON data
            body = await request.json() as {
              grant_type: string
              code: string
              redirect_uri?: string
              client_id?: string
              code_verifier?: string
            }
          }

          if (body.grant_type !== 'authorization_code') {
            return new Response(JSON.stringify({
              error: 'unsupported_grant_type',
              error_description: 'Only authorization_code grant type is supported'
            }), {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
                ...createCorsHeaders(request.headers.get('Origin') || undefined),
              },
            })
          }

          if (!body.code) {
            return new Response(JSON.stringify({
              error: 'invalid_request',
              error_description: 'Missing required parameter: code'
            }), {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
                ...createCorsHeaders(request.headers.get('Origin') || undefined),
              },
            })
          }

          requestLogger.info('MCP token exchange attempt', {
            clientId: body.client_id,
            codeLength: body.code?.length || 0,
            grantType: body.grant_type,
            redirectUri: body.redirect_uri,
          })

          // Exchange the authorization code for tokens with Google
          const tokenResponse = await oauth.exchangeCodeForToken(body.code)
          const userInfo = await oauth.validateToken(tokenResponse.access_token)

          requestLogger.info('MCP client token exchange successful', {
            clientId: body.client_id,
            userId: userInfo.id,
            email: userInfo.email,
          })

          // Return tokens to MCP client
          return new Response(JSON.stringify({
            access_token: tokenResponse.access_token,
            token_type: 'Bearer',
            expires_in: tokenResponse.expires_in,
            refresh_token: tokenResponse.refresh_token,
            scope: 'openid email profile',
          }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...createCorsHeaders(request.headers.get('Origin') || undefined),
            },
          })
        } catch (error) {
          requestLogger.error('MCP token exchange failed', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          })
          return new Response(JSON.stringify({
            error: 'invalid_grant',
            error_description: 'The provided authorization grant is invalid'
          }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...createCorsHeaders(request.headers.get('Origin') || undefined),
            },
          })
        }
      }

      // Handle CORS preflight for protected endpoints
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: createCorsHeaders(request.headers.get('Origin') || undefined),
        })
      }

      // All other endpoints require authentication
      let authenticatedUser
      try {
        const authResult = await oauth.authenticateRequest(request)
        authenticatedUser = authResult.user
        requestLogger.info('Request authenticated', {
          userId: authenticatedUser.id,
          email: authenticatedUser.email,
        })
      } catch (error) {
        return handleOAuthError(error, request.headers.get('Origin') || undefined, `${url.protocol}//${url.host}`)
      }

      // MCP protocol handling (protected)
      if (url.pathname.startsWith('/mcp')) {
        // Create memory storage client for this user
        const id = env.MEMORY_STORAGE.idFromName(authenticatedUser.id)
        const durableObject = env.MEMORY_STORAGE.get(id)
        const memoryStorageClient = new MemoryStorageClient(durableObject)

        // Initialize MCP HTTP server
        const mcpServer = new MCPHttpServer(memoryStorageClient)
        mcpServer.setCurrentUser(authenticatedUser.id)

        // Handle MCP protocol over HTTP
        const mcpResponse = await mcpServer.handleRequest(request)

        // Add CORS headers
        const corsHeaders = createCorsHeaders(request.headers.get('Origin') || undefined)
        Object.entries(corsHeaders).forEach(([key, value]) => {
          mcpResponse.headers.set(key, value)
        })

        return mcpResponse
      }

      // API endpoints - use authenticated user ID
      const userId = authenticatedUser.id
      requestLogger.info('API request with authenticated user', {
        userId,
        email: authenticatedUser.email,
        path: url.pathname
      })
      const id = env.MEMORY_STORAGE.idFromName(userId)
      requestLogger.info('Using Durable Object', {
        userId,
        durableObjectId: id.toString(),
        path: url.pathname
      })
      const durableObject = env.MEMORY_STORAGE.get(id)

      try {
        // Create new request with user context
        const authenticatedRequest = new Request(request.url, {
          method: request.method,
          headers: {
            ...Object.fromEntries(request.headers.entries()),
            'x-user-id': userId,
            'x-user-email': authenticatedUser.email,
          },
          body: request.body,
        })

        // Proxy request to Durable Object
        const response = await durableObject.fetch(authenticatedRequest)

        // Add CORS headers to response
        const corsResponse = new Response(response.body, response)
        const corsHeaders = createCorsHeaders(request.headers.get('Origin') || undefined)
        Object.entries(corsHeaders).forEach(([key, value]) => {
          corsResponse.headers.set(key, value)
        })

        return corsResponse
      } catch (error) {
        requestLogger.error('Durable Object request failed', {
          error: error instanceof Error ? error : String(error),
          userId,
        })
        return new Response(JSON.stringify({ error: `Server error: ${error}` }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...createCorsHeaders(request.headers.get('Origin') || undefined),
          },
        })
      }
    } catch (error) {
      requestLogger.error('Request handling failed', {
        error: error instanceof Error ? error : String(error),
      })
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...createCorsHeaders(request.headers.get('Origin') || undefined),
        },
      })
    }
  },
}
