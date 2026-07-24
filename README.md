# User Needs Tool

An internal tool that scores and generates story ideas against the BBC User
Needs Model. Launched from Moodle via LTI 1.3; two AI features (analyser and
ideation) call the Anthropic API server-side.

## Stack

- Next.js 14 (App Router), React 18, TypeScript
- Tailwind CSS, Recharts
- Supabase (managed PostgreSQL) for persistence
- Auth: Moodle LTI 1.3 (OIDC) verified with `jose`
- Hosted on Vercel

## Architecture

- `app/api/lti/launch` handles OIDC login initiation and the id_token
  callback. State and nonce are issued with `crypto.randomUUID`, stored
  server-side in `lti_launch_state`, and validated one-time on callback.
- The session is delivered to the browser through a one-time, short-lived
  handoff code (`lti_handoff`), swapped for the session token at
  `app/api/session/exchange`. This avoids third-party cookies inside the
  Moodle iframe and keeps the token out of the URL.
- `app/api/lti/jwks` publishes only the public signing key.
- `app/api/analyze` and `app/api/ideate` validate the Bearer session, enforce
  a per-user per-minute rate limit and the daily usage limit (atomic, via a
  Postgres advisory-locked function), cap input size, then call Anthropic.
- Row Level Security is enabled on every table with service-only policies; all
  access is server-side with the service-role key.

## Data model

- `users` - moodle_user_id only (pseudonymous; no email or name is collected)
- `usage` - user_id, used_at, feature (current day only; older rows are aggregated)
- `usage_daily` - user_id, day, feature, count (historical usage as counts)
- `lti_sessions` — token, user_id, expires_at
- `lti_launch_state` — state, nonce, expires_at (OIDC CSRF/replay)
- `lti_handoff` — code, session_token, expires_at (session delivery)
- `rate_limit` — bucket, created_at (per-route limiting)
- `security_events_daily` — day, event, route, count. Aggregated security-event
  counters with no user identifier, so the table is not personal data. Purged
  after 12 months.

Schema lives in `supabase/schema.sql` plus `supabase/migrations/*`, applied in
order. Expired ephemeral rows are purged by scheduled jobs in
`0004_retention.sql`. `0005_minimise_and_aggregate.sql` drops the unused
email/name columns, adds `get_usage_count()` so the daily window is defined once
in SQL, and rolls completed days into `usage_daily`. The DSAR export/erasure
procedure is in `supabase/dsar.sql`.

## Environment variables

- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `LTI_PRIVATE_KEY`, `LTI_PLATFORM_JWKS_URL`, `LTI_PLATFORM_ISSUER`, `LTI_CLIENT_ID`
- `NEXT_PUBLIC_APP_URL`
- `DAILY_LIMIT` (default 20)

## Deploy

Push to `main` deploys via Vercel's Git integration. CI (`.github/workflows`)
runs lint, a dependency audit, and CodeQL analysis.
