-- 0008_anomaly_detection.sql
--
-- Reads security_events_daily and reports days that look abnormal.
--
-- Migration 0006 gave security events a durable home but nothing has ever read
-- them, so an attack in progress produced a row in a table nobody looked at.
-- This adds the reading side.
--
-- WHAT "ABNORMAL" MEANS HERE. A day is flagged for a given (event, route) pair
-- if either test trips:
--
--   1. RELATIVE. The count exceeds p_multiplier times the mean of the trailing
--      baseline window. Catches a spike against that pair's own normal, which
--      differs a lot by pair: auth_no_token is routine background noise from
--      expired tabs, while a rate_limited spike is not.
--
--   2. ABSOLUTE. The count exceeds p_floor. Catches the case the relative test
--      misses: if the baseline is 0 or 1, almost anything is "3x the average",
--      and conversely a genuinely large number matters even where the baseline
--      is already high.
--
-- The relative test is suppressed until there are at least p_min_days of
-- baseline. Without that guard the first fortnight of operation would alert on
-- everything, which is the fastest way to train people to ignore alerts.
--
-- WHAT IT CANNOT DO. security_events_daily holds daily counts with no user
-- identifier, by design (see 0006). So this answers "is something anomalous
-- happening" and not "who is doing it", and its finest granularity is one day.
-- Sub-daily detection would need a different schema; per-user attribution would
-- need a real log sink. Both were traded away deliberately for a bounded write
-- path and a table containing no personal data.

create extension if not exists pg_cron;

create or replace function detect_security_anomalies(
  p_day date default current_date - 1,
  p_multiplier numeric default 3.0,
  p_floor int default 200,
  p_baseline_days int default 14,
  p_min_days int default 7
)
returns table (
  event text,
  route text,
  count int,
  baseline_avg numeric,
  baseline_days int,
  reason text
)
language sql
stable
as $$
  with baseline as (
    select
      s.event,
      s.route,
      avg(s.count)::numeric(10,2) as avg_count,
      count(*)::int               as days_observed
    from security_events_daily s
    where s.day >= p_day - p_baseline_days
      and s.day <  p_day
    group by s.event, s.route
  ),
  today as (
    select s.event, s.route, s.count
    from security_events_daily s
    where s.day = p_day
  )
  select
    t.event,
    t.route,
    t.count,
    coalesce(b.avg_count, 0)     as baseline_avg,
    coalesce(b.days_observed, 0) as baseline_days,
    case
      when t.count > p_floor
        and b.days_observed >= p_min_days
        and t.count > b.avg_count * p_multiplier
        then 'above absolute floor and ' || p_multiplier || 'x baseline'
      when t.count > p_floor
        then 'above absolute floor of ' || p_floor
      else p_multiplier || 'x baseline of ' || coalesce(b.avg_count, 0)
    end as reason
  from today t
  left join baseline b
    on b.event = t.event
   and b.route = t.route
  where
    -- absolute test, always active
    t.count > p_floor
    -- relative test, only once there is enough history to mean anything
    or (
      b.days_observed >= p_min_days
      and t.count > b.avg_count * p_multiplier
    )
  order by t.count desc;
$$;

-- Convenience view over the last 30 days, for setting thresholds from observed
-- data rather than guessing. Run this during the report-only period:
--   select * from security_events_recent;
create or replace view security_events_recent as
  select day, event, route, count
  from security_events_daily
  where day >= current_date - 30
  order by day desc, count desc;

-- Verify after applying:
--   select * from detect_security_anomalies();
-- An empty result means yesterday looked normal, which is the expected output
-- on a healthy system and is not an error.
