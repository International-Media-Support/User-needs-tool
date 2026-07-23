# User Needs Tool: Disaster Recovery Plan

## 0. What is actually at risk

Worth stating plainly, because it sets sensible targets. After the data
minimisation in migration 0005, most of this database rebuilds itself:

| Data          | If lost                                                      |
|---------------|--------------------------------------------------------------|
| users         | Recreated automatically on each user's next LTI launch.       |
| usage         | Current day only. Worst case, users get a fresh daily quota.  |
| lti_sessions, lti_launch_state, lti_handoff, rate_limit | Ephemeral by design. Users re-launch from Moodle. |
| usage_daily   | **The only irreplaceable data.** Historical feature counts cannot be reconstructed. |

So the real question this plan answers is: how much feature-usage history are we
willing to lose, and how fast can we get the service back up? It is not a
question about losing user data, because there is very little of it and it
regenerates.

Service availability depends far more on the code, environment variables and the
Moodle LTI registration than on the database contents.

## Objectives

- RTO (target time to restore service): [FILL, e.g. 4 hours].
- RPO (acceptable loss of usage_daily history): [FILL, e.g. 24 hours].

Set these against section 0. Validate them with a restore test (section 6).

## 1. Current position

A daily encrypted dump now runs via the `backup.yml` workflow, retained for 30
days as a workflow artifact. That puts the effective RPO at roughly 24 hours,
bounded by the daily schedule, and the retention window at 30 days.

Caveats worth holding in mind:
- It is an interim measure. Supabase Pro provides automated daily backups and
  point-in-time recovery, which is the proper solution.
- Recovery depends entirely on `BACKUP_PASSPHRASE`. If that is lost, every
  artifact is unrecoverable. Store it separately from the repository.
- Artifacts expire after 30 days, so there is no long-term archive.

## 2. What can fail and the response

- App or deploy broken: roll back to the previous Vercel deployment.
- Database lost or corrupted: restore per section 4.
- Scheduled jobs stopped (retention or rollup not running): re-apply migrations
  0004 and 0005, see section 5.
- Provider outage: wait it out, or rebuild elsewhere per section 4.
- Key compromise: see the incident-response runbook.

## 3. Backups

- Now (free, in place): the `backup.yml` workflow runs a daily pg_dump,
  encrypts it with AES256 before it is written anywhere, and uploads it as a
  30-day artifact. The dump no longer contains names or email addresses
  (removed in 0005), but it does contain moodle_user_id and usage history, which
  remain personal data in pseudonymous form. This repository is public and
  artifacts on public repositories are downloadable by anyone, so the encryption
  is what makes this acceptable, not an optional extra.
- To restore: decrypt with `gpg --batch --decrypt --passphrase "<passphrase>"`,
  then apply with psql. See the header of `.github/workflows/backup.yml`.
- Recommended: move the database to Supabase Pro for automated daily backups and
  point-in-time recovery. This removes the manual step and is the reliable path.
- [FILL: chosen backup method, location, schedule and retention.]

## 4. Restore procedure

1. Create or select the target Supabase project. If new, choose the same region.
2. Enable the pg_cron extension (Database > Extensions).
3. Apply `supabase/schema.sql`, then `supabase/migrations/*` in numerical order.
4. Restore data from the latest dump: download the newest `db-backup` artifact,
   decrypt it with BACKUP_PASSPHRASE, and apply it with psql.
5. Re-run the scheduled-job setup and verify it (section 5). Do not assume the
   restore brought the jobs back.
6. Update NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel, and
   the SUPABASE_DB_URL repository secret if the keep-alive workflow is in use.
7. Smoke test: complete an LTI launch from Moodle, run one analyse call, and
   confirm the usage counter increments.

## 5. Scheduled jobs are not part of a restore

pg_cron jobs live in the `cron` schema, not in `public`. Extension-owned tables
are generally not included in a dump, and Supabase's own dump tooling excludes
internal schemas. Assume a restore brings back tables and **loses every
scheduled job**, silently. Nothing will error; retention and rollup simply stop.

After any restore or project move:

1. Re-run migrations 0004 and 0005, which re-create the schedules
   (`cron.schedule` with an existing job name updates rather than duplicates).
2. Verify: `select jobname, schedule, active from cron.job;`
3. Expect: purge-lti-sessions, purge-lti-launch-state, purge-lti-handoff,
   purge-rate-limit, rollup-usage (plus purge-usage-daily if enabled).

This check is also worth running periodically, not only after a restore.

## 6. Full rebuild (new hosting)

1. Deploy the app from GitHub to the target host.
2. Recreate all environment variables (runbook section 3).
3. Stand up the database per section 4.
4. If the domain changed, re-register the tool's JWKS URL, launch URL and
   redirect URIs with Moodle. Note the JWKS endpoint derives the public key from
   LTI_PRIVATE_KEY, so if that key is regenerated Moodle picks up the new public
   key from the JWKS URL without a manual key exchange.

## 7. Testing

- Run a restore test into a scratch project [FILL: cadence, e.g. quarterly].
- Record the actual elapsed time against the RTO, and confirm the cron job check
  in section 5 passes.
- Update this plan after each test.
