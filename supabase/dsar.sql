-- Data Subject Access Request (DSAR) procedure.
-- Run in the Supabase SQL Editor. Replace the placeholder with the subject's
-- Moodle user id. This is a documented manual procedure, not a scheduled job.
--
-- Scope note: this system holds no email or name (removed in migration 0005).
-- The only identifier stored is moodle_user_id, which is issued by Moodle.
-- Content pasted for analysis or ideation is sent to the Anthropic API and is
-- never written to the database, so it cannot appear in an export.

-- 1) EXPORT: identity record.
select id, moodle_user_id, created_at
from users
where moodle_user_id = 'REPLACE_MOODLE_USER_ID';

-- 1) EXPORT: current-day raw usage (older rows are aggregated, see below).
select us.id, us.used_at, us.feature
from usage us
join users u on u.id = us.user_id
where u.moodle_user_id = 'REPLACE_MOODLE_USER_ID'
order by us.used_at;

-- 1) EXPORT: historical usage, held only as per-day counts per feature.
select ud.day, ud.feature, ud.count
from usage_daily ud
join users u on u.id = ud.user_id
where u.moodle_user_id = 'REPLACE_MOODLE_USER_ID'
order by ud.day;

-- 2) ERASURE. DESTRUCTIVE and irreversible. Confirm the id with the export
--    above first. Deleting the user cascades to both usage and usage_daily
--    (both reference users(id) on delete cascade).
--    Uncomment to run:
-- delete from users where moodle_user_id = 'REPLACE_MOODLE_USER_ID';
