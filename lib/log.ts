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
 * NOTE ON RETENTION: Vercel's function logs are short-lived on the free plan,
 * so this gives structure but not durable retention. Shipping these lines to a
 * durable sink is still outstanding.
 */

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

export function logSecurityEvent(event: SecurityEvent, details: SecurityDetails) {
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
    // Logging must never break a request.
  }
}
