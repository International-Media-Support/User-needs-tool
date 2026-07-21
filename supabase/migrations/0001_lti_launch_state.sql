-- OIDC login state for LTI launches (CSRF + replay protection).
-- One row per login initiation; consumed (deleted) on callback.
create table if not exists lti_launch_state (
  state text primary key,
  nonce text not null,
  created_at timestamptz default now(),
  expires_at timestamptz default now() + interval '10 minutes'
);

alter table lti_launch_state enable row level security;

-- All access is via the service role through the API; block anon/auth roles.
create policy "service only" on lti_launch_state for all using (false);

-- Helps the cleanup job below and expiry checks.
create index if not exists idx_lti_launch_state_expires on lti_launch_state(expires_at);

-- Optional: schedule cleanup of stale rows if pg_cron is enabled.
-- select cron.schedule('purge-lti-launch-state', '*/15 * * * *',
--   $$delete from lti_launch_state where expires_at < now()$$);
