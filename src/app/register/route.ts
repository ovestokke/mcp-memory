import { metadataCorsOptionsRequestHandler } from 'mcp-handler'
import { NextRequest } from 'next/server'
import z from 'zod'

const ClientRegistrationRequest = z.object({
  redirect_uris: z.array(z.string().url()),
  client_name: z.string().optional(),
  client_uri: z.string().url().optional(),
  // Add other optional fields as needed
})

export async function registerHandler(req: NextRequest) {
  const { data: params, success, error } = ClientRegistrationRequest.safeParse(await req.json())
  if (!success) {
    return Response.json(
      {
        error: 'invalid_request',
        error_description: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
      },
      { status: 400 },
    )
  }

  const clientId = `mcp-client-${Date.now()}-${crypto.randomUUID().replaceAll('-', '')}`

  return Response.json({
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    redirect_uris: params.redirect_uris,
    token_endpoint_auth_method: 'none', // PKCE only, no client secret
    grant_types: ['authorization_code'],
    response_types: ['code'],
  })
}

export { registerHandler as POST }
