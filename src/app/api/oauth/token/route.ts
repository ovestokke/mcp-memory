import { env } from '@/env'
import * as jwt from '@/lib/jwt'
import * as oauth from '@/lib/oauth'
import { NextRequest } from 'next/server'

const ExpiresIn = 24 * 3600 // 24 hours in seconds (OAuth spec uses seconds)

async function token(req: NextRequest) {
  try {
    // Clone request for logging
    const requestBody = await req.clone().text()

    // Parse form data or JSON
    let parsedBody
    const contentType = req.headers.get('content-type') || ''

    if (contentType.includes('application/x-www-form-urlencoded')) {
      // Parse form-encoded data (URLSearchParams automatically decodes)
      const formData = new URLSearchParams(requestBody)
      parsedBody = Object.fromEntries(formData.entries())
    } else {
      // Parse JSON data
      parsedBody = JSON.parse(requestBody)
    }

    // Parse and validate request body
    const { data: params, success: validBody, error } = oauth.TokenRequestBody.safeParse(parsedBody)
    if (!validBody) {
      return Response.json(
        {
          error: 'invalid_request',
          error_description: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
        },
        { status: 400 },
      )
    }

    // Verify JWT authorization code

    const { success: validJWT, error: jwtErr, payload } = await jwt.verify(params.code, env.JWT_SECRET)
    if (!validJWT || !payload) {
      return Response.json(
        {
          error: 'invalid_grant',
          error_description: 'Invalid or expired authorization code',
        },
        { status: 400 },
      )
    }

    // Validate client_id matches
    if (payload.client_id !== params.client_id) {
      return Response.json(
        {
          error: 'invalid_grant',
          error_description: 'Client ID does not match',
        },
        { status: 400 },
      )
    }

    // Validate redirect_uri matches
    if (payload.redirect_uri !== params.redirect_uri) {
      return Response.json(
        {
          error: 'invalid_grant',
          error_description: 'Redirect URI does not match',
        },
        { status: 400 },
      )
    }

    // Verify PKCE
    if (!oauth.verifyPKCE(params.code_verifier, payload.code_challenge as string)) {
      return Response.json(
        {
          error: 'invalid_grant',
          error_description: 'PKCE verification failed',
        },
        { status: 400 },
      )
    }

    // All validations passed - issue access token
    const accessToken = await jwt.sign(
      {
        sub: payload.sub,
        client_id: params.client_id,
        aud: 'mcp-memory',
      },
      env.JWT_SECRET,
      { expiresIn: '24h' },
    )

    return Response.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 24 * 3600, // Number of seconds (OAuth spec requires number)
    })
  } catch (error) {
    return Response.json(
      {
        error: 'server_error',
        error_description: 'An internal server error occurred',
      },
      { status: 500 },
    )
  }
}

export { token as POST }
