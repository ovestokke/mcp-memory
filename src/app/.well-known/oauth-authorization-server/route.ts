import { env } from '@/env'
import { NextResponse } from 'next/server'

export async function handler() {
  return NextResponse.json({
    issuer: env.NEXTAUTH_URL,
    authorization_endpoint: `${env.NEXTAUTH_URL}/authorize`,
    token_endpoint: `${env.NEXTAUTH_URL}/token`,
    registration_endpoint: `${env.NEXTAUTH_URL}/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
  })
}

export { handler as GET }
