import { createHash } from 'crypto'
import * as jose from 'jose'
import z from 'zod'
import { verify } from '@/lib/jwt'

export const TokenRequestBody = z.object({
  grant_type: z.literal('authorization_code'),
  code: z.string().min(1),
  client_id: z.string().min(1),
  code_verifier: z.string().min(1),
  redirect_uri: z.string().url(),
})

export type TokenRequest = z.infer<typeof TokenRequestBody>

type TokenRequestResult =
  | { success: true; data: TokenRequest; payload: jose.JWTPayload; errors?: never }
  | { success: false; data?: never; payload?: never; errors: z.ZodIssue[] }

export async function validateTokenRequest(body: unknown, jwtSecret: string): Promise<TokenRequestResult> {
  const { data: tokenRequest, success: bodyValid, error: parseError } = TokenRequestBody.safeParse(body)
  if (!bodyValid) {
    return { success: false, errors: parseError.errors }
  }

  const { success: validJWT, payload } = await verify(tokenRequest.code, jwtSecret)
  if (!validJWT) {
    return {
      success: false,
      errors: [
        {
          message: 'Invalid or expired authorization code',
          path: ['code'],
          code: 'custom',
        },
      ],
    }
  }

  if (payload.client_id !== tokenRequest.client_id) {
    return {
      success: false,
      errors: [
        {
          message: 'Client ID does not match',
          path: ['client_id'],
          code: 'custom',
        },
      ],
    }
  }

  if (payload.redirect_uri !== tokenRequest.redirect_uri) {
    return {
      success: false,
      errors: [
        {
          message: 'Redirect URI does not match',
          path: ['redirect_uri'],
          code: 'custom',
        },
      ],
    }
  }

  if (!verifyPKCE(tokenRequest.code_verifier, payload.code_challenge as string)) {
    return {
      success: false,
      errors: [
        {
          message: 'PKCE verification failed',
          code: 'custom',
          path: ['code_verifier'],
        },
      ],
    }
  }

  return { success: true, data: tokenRequest, payload }
}

export function verifyPKCE(codeVerifier: string, storedCodeChallenge: string) {
  const hash = createHash('sha256').update(codeVerifier).digest()
  const computedChallenge = jose.base64url.encode(hash)

  return computedChallenge === storedCodeChallenge
}
