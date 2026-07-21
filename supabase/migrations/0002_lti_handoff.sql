-- One-time launch handoff codes (iframe-safe session delivery).
-- A row is created at launch and consumed (deleted) when the client exchanges
-- the code for its session. Short-lived.
create table if not exists lti_handoff (
  code text primary key,
  session_token text not null,
  created_at timestamptz default now(),
  expires_at timestamptz default now() + interval '60 seconds'
);

alter table lti_handoff enable row level security;

create policy "service only" on lti_handoff for all using (false);

create index if not exists idx_lti_handoff_expires on lti_handoff(expires_at);

-- Optional: purge stale codes if pg_cron is enabled.
-- select cron.schedule('purge-lti-handoff', '*/5 * * * *',
--   $$delete from lti_handoff where expires_at < now()$$);
