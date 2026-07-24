# Release process

How a change reaches production, and what has to be true before it does.

## 1. Branches

- `main` is the production branch. Every push to `main` deploys.
- Work happens on a short-lived branch and reaches `main` by pull request.
- Direct pushes to `main` are possible today because branch protection is not
  yet configured. Section 5 records what to turn on.

## 2. What gates a change

Two independent gates, and both must be green.

**CI (`.github/workflows/ci.yml`)**, on every push and pull request to `main`:

| Step | Blocking | Notes |
|---|---|---|
| `npm run lint` | No | `continue-on-error`; the build gate below is the real one |
| `npm test` | **Yes** | Vitest structural tests; a failure is a real regression |
| `npm audit --audit-level=high` | No | Reporting only |

**Build**: ESLint runs during `next build`, so a lint *error* fails the deploy.
`@typescript-eslint/no-explicit-any` is set to `warn` because of ten known
instances in `app/page.tsx`, so those surface without blocking.

**CodeQL (`.github/workflows/codeql.yml`)** runs on the same triggers plus
weekly. Findings appear in the repository security tab.

The tests are not incidental. They encode claims made in the privacy notice,
the DPIA and the compliance documentation: that pasted content is never
persisted, that no route stores an email or name, that the base schema does not
declare those columns, that the logger cannot log tokens or content, that
`.env.example` is complete, and that `restore-verify.yml` asserts every table
and function the migrations create. If one fails, a compliance statement has
probably become untrue. Fix the cause, not the test.

## 3. Releasing

1. Open a pull request. Wait for CI.
2. Merge to `main`. Vercel builds and deploys automatically.
3. Check the deployment succeeded in the Vercel dashboard.
4. If the change touched the database, apply the migration in the Supabase SQL
   Editor and confirm the pg_cron jobs are still active
   (`select jobname, active from cron.job;`). Scheduled jobs do not travel with
   a dump and are not applied by the deploy.
5. The daily smoke test (`smoke.yml`) independently verifies the running system
   the next morning. To verify immediately, run it via `workflow_dispatch`.

## 4. Rollback

1. Vercel dashboard, Deployments, find the last known-good deployment, and use
   "Promote to Production". This is a pointer change and takes effect in
   seconds; it does not rebuild.
2. Confirm by running `smoke.yml` via `workflow_dispatch`.
3. A code rollback does **not** roll back a database migration. If the bad
   release included one, write and apply a forward migration that reverses it.
   Never edit an applied migration file.
4. Record what happened and why in the incident-response log.

**Untested.** This procedure is documented but has not been rehearsed. Rehearse
it once against a deliberately broken deployment and record the elapsed time;
that number is also the input to the RTO in the disaster recovery plan.

## 5. Branch protection (not yet configured)

Settings > Branches > Add rule, on `main`:

- Require a pull request before merging.
- Require status checks to pass: the `checks` job from CI, and CodeQL.
- Require branches to be up to date before merging.
- Do not allow bypassing the above.
- Block force pushes and deletions.

This needs organisation-owner rights on the repository. It costs nothing and
needs no plan change; it is outstanding for effort reasons only.

## 6. Release checklist

- [ ] CI green on the pull request
- [ ] Migration written as a new numbered file, never an edit to an existing one
- [ ] `.env.example` updated if a new environment variable was introduced
- [ ] New variable added in the Vercel project settings before merge
- [ ] Migration applied and cron jobs verified after deploy
- [ ] `smoke.yml` run if the change touched auth, sessions or the API routes
- [ ] Documentation updated where the change alters a compliance claim
