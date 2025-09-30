import * as jwt from '@/lib/jwt'
import { auth } from '@/auth'
import { NextRequest } from 'next/server'
import { env } from '@/env'
import z from 'zod'

const Params = z.object({
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  response_type: z.literal('code'),
  code_challenge: z.string().min(1).optional(), // PKCE is now optional
  code_challenge_method: z.literal('S256').optional().default('S256'),
  client_secret: z.string().min(1).optional(), // Client secret support
  state: z.string().min(1),
  resource: z.string().url().optional(),
})

async function authorizeHandler(req: NextRequest) {
  const {
    data: authParams,
    success,
    error,
  } = Params.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()))
  if (!success) {
    return new Response(
      JSON.stringify({
        error: 'invalid_request',
        error_description: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  const session = await auth()
  if (!session?.user) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', req.url)

    return Response.redirect(loginUrl.toString())
  }

  const authCodePayload: Record<string, unknown> = {
    sub: session.user.id,
    client_id: authParams.client_id,
    redirect_uri: authParams.redirect_uri,
    aud: 'mcp-memory',
  }

  // Include PKCE challenge if provided
  if (authParams.code_challenge) {
    authCodePayload.code_challenge = authParams.code_challenge
  }

  // Include client secret if provided
  if (authParams.client_secret) {
    authCodePayload.client_secret = authParams.client_secret
  }

  const authCode = await jwt.sign(authCodePayload, env.JWT_SECRET, { expiresIn: '10m' })

  const redirectUrl = `${authParams.redirect_uri}?code=${authCode}&state=${authParams.state}`

  return Response.redirect(redirectUrl)
}

export { authorizeHandler as GET, authorizeHandler as POST }
