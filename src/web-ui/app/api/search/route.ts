import { NextRequest } from 'next/server'
import { AuthenticatedWorkerClient } from '../../../lib/worker-client'

export async function POST(request: NextRequest) {
  const body = await request.json()
  return AuthenticatedWorkerClient.post('/api/search', body)
}