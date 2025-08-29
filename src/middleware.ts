import { auth } from '@/auth'
import { NextRequest, NextResponse } from 'next/server'

export default async function middleware(request: NextRequest) {
  // Clone the request to read the body without consuming it
  const clonedRequest = request.clone()
  
  // Apply auth middleware first
  const response = await auth(request)
  
  // Log API requests with bodies for debugging
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const startTime = Date.now()
    
    // Get the response (either from auth or continue to route)
    const finalResponse = response || NextResponse.next()
    
    const duration = Date.now() - startTime
    const method = request.method
    const path = request.nextUrl.pathname
    const status = finalResponse.status
    
    // Log errors with request body
    if (status >= 400) {
      let body = ''
      try {
        if (method !== 'GET' && method !== 'HEAD') {
          body = await clonedRequest.text()
        }
      } catch (e) {
        body = '[Could not read body]'
      }
      
      console.log(`[${new Date().toISOString()}] ${method} ${path} ${status} in ${duration}ms`)
      if (body) {
        console.log(`Request body: ${body}`)
      }
    } else {
      console.log(`[${new Date().toISOString()}] ${method} ${path} ${status} in ${duration}ms`)
    }
  }
  
  return response
}