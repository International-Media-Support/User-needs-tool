export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getOrCreateUser, createSession } from '@/lib/lti'

export async function GET() {
  const userId = await getOrCreateUser('guest-user', 'guest@guest.com', 'Guest')
  const token = await createSession(userId)
  return NextResponse.json({ token })
}