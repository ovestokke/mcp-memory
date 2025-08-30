import { type JWTPayload } from 'jose'
import * as jose from 'jose'

const alg = 'HS256'
export const AUDIENCE = 'mcp-memory'

export async function sign(data: JWTPayload, secret: string, options?: { expiresIn?: string | number }) {
  const jwt = await new jose.SignJWT(data)
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setIssuer(AUDIENCE)
    .setExpirationTime(options?.expiresIn ?? '1h')
    .sign(new TextEncoder().encode(secret))

  return jwt
}

type VerifyResult =
  | { success: true; payload: JWTPayload; error?: never }
  | { success: false; payload?: never; error: jose.errors.JOSEError }

export async function verify(token: string, secret: string): Promise<VerifyResult> {
  try {
    const { payload } = await jose.jwtVerify(token, new TextEncoder().encode(secret), {
      issuer: AUDIENCE,
      algorithms: [alg],
      clockTolerance: '5m', // Allow 5 minutes of clock drift
    })
    return { success: true, payload }
  } catch (e) {
    return { success: false, error: e as jose.errors.JOSEError }
  }
}
