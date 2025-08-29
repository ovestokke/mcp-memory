import { env } from '@/env'
import { NextRequest, NextResponse } from 'next/server'

import { protectedResourceHandler, metadataCorsOptionsRequestHandler } from 'mcp-handler'

const handler = protectedResourceHandler({
  authServerUrls: [env.NEXTAUTH_URL],
})

export async function GET(req: NextRequest) {
  const response = await handler(req)
  const data = await response.json()

  return new NextResponse(
    JSON.stringify({
      ...data,
      resource: `${env.NEXTAUTH_URL}/api/mcp`,
      // resource_documentation: `${env.NEXTAUTH_URL}/.well-known/oauth-protected-resource`,
    }),
    {
      headers: response.headers,
    },
  )
}

export { metadataCorsOptionsRequestHandler as OPTIONS }
