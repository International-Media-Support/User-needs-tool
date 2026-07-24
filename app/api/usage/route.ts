export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { resolveSession } from '@/lib/lti'
import { getBearerToken } from '@/lib/session'
import { supabase } from '@/lib/supabase'
import { logSecurityEvent } from '@/lib/log'

export async function GET(req: NextRequest) {
  try {
    const token = getBearerToken(req)
    if (!token) {
      await logSecurityEvent('auth_no_token', { route: 'usage', status: 401 })
      return NextResponse.json({ error: 'No session token' }, { status: 401 })
    }

    const userId = await resolveSession(token)
    if (!userId) {
      await logSecurityEvent('auth_invalid_session', { route: 'usage', status: 401 })
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })
    }

    const limit = parseInt(process.env.DAILY_LIMIT || '20')

    // Counted in SQL by get_usage_count, which uses the same day boundary as
    // increment_usage. Keeping one definition means the number shown here
    // cannot drift from the number actually enforced.
    const { data, error } = await supabase.rpc('get_usage_count', {
      p_user_id: userId
    })

    if (error) throw error

    const used = data || 0

    return NextResponse.json({
      used,
      limit,
      remaining: limit - used
    })

  } catch (err) {
    console.error('Usage error:', err)
    await logSecurityEvent('upstream_error', { route: 'usage', status: 500 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}