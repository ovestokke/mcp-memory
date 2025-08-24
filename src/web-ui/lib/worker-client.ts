import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '../app/api/auth/[...nextauth]/route'

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787'

export interface WorkerClientOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  body?: unknown
  headers?: Record<string, string>
}

export class AuthenticatedWorkerClient {
  private static async getAuthenticatedSession() {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || !session.accessToken) {
      return { 
        error: NextResponse.json(
          { error: 'Authentication required' }, 
          { status: 401 }
        )
      }
    }
    
    return { session }
  }

  static async request(options: WorkerClientOptions): Promise<NextResponse> {
    try {
      // Validate authentication
      const authResult = await this.getAuthenticatedSession()
      if ('error' in authResult) {
        return authResult.error
      }

      const { session } = authResult

      // Prepare request headers
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${session.accessToken}`,
        ...options.headers
      }

      // Add Content-Type for requests with body
      if (options.body) {
        headers['Content-Type'] = 'application/json'
      }

      // Make request to worker
      const response = await fetch(`${WORKER_URL}${options.path}`, {
        method: options.method,
        headers,
        ...(options.body && { body: JSON.stringify(options.body) }),
      })

      // Handle non-OK responses
      if (!response.ok) {
        console.error(`Worker request failed: ${options.method} ${options.path} - ${response.status}`)
        return NextResponse.json(
          { error: `Worker request failed with status ${response.status}` },
          { status: response.status }
        )
      }

      // Handle empty responses (like DELETE operations)
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        return NextResponse.json({ success: true })
      }

      // Return JSON response
      const data = await response.json()
      return NextResponse.json(data)

    } catch (error) {
      console.error(`Worker client error: ${options.method} ${options.path}`, error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }

  // Convenience methods
  static get(path: string, headers?: Record<string, string>) {
    return this.request({ method: 'GET', path, headers })
  }

  static post(path: string, body: unknown, headers?: Record<string, string>) {
    return this.request({ method: 'POST', path, body, headers })
  }

  static put(path: string, body: unknown, headers?: Record<string, string>) {
    return this.request({ method: 'PUT', path, body, headers })
  }

  static delete(path: string, headers?: Record<string, string>) {
    return this.request({ method: 'DELETE', path, headers })
  }
}