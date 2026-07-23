/**
 * Structured security logging.
 *
 * Emits single-line JSON to stdout, which Vercel captures as function logs.
 * One line per event keeps the output greppable and machine-parseable, so it
 * can be shipped to a durable log sink later without changing call sites.
 *
 * WHAT MUST NEVER BE LOGGED HERE:
 *   - session tokens, handoff codes, OIDC state or nonce values
 *   - any part of the content a user pastes for analysis or ideation
 *   - API keys, the LTI private key, or database connection strings
 *   - names or email addresses (the system no longer holds either)
 *
 * The internal user id (a UUID) is logged deliberately: it is the pseudonymous
 * key needed for an audit trail, and it is meaningless without database access.
 *
 * RETENTION: two tiers, on purpose.
 *   - The JSON line below goes to stdout and is captured in Vercel's function
 *     logs. It carries the full detail including the internal user id, but
 *     retention is short on the free plan.
 *   - A daily counter is also written to security_events_daily (migration
 *     0006), which is durable. It records only day, event and route, with no
 *     user identifier, so it answers "is something anomalous happening" but
 *     not "who did it". See the migration for why it aggregates.
 *
 * The database write is awaited: on serverless, work not awaited before the
 * response may never run. It only happens on failure paths (401 and 429), not
 * on the happy path, so it adds no latency to normal use. Failures are
 * swallowed, because logging must never break a request.
 */

import { supabase } from '@/lib/supabase'

export type SecurityEvent =
  | 'auth_no_token'
  | 'auth_invalid_session'
  | 'rate_limited'
  | 'usage_limit_reached'
  | 'upstream_error'

interface SecurityDetails {
  route: string
  userId?: string
  status: number
}

export async function logSecurityEvent(event: SecurityEvent, details: SecurityDetails) {
  try {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        kind: 'security',
        event,
        ...details,
      })
    )
  } catch {
    // Never break a request over a log line.
  }

  try {
    await supabase.rpc('record_security_event', {
      p_event: event,
      p_route: details.route,
    })
  } catch {
    // Durable counters are best-effort; the stdout line above is the fallback.
  }
}
