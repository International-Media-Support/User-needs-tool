-- Data Subject Access Request (DSAR) procedure.
-- Run in the Supabase SQL Editor. Replace the placeholder with the subject's
-- Moodle user id. These are a documented manual procedure, not scheduled jobs.
--
-- Note: content pasted for analysis or ideation is sent to the Anthropic API
-- and is never written to the database, so it does not appear in an export.

-- 1) EXPORT: identity record.
select id, moodle_user_id, email, name, created_at
from users
where moodle_user_id = 'REPLACE_MOODLE_USER_ID';

-- 1) EXPORT: usage history for the same subject.
select us.id, us.used_at, us.feature
from usage us
join users u on u.id = us.user_id
where u.moodle_user_id = 'REPLACE_MOODLE_USER_ID'
order by us.used_at;

-- 2) ERASURE. DESTRUCTIVE and irreversible. Confirm the id with the export
--    above first. Deleting the user cascades to their usage rows
--    (usage.user_id references users(id) on delete cascade).
--    Uncomment to run:
-- delete from users where moodle_user_id = 'REPLACE_MOODLE_USER_ID';
