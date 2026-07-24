-- 0007_usage_daily_retention.sql
--
-- Sets the retention period for usage_daily and enables the purge.
--
-- usage_daily carries user_id, so it remains personal data even though it is
-- only per-day, per-feature counts. Migration 0005 created the table and left
-- the purge job commented out because the period was a policy decision rather
-- than an engineering one. The decision is now recorded: SIX MONTHS.
--
-- What that means in practice: on any given day the system holds the current
-- day's raw usage rows plus roughly 183 days of per-day counts per feature.
-- Anything older is deleted, so the answer to "how long do you keep it" is
-- six months and the retention claim in the privacy notice is enforced by the
-- database rather than by intention.
--
-- Changing the period later: re-run cron.schedule with the same job name
-- ('purge-usage-daily') and a different interval. Re-scheduling under an
-- existing name updates the job rather than creating a second one. Update
-- docs/runbook.md and the privacy notice at the same time, or the documented
-- period and the enforced period will drift apart.
--
-- Note this is a hard delete with no aggregation behind it. Unlike the raw
-- usage rows, which are rolled up into usage_daily before being removed,
-- counts older than six months are simply gone. That is the intent: the
-- purpose these rows serve is per-user feature analysis, which does not need
-- an unbounded history.

create extension if not exists pg_cron;

-- Daily at 04:30, deliberately after the 03:00 rollup and the 04:00
-- security-event purge, so the three retention jobs do not overlap.
select cron.schedule(
  'purge-usage-daily',
  '30 4 * * *',
  $$delete from usage_daily where day < current_date - interval '6 months'$$
);

-- Verify after applying:
--   select jobname, schedule, active from cron.job where jobname = 'purge-usage-daily';
--
-- pg_cron schedules live in the cron schema and are NOT captured by a database
-- dump, so this must be re-applied after any restore or project move. The
-- daily cron-check workflow asserts that this job exists and is active, so a
-- silent failure becomes an email rather than a quiet over-retention.
