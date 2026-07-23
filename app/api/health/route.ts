export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * Liveness/readiness probe for external uptime monitoring.
 *
 * Deliberately unauthenticated, so it returns the minimum possible: a status
 * word and nothing else. No version, no environment, no error detail, no row
 * counts. The database check is a HEAD-style query that returns no rows, so it
 * is cheap and cannot be used to read or enumerate data.
 */
export async function GET() {
  try {
    const { error } = await supabase
      .from('users')
      .select('id', { head: true, count: 'exact' })
      .limit(1)

    if (error) throw error

    return NextResponse.json(
      { status: 'ok' },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return NextResponse.json(
      { status: 'degraded' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
