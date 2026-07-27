/**
 * Sentry event scrubbing.
 *
 * This is the single most dangerous integration in the project from a data
 * protection point of view. Everything else in this codebase is built so that
 * content pasted for analysis or ideation is never persisted anywhere. An
 * error tracker that captures request bodies would undo that in one step, and
 * would do it quietly, because the content would sit in a third-party system
 * that nobody thinks of as a database.
 *
 * So this module works as an ALLOWLIST, not a denylist. It rebuilds the parts
 * of the event that can carry user data, keeping only fields known to be safe,
 * rather than trying to delete the risky ones. A denylist fails open when
 * Sentry adds a new field; an allowlist fails closed.
 *
 * WHAT MUST NEVER REACH SENTRY:
 *   - request bodies, which hold `text` (analyser) and `brief` (ideation)
 *   - the Authorization header, which holds the session bearer token
 *   - cookies
 *   - query strings, which can carry the one-time LTI handoff code
 *   - the Moodle user identifier
 *   - API keys, the LTI private key, database connection strings
 *
 * WHAT IS ALLOWED:
 *   - the internal user id (a UUID), which is pseudonymous, meaningless
 *     without database access, and is the audit key used everywhere else
 *   - HTTP method and URL path with the query string removed
 *   - exception type, message and stack trace
 *
 * This is exported and unit tested rather than written inline in the Sentry
 * config, so the guarantee is verifiable in CI rather than asserted in a
 * comment. See tests/security.test.ts.
 */

// Header names are compared lowercase. Anything not on this list is dropped.
const ALLOWED_HEADERS = ['content-type', 'user-agent', 'referer']

type SentryEventLike = {
  request?: {
    method?: string
    url?: string
    data?: unknown
    headers?: Record<string, string>
    cookies?: unknown
    query_string?: unknown
  }
  user?: Record<string, unknown>
  breadcrumbs?: Array<Record<string, unknown>>
  extra?: Record<string, unknown>
  contexts?: Record<string, unknown>
  [key: string]: unknown
}

/** Strip the query string and fragment, keeping origin and path. */
export function stripQuery(url: string): string {
  return url.split('#')[0].split('?')[0]
}

/**
 * Generic in T so the caller's Sentry event type is preserved. The event is
 * mutated in place and returned, which keeps Sentry's own ErrorEvent /
 * TransactionEvent types intact without casting at every call site.
 */
export function scrubEvent<T extends object>(input: T): T {
  const event = input as SentryEventLike
  // --- request: rebuild from scratch, keeping only method and bare path ---
  if (event.request) {
    const safeHeaders: Record<string, string> = {}
    for (const [key, value] of Object.entries(event.request.headers ?? {})) {
      if (ALLOWED_HEADERS.indexOf(key.toLowerCase()) !== -1) {
        safeHeaders[key] = value
      }
    }

    event.request = {
      method: event.request.method,
      ...(event.request.url ? { url: stripQuery(event.request.url) } : {}),
      headers: safeHeaders,
    }
  }

  // --- user: internal UUID only ---
  if (event.user) {
    const id = event.user.id
    event.user = typeof id === 'string' ? { id } : {}
  }

  // --- breadcrumbs: keep the shape of what happened, never the payload ---
  // console breadcrumbs are dropped outright: if any code path ever logs
  // content, this is where it would surface.
  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs
      .filter((b) => b.category !== 'console')
      .map((b) => {
        const url = (b.data as Record<string, unknown> | undefined)?.url
        return {
          type: b.type,
          category: b.category,
          level: b.level,
          timestamp: b.timestamp,
          ...(typeof url === 'string' ? { data: { url: stripQuery(url) } } : {}),
        }
      })
  }

  // --- extra and contexts: arbitrary attachments, no way to vet them ---
  delete event.extra
  if (event.contexts) {
    // `trace` is Sentry's own span metadata and carries no user data.
    const trace = (event.contexts as Record<string, unknown>).trace
    event.contexts = trace ? { trace } : {}
  }

  return input
}
