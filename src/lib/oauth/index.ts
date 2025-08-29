import { createHash } from 'crypto'
import * as jose from 'jose'
import z from 'zod'

export const TokenRequestBody = z.object({
  grant_type: z.literal('authorization_code'),
  code: z.string().min(1),
  client_id: z.string().min(1),
  code_verifier: z.string().min(1),
  redirect_uri: z.string().url(),
})

export type TokenRequest = z.infer<typeof TokenRequestBody>

export function verifyPKCE(codeVerifier: string, storedCodeChallenge: string) {
  const hash = createHash('sha256').update(codeVerifier).digest()
  const computedChallenge = jose.base64url.encode(hash)

  return computedChallenge === storedCodeChallenge
}
