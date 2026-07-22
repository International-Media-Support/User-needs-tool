-- 0004_retention.sql
-- Data retention: purge expired ephemeral rows on a schedule, and index the
-- session expiry column the purge filters on.
--
-- Requires the pg_cron extension. On Supabase, enable it once under
-- Database > Extensions, then run this file in the SQL Editor. If the SQL
-- Editor has permission, the create extension line below enables it for you.

create extension if not exists pg_cron;

-- Supports expiry filtering / cleanup on the sessions table.
create index if not exists idx_lti_sessions_expires on lti_sessions(expires_at);

-- Expired sessions, every 15 minutes.
select cron.schedule(
  'purge-lti-sessions',
  '*/15 * * * *',
  $$delete from lti_sessions where expires_at < now()$$
);

-- Expired OIDC launch state, every 15 minutes.
select cron.schedule(
  'purge-lti-launch-state',
  '*/15 * * * *',
  $$delete from lti_launch_state where expires_at < now()$$
);

-- Expired handoff codes, every 5 minutes.
select cron.schedule(
  'purge-lti-handoff',
  '*/5 * * * *',
  $$delete from lti_handoff where expires_at < now()$$
);

-- Stale rate-limit rows (older than 1 hour), every 10 minutes.
select cron.schedule(
  'purge-rate-limit',
  '*/10 * * * *',
  $$delete from rate_limit where created_at < now() - interval '1 hour'$$
);

-- OPTIONAL, POLICY DECISION (left disabled on purpose).
-- usage holds user_id, used_at and feature (minimal PII). Aging it out enforces
-- data minimisation but also removes historical usage. Pick a period, then
-- uncomment. Example keeps 13 months:
-- select cron.schedule(
--   'purge-usage',
--   '0 3 * * *',
--   $$delete from usage where used_at < now() - interval '13 months'$$
-- );
