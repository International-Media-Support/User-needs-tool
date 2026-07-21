-- Atomic daily usage increment.
-- Counts today's usage and inserts the new row inside one call, serialised per
-- user with an advisory lock so two concurrent requests cannot both pass the
-- limit. Returns the remaining count, or -1 if the user is already at the limit.
create or replace function increment_usage(p_user_id uuid, p_feature text, p_limit int)
returns int
language plpgsql
as $$
declare
  used int;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select count(*) into used
  from usage
  where user_id = p_user_id
    and used_at >= date_trunc('day', now());

  if used >= p_limit then
    return -1;
  end if;

  insert into usage (user_id, feature) values (p_user_id, p_feature);
  return p_limit - used - 1;
end;
$$;

-- Per-route rate limiting (short sliding window).
create table if not exists rate_limit (
  id bigint generated always as identity primary key,
  bucket text not null,
  created_at timestamptz default now()
);

create index if not exists idx_rate_limit_bucket_time on rate_limit(bucket, created_at);

alter table rate_limit enable row level security;
create policy "service only" on rate_limit for all using (false);

-- Records a hit and reports whether it is within the limit for the window.
-- Serialised per bucket; stale rows for the bucket are pruned on each call.
create or replace function check_rate_limit(p_bucket text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
as $$
declare
  cnt int;
begin
  perform pg_advisory_xact_lock(hashtext(p_bucket));

  delete from rate_limit
  where bucket = p_bucket
    and created_at < now() - make_interval(secs => p_window_seconds);

  select count(*) into cnt from rate_limit where bucket = p_bucket;

  if cnt >= p_limit then
    return false;
  end if;

  insert into rate_limit (bucket) values (p_bucket);
  return true;
end;
$$;

-- Optional: purge any leftover rows if pg_cron is enabled.
-- select cron.schedule('purge-rate-limit', '*/10 * * * *',
--   $$delete from rate_limit where created_at < now() - interval '1 hour'$$);
