import { env } from '@/env'
import * as jwt from '@/lib/jwt'
import * as oauth from '@/lib/oauth'
import { metadataCorsOptionsRequestHandler } from 'mcp-handler'
import { NextRequest } from 'next/server'

async function tokenHandler(req: NextRequest) {
  try {
    const requestBody = await req.text()

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

    const { payload, success, errors } = await oauth.validateTokenRequest(parsedBody, env.JWT_SECRET)
    if (!success) {
      return Response.json(
        {
          error: 'invalid_request',
          error_description: errors?.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
        },
        { status: 400 },
      )
    }

    const accessToken = await jwt.sign(
      {
        sub: payload.sub,
        client_id: payload.client_id,
        aud: jwt.AUDIENCE,
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

export { tokenHandler as POST }
