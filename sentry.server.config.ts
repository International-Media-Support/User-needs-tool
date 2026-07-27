// Sentry, server runtime (Node).
//
// Privacy configuration is not optional here: see lib/sentry-scrub.ts for why.
// Anything changed in this file should be checked against tests/security.test.ts,
// which encodes the guarantees rather than trusting them.
import * as Sentry from '@sentry/nextjs'
import { scrubEvent } from '@/lib/sentry-scrub'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // No IP addresses, no cookies, no request bodies attached automatically.
  // This single flag is the difference between an error tracker and an
  // unlogged copy of everything users paste.
  sendDefaultPii: false,

  // Local variables in stack frames would include the request body of the
  // failing function. Off.
  includeLocalVariables: false,

  // Performance tracing samples request data. The tool is not large enough
  // for tracing to earn its privacy cost.
  tracesSampleRate: 0,

  // Belt and braces: even with the flags above, rebuild every event through
  // the allowlist before it leaves the process.
  beforeSend: (event) => scrubEvent(event),

  // Breadcrumbs are scrubbed in beforeSend, but dropping console breadcrumbs
  // at source means content never enters the buffer in the first place.
  beforeBreadcrumb: (crumb) => (crumb.category === 'console' ? null : crumb),

  environment: process.env.VERCEL_ENV || 'development',
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
})
