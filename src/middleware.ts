import { NextRequest, NextResponse } from 'next/server'

function getCorsHeaders(request: NextRequest) {
  return {
    'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

export function middleware(request: NextRequest) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: getCorsHeaders(request),
    })
  }

  const response = NextResponse.next()

  for (const [key, value] of Object.entries(getCorsHeaders(request))) {
    response.headers.set(key, value)
  }

  return response
}
