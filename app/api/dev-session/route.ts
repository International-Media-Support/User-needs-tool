export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getOrCreateUser, createSession } from '@/lib/lti'

export async function GET() {
  try {
    const userId = await getOrCreateUser('guest-user', 'guest@guest.com', 'Guest')
    const token = await createSession(userId)
    return NextResponse.json({ token })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}