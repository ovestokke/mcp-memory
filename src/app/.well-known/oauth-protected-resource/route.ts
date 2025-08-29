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

  // return NextResponse.json({
  //   resource: `${env.NEXTAUTH_URL}/api/mcp`,
  //   authorization_servers: [env.NEXTAUTH_URL],
  //   // scopes_supported: [],
  //   bearer_methods_supported: ['header'],
  //   resource_documentation: env.NEXTAUTH_URL,
  // })
}

// export async function OPTIONS() {
//   return new NextResponse(null, {
//     status: 200,
//     headers: {
//       'Access-Control-Allow-Origin': '*',
//       'Access-Control-Allow-Methods': 'GET, OPTIONS',
//       'Access-Control-Allow-Headers': 'Content-Type, Authorization',
//     },
//   })
// }

export { metadataCorsOptionsRequestHandler as OPTIONS }
