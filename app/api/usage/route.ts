export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { resolveSession } from '@/lib/lti'
import { getBearerToken } from '@/lib/session'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const token = getBearerToken(req)
    if (!token) {
      return NextResponse.json({ error: 'No session token' }, { status: 401 })
    }

    const userId = await resolveSession(token)
    if (!userId) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })
    }

    const limit = parseInt(process.env.DAILY_LIMIT || '20')
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const { count } = await supabase
      .from('usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('used_at', startOfDay.toISOString())

    const used = count || 0

    return NextResponse.json({
      used,
      limit,
      remaining: limit - used
    })

  } catch (err) {
    console.error('Usage error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}