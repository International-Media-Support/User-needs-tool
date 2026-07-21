export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { consumeHandoff, resolveSession, checkUsage } from '@/lib/lti'

// Swaps a one-time launch code for the session token. Called by the client
// immediately after the LTI launch redirect.
export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json()
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Missing code' }, { status: 400 })
    }

    const sessionToken = await consumeHandoff(code)
    if (!sessionToken) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 })
    }

    const userId = await resolveSession(sessionToken)
    if (!userId) {
      return NextResponse.json({ error: 'Session not found' }, { status: 401 })
    }

    const remaining = await checkUsage(userId)
    return NextResponse.json({ session: sessionToken, remaining })
  } catch (err) {
    console.error('Exchange error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
