-- 0005_minimise_and_aggregate.sql
--
-- Three changes, following the decision that the only purposes for this data
-- are (a) enforcing the daily usage limit and (b) per-user feature analysis:
--
--   1. Drop users.email and users.name. Nothing in the application reads them,
--      so they were stored without a purpose. Removing them leaves users
--      pseudonymous (moodle_user_id only).
--   2. Add get_usage_count(), so the "what counts as today" rule is defined
--      once in SQL and used by both the enforcement path (increment_usage)
--      and the display path (/api/usage), instead of being computed
--      separately in JavaScript.
--   3. Add usage_daily and a nightly rollup. Raw usage rows are collapsed into
--      per-user, per-day, per-feature counts and then deleted, so the raw
--      table only ever holds the current day (which is all the limit needs).

-- ---------------------------------------------------------------------------
-- 1. Data minimisation
-- ---------------------------------------------------------------------------
alter table users drop column if exists email;
alter table users drop column if exists name;

-- ---------------------------------------------------------------------------
-- 2. Single definition of the daily window
-- ---------------------------------------------------------------------------
-- Uses exactly the same expression as increment_usage, so the count shown to
-- the user cannot drift from the count that is enforced.
create or replace function get_usage_count(p_user_id uuid)
returns int
language sql
stable
as $$
  select count(*)::int
  from usage
  where user_id = p_user_id
    and used_at >= date_trunc('day', now());
$$;

-- ---------------------------------------------------------------------------
-- 3. Aggregate retention
-- ---------------------------------------------------------------------------
create table if not exists usage_daily (
  user_id uuid references users(id) on delete cascade,
  day date not null,
  feature text not null,
  count int not null default 0,
  primary key (user_id, day, feature)
);

alter table usage_daily enable row level security;
drop policy if exists "service only" on usage_daily;
create policy "service only" on usage_daily for all using (false);

-- Rolls every completed day into counts, then removes those raw rows.
-- Only touches rows before today's midnight, so it can never delete a row the
-- current day's limit still depends on.
--
-- Defensive details: feature and user_id are nullable on usage, and both are
-- part of the usage_daily primary key. Rows with a null user_id carry no
-- per-user meaning so they are not aggregated, and a null feature is recorded
-- as 'unknown'. Without this a single malformed row would make the scheduled
-- job fail every night.
create or replace function rollup_usage()
returns void
language plpgsql
as $$
begin
  insert into usage_daily (user_id, day, feature, count)
  select user_id, used_at::date, coalesce(feature, 'unknown'), count(*)
  from usage
  where used_at < date_trunc('day', now())
    and user_id is not null
  group by user_id, used_at::date, coalesce(feature, 'unknown')
  on conflict (user_id, day, feature)
  do update set count = usage_daily.count + excluded.count;

  -- Deletes all aged rows, including any that were not aggregated above.
  delete from usage where used_at < date_trunc('day', now());
end;
$$;

-- Requires pg_cron (also enabled in 0004; repeated here so this migration is
-- self-contained). Re-running cron.schedule with the same job name updates the
-- existing job rather than duplicating it.
create extension if not exists pg_cron;

select cron.schedule('rollup-usage', '0 3 * * *', $$select rollup_usage()$$);

-- NOTE: do not also enable the commented-out 'purge-usage' job in 0004. That
-- one deletes raw rows without aggregating them first, which would lose the
-- feature-usage counts.
--
-- POLICY: usage_daily still carries user_id, so it remains personal data, just
-- far less granular. Set a retention period for it and schedule a purge:
-- select cron.schedule('purge-usage-daily', '0 4 * * *',
--   $$delete from usage_daily where day < current_date - interval '13 months'$$);
