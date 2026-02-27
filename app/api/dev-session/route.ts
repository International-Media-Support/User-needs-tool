import { NextResponse } from 'next/server'
import { getOrCreateUser, createSession } from '@/lib/lti'

export async function GET() {
  const userId = await getOrCreateUser('dev-user-1', 'dev@test.com', 'Dev User')
  const token = await createSession(userId)
  return NextResponse.json({ token })
}