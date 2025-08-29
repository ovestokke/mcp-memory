import { type JWTPayload } from 'jose'
import * as jose from 'jose'

const alg = 'HS256'
const audience = 'mcp-memory'

export async function sign(data: JWTPayload, secret: string, options?: { expiresIn?: string | number }) {
  const jwt = await new jose.SignJWT(data)
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setIssuer(audience)
    .setExpirationTime(options?.expiresIn ?? '1h')
    .sign(new TextEncoder().encode(secret))

  return jwt
}

export async function verify(
  token: string,
  secret: string,
): Promise<{ success: boolean; payload?: JWTPayload; error?: jose.errors.JOSEError }> {
  try {
    const { payload } = await jose.jwtVerify(token, new TextEncoder().encode(secret), {
      issuer: audience,
      algorithms: [alg],
      clockTolerance: '5m', // Allow 5 minutes of clock drift
    })
    return { success: true, payload }
  } catch (e) {
    console.log(`[${new Date().toISOString()}] JWT verification failed:`, e.message)
    return { success: false, error: e as jose.errors.JOSEError }
  }
}
