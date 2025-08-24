import { NextRequest, NextResponse } from 'next/server'
import { AuthenticatedWorkerClient } from '../../../lib/worker-client'

export async function GET() {
  return AuthenticatedWorkerClient.get('/api/memories')
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  return AuthenticatedWorkerClient.post('/api/memories', body)
}

export async function DELETE(request: NextRequest) {
  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  
  if (!id) {
    return NextResponse.json(
      { error: 'Memory ID is required' },
      { status: 400 }
    )
  }

  return AuthenticatedWorkerClient.delete(`/api/memories/${id}`)
}