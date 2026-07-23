-- 0006_security_events.sql
--
-- Durable retention for security logging.
--
-- Until now security events went only to stdout, captured as Vercel function
-- logs, which have short retention on the free plan. This gives them a durable
-- home without adding a new vendor (and therefore without a new sub-processor
-- or an extra DPA to negotiate).
--
-- TWO DELIBERATE DESIGN CHOICES, both worth understanding before relying on it:
--
-- 1. COUNTS, NOT INDIVIDUAL EVENTS. A row per event would be an unbounded
--    write path reachable by an unauthenticated caller: anyone could spam
--    invalid tokens and grow this table without limit, which is both a cost
--    and an availability problem. Daily counters are bounded by
--    (days x event types x routes) no matter how much traffic arrives.
--
-- 2. NO USER IDENTIFIER. Keeping user_id out means this table holds no
--    personal data at all, so it needs no DSAR handling, no erasure cascade
--    and no minimisation argument.
--
-- The cost of both choices is that this answers "is something anomalous
-- happening" but not "who did it". Per-event, per-user detail still exists in
-- the Vercel function logs, at their shorter retention. If per-user forensics
-- is ever required, that needs a real log sink rather than this table.

create table if not exists security_events_daily (
  day date not null,
  event text not null,
  route text not null,
  count int not null default 0,
  primary key (day, event, route)
);

alter table security_events_daily enable row level security;
drop policy if exists "service only" on security_events_daily;
create policy "service only" on security_events_daily for all using (false);

-- Single upsert per event. Cheap, and safe to call concurrently.
create or replace function record_security_event(p_event text, p_route text)
returns void
language sql
as $$
  insert into security_events_daily (day, event, route, count)
  values (current_date, p_event, p_route, 1)
  on conflict (day, event, route)
  do update set count = security_events_daily.count + 1;
$$;

-- Retention. Enabled by default at 12 months, unlike the usage_daily purge
-- which is still awaiting a decision: these rows are counts with no user
-- reference, so a sensible default carries no privacy risk. Adjust freely.
create extension if not exists pg_cron;

select cron.schedule(
  'purge-security-events',
  '0 4 * * *',
  $$delete from security_events_daily where day < current_date - interval '12 months'$$
);

-- Useful queries:
--   Recent activity:
--     select * from security_events_daily
--     where day > current_date - 14 order by day desc, count desc;
--   Spot a spike in failed auth:
--     select day, sum(count) from security_events_daily
--     where event in ('auth_no_token','auth_invalid_session')
--     group by day order by day desc limit 30;
