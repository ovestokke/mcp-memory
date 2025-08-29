import { env } from '@/env'
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    issuer: env.NEXTAUTH_URL,
    authorization_endpoint: `${env.NEXTAUTH_URL}/api/authorize`,
    token_endpoint: `${env.NEXTAUTH_URL}/api/token`,
    registration_endpoint: `${env.NEXTAUTH_URL}/api/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
  })
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
