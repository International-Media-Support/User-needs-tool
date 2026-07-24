# User Needs Tool: Operational Runbook

Living operational reference. Keep it current as the system changes. 

## 1. Ownership and accounts

- Source: github.com/International-Media-Support/User-needs-tool (organisation-owned).
- Hosting: Vercel (https://vercel.com/international-media-support/bbc-user-needs)
- Database: Supabase, IMS-owned account (https://qtqonkrlvpgzgkmdqppf.supabase.co), region: EU West (Ireland).
- AI: Anthropic API, IMS-owned account. Account owner: [FILL: role, not an individual].
- Admin access is via the organisation accounts and is held by role, not by a
  named individual. Current holders: [FILL: role names]. Review membership
  whenever someone joins or leaves.

## 2. Environments and URLs

- Production URL: https://bbc-user-needs.vercel.app/
- Deploys are push-to-`main` via Vercel's Git integration.



## 3. Environment variables

Set in Vercel project settings. None are committed.

- NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
- ANTHROPIC_API_KEY
- LTI_PRIVATE_KEY (RSA private signing key; server-only)
- LTI_PLATFORM_JWKS_URL, LTI_PLATFORM_ISSUER, LTI_CLIENT_ID
- NEXT_PUBLIC_APP_URL
- DAILY_LIMIT (default 20)

## 4. Providers and plans

| Provider  | Purpose            | Current plan        | Notes                                  |
|-----------|--------------------|---------------------|----------------------------------------|
| Vercel    | Hosting            | Hobby               | Non-commercial licence; move to Pro.   |
| Supabase  | PostgreSQL         | Free                | Pauses when idle (see 4a); Pro adds backups. |
| Anthropic | AI (analyse/ideate)| Pay as you go       | Primary variable cost.                 |

## 4a. Scheduled workflows (GitHub Actions)

- `ci.yml`: lint and dependency audit on push and pull request (reporting only).
- `codeql.yml`: code scanning on push and weekly.
- `backup.yml`: daily encrypted pg_dump, retained 30 days as a workflow
  artifact. Requires `SUPABASE_DB_URL` and `BACKUP_PASSPHRASE` secrets.
  Encryption is mandatory because this repository is public and artifacts on a
  public repository are downloadable by anyone. **Interim only; delete once on
  Supabase Pro.** Losing BACKUP_PASSPHRASE makes every backup unrecoverable, so
  store it somewhere durable and separate.
- `uptime.yml`: polls `/api/health` every 6 hours (widened from 30 minutes so
  that Actions consumption stays inside the free allowance once the repository
  is private; the trade-off is that an outage can go unnoticed for up to 6
  hours). A failed run is the alert
  (GitHub emails watchers on failure). Requires a repository **variable**
  `APP_URL` set to the production origin, no trailing slash.
- `restore-verify.yml`: weekly. Dumps the live database, round-trips it through
  the real BACKUP_PASSPHRASE, restores into a throwaway PostgreSQL container and
  asserts the expected tables and functions came back. Nothing is written to the
  live database and no artifact is produced. A failure means the backups would
  not actually restore.
- `cron-check.yml`: daily. Verifies the expected pg_cron jobs exist and are
  active, turning an otherwise silent retention failure into an email. If it
  fails, re-apply migrations 0004, 0005, 0006 and 0007.
- `smoke.yml`: daily. Probes the deployed app from outside and asserts that
  /api/analyze, /api/ideate and /api/usage all reject unauthenticated callers
  with 401, that health reports ok, and that the JWKS endpoint exposes no
  private key material. Consumes no Anthropic quota. Requires the APP_URL
  variable.
- `keepalive.yml`: pings the database every 3 days so the free Supabase project
  does not pause after 7 days idle. **Interim measure only. Delete it once the
  database is on Supabase Pro.** It requires a repository secret
  `SUPABASE_DB_URL` (session-pooler connection string). If the database password
  is rotated, update this secret or the workflow fails silently and the project
  can pause.

## 4b. Making the repository private

The repository is currently public so that external tooling can read it. It is
intended to become private. Three things change on that switch, and the first
two need a decision before flipping it:

1. **Code scanning stops.** CodeQL is free on public repositories only. On a
   private repository it requires GitHub Code Security (Advanced Security), a
   paid add-on needing Team or Enterprise. Either buy it, or delete
   `codeql.yml`, rely on `npm audit` and Dependabot alerts, and record the
   reduced coverage in the compliance document. Dependabot itself, both version
   updates and security alerts, keeps working on private repositories.
2. **Actions minutes become metered.** Unmetered on public repositories; on
   private ones the Free plan includes 2,000 Linux minutes per month and Team
   3,000, billed per job rounded up to the minute. Current workflows are
   estimated at roughly 380 minutes per month after the uptime interval was
   widened to 6 hours. The failure mode matters: with the default zero spending
   limit, exhausting the quota stops ALL workflows, including the database
   backup, with no announcement. Check usage in the organisation billing
   settings after the switch.
3. **Artifact storage becomes metered.** 500 MB on Free, 2 GB on Team. The
   backup workflow keeps 30 daily encrypted dumps; the database is small, so
   this should fit, but it is worth confirming once real usage accumulates.

Unchanged: encryption of backups is still required, since artifacts are
readable by everyone with repository access either way.

## 5. Data inventory

- users: moodle_user_id, created_at. No email or name is collected (removed in
  migration 0005), so the record is pseudonymous.
- usage: user_id, used_at, feature. Holds the current day only.
- usage_daily: user_id, day, feature, count. Historical usage as counts.
- lti_sessions, lti_launch_state, lti_handoff, rate_limit: short-lived operational rows.
- Content pasted for analysis or ideation is sent to Anthropic and is not stored.

Purposes: the data supports enforcing the daily usage limit and per-user
feature analysis. Nothing is collected beyond what those two purposes need.

## 6. Data retention

- Expired session, launch-state and handoff rows and stale rate-limit rows are
  purged by pg_cron jobs (supabase/migrations/0004_retention.sql). Requires
  pg_cron enabled in Supabase.
- Raw usage rows are rolled up nightly into usage_daily by rollup_usage() and
  then deleted, so the raw table only ever holds the current day. Do not also
  enable the commented-out 'purge-usage' job in 0004: it deletes without
  aggregating.
- usage_daily still carries user_id and so remains personal data, though far
  less granular. **Retention: six months.** Enforced by the `purge-usage-daily`
  pg_cron job (supabase/migrations/0007_usage_daily_retention.sql), which runs
  daily at 04:30 and deletes counts older than six months. This is a hard
  delete with no further aggregation behind it.
- Security event counters in security_events_daily are purged after 12 months
  (migration 0006). They carry no user identifier, so they are not personal
  data.
- Changing the usage_daily period: re-run `cron.schedule` with the same job
  name and a different interval, then update this runbook and the privacy
  notice in the same change. If the documented period and the scheduled job
  disagree, the documented one is wrong.

## 7. Data subject requests (DSAR)

- Export and erasure SQL by moodle_user_id: supabase/dsar.sql, run in the SQL
  Editor. Erasure cascades from users to both usage and usage_daily.
- Note the export is small by design: no name or email is held, so a subject
  access response is the moodle_user_id, the current day's usage rows, and the
  historical per-day feature counts.

## 8. Key rotation

- LTI signing key: rotating requires generating a new key
  (scripts/generate-lti-key.mjs), updating LTI_PRIVATE_KEY, and confirming the
  JWKS endpoint serves the new public key to Moodle. [FILL: cadence.]
- Supabase service-role key and Anthropic API key: rotate in the respective
  dashboards and update Vercel env quarterly.

## 9. Deploy and rollback

- Deploy: push to `main`. CI runs lint, dependency audit and CodeQL.
- ESLint runs during `next build`, so a lint error fails the deploy. The
  `@typescript-eslint/no-explicit-any` rule is set to warn (ten known instances
  in app/page.tsx), so those surface without blocking.
- Rollback: in the Vercel dashboard, promote the previous successful deployment.

## 9a. Applying the database schema

To stand up a database from scratch (new project, restore, or scratch copy):

1. Enable the `pg_cron` extension (Database > Extensions).
2. In the SQL Editor run `supabase/schema.sql`.
3. Then run each file in `supabase/migrations/` in numerical order:
   0001 (lti_launch_state), 0002 (lti_handoff), 0003 (rate limiting and atomic
   usage), 0004 (retention purges), 0005 (minimisation, get_usage_count,
   usage_daily rollup), 0006 (security event counters and their 12-month
   purge), 0007 (usage_daily six-month retention purge).
4. Verify the scheduled jobs exist: `select jobname, active from cron.job;`
   Expect seven: purge-lti-sessions, purge-lti-launch-state, purge-lti-handoff,
   purge-rate-limit, rollup-usage, purge-security-events, purge-usage-daily.
   Scheduled jobs are not restored by a database dump. See the DR plan.

## 9b. Security logging

Auth failures, rate limiting and usage-limit hits are emitted as single-line
JSON from `lib/log.ts`, tagged `"kind":"security"`, and captured in the Vercel
function logs. Fields are the event, route, HTTP status and, where known, the
internal user id.

Deliberately never logged: session tokens, handoff codes, OIDC state or nonce,
any user-submitted content, keys or connection strings.

Retention now has two tiers:
- Full detail, including the internal user id, in the Vercel function logs.
  Short retention on the free plan.
- Durable daily counters in `security_events_daily` (migration 0006), holding
  day, event, route and a count. No user identifier, so the table is not
  personal data and needs no DSAR handling. Purged after 12 months.

The counters answer "is something anomalous happening"; they cannot answer
"who did it". Per-user forensics beyond the Vercel retention window would need
a real log sink. To review:

    select * from security_events_daily
    where day > current_date - 14 order by day desc, count desc;

## 10. Monitoring

- Vercel dashboard metrics and function logs (short retention on the free plan).
- Implent error tracking (Sentry), and Anthropic spend alerts

## 11. Capacity ceilings and upgrade triggers

- Supabase Free: 500 MB database, 50k MAU. Trigger: approach either limit ->
  Supabase Pro.
- Vercel Hobby: 100 GB bandwidth, ~60s function limit, non-commercial licence.
  Trigger: organisational/commercial use or bandwidth pressure -> Vercel Pro.
- Anthropic: per-user daily limit (DAILY_LIMIT) bounds spend. Trigger: raise the
  limit or add caching as usage grows.

## 12. Exit strategy

The stack is portable: Next.js on any Node host, standard PostgreSQL, code in
GitHub. To exit a provider: export the database with pg_dump, redeploy the app
to the alternative host, restore the dump, and re-point environment variables.
Re-apply migrations 0004 and 0005 afterwards, since scheduled jobs do not travel
with a dump (section 9a). The only dependency that is not plain PostgreSQL is
pg_cron; on a host without it, run the purge and rollup SQL from an external
scheduler instead.
## 13. Support

- Pranjal Garg or User Needs Tool IT Lead
