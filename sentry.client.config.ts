// Sentry, browser runtime.
//
// The browser holds the session token in memory and the user's pasted content
// in component state, so the same allowlist applies here as on the server.
// Session Replay is deliberately NOT enabled: it would record the textarea
// contents, which is exactly the data this project is built not to retain.
import * as Sentry from '@sentry/nextjs'
import { scrubEvent } from '@/lib/sentry-scrub'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  tracesSampleRate: 0,

  // No replay. Not at a reduced sample rate, not on errors only.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  beforeSend: (event) => scrubEvent(event),
  beforeBreadcrumb: (crumb) => (crumb.category === 'console' ? null : crumb),

  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || 'development',
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
})
