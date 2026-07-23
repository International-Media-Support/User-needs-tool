# User Needs Tool: Incident Response Runbook

## Contacts and roles

- Incident lead: User Needs Tool IT Lead .
- Data protection officer / privacy contact: User Needs Tool IT Lead.
- Provider support: Vercel, Supabase, Anthropic dashboards.

## Where the risk actually sits

The database holds no names or email addresses: just moodle_user_id and usage
counts. The higher-consequence exposures are now:

1. **Content users paste into the tool.** It is sent to Anthropic and is not
   stored here, but users may paste unpublished, embargoed or personal material.
   This is the most sensitive data the system touches.
2. **The LTI private key**, which underpins all authentication.
3. **The Anthropic API key**, which carries direct financial exposure.

The database itself is now a comparatively low-value target.

## Severities

- SEV1: key compromise, exposure of pasted content, or full outage.
- SEV2: partial outage, degraded feature, or database exposure (pseudonymous).
- SEV3: minor issue, no user impact.

## Detection

- Vercel function logs and error rates.
- Anthropic usage or spend anomalies.
- User or Moodle admin reports.
- Scheduled-job checks (see "Retention or rollup stopped" below).
- Error tracking and uptime alerts are not yet configured; detection today
  is largely manual and reactive. This is a known gap.

## Scenario playbooks

### Signing-key compromise (LTI private key)
1. Generate a new key (`scripts/generate-lti-key.mjs`).
2. Update LTI_PRIVATE_KEY in Vercel and redeploy.
3. Confirm the JWKS endpoint serves the new public key. Moodle collects it from
   the JWKS URL, so no manual exchange is needed.
4. Clear `lti_sessions` to invalidate any session issued during the exposure
   window.
5. Treat launches during the window as suspect.

### Supabase service-role key compromise
1. Rotate the key in the Supabase dashboard.
2. Update SUPABASE_SERVICE_ROLE_KEY in Vercel and redeploy.
3. Update the SUPABASE_DB_URL repository secret if the database password changed,
   or the keep-alive workflow will fail silently.
4. Review logs for misuse during the window.

### Anthropic API key compromise
1. Revoke the key in the Anthropic console and issue a new one.
2. Update ANTHROPIC_API_KEY in Vercel and redeploy.
3. Check usage and spend for the exposure window. Unlike the other keys, this one
   carries direct financial exposure, so treat unexpected spend as the primary
   detection signal.

### Session compromise
1. Invalidate active sessions: `delete from lti_sessions;`
2. Users re-launch from Moodle to obtain fresh sessions.

### Sensitive content pasted into the tool
1. Establish what was pasted and by whom, if known.
2. The tool does not store pasted content, so there is nothing to purge here.
   The copy that matters sits with Anthropic under their retention terms.
3. Escalate to the DPO if the content contained personal or confidential data.
4. Consider reminding users, via Moodle, what is appropriate to paste.

### Personal data breach (database)
1. Contain: rotate keys, revoke access, isolate.
2. Notify the DPO. Under EU GDPR a notifiable breach must reach the
   supervisory authority within 72 hours.
3. Note for the assessment: the database holds moodle_user_id and usage counts,
   with no name or email. This is pseudonymous data, which may affect whether the
   breach meets the risk threshold for notification. The DPO makes this
   call, not this runbook.
4. Record scope, data affected, and remediation.

### Retention or rollup stopped
Silent failure, so it needs an explicit check rather than an alert.
1. Symptom: the `usage` table holds more than the current day, or expired
   sessions accumulate.
2. Check: `select jobname, schedule, active from cron.job;`
3. If jobs are missing (common after a restore or project move), re-run
   migrations 0004 and 0005.
4. If jobs exist but are failing, inspect `cron.job_run_details`.

### Outage
1. If deploy-related, roll back in Vercel.
2. If provider-related, monitor the provider status pages and communicate.

## Communication

- User Needs Tool IT Lead informs Moodle admins and affected users.

## Post-incident

- Write a short review: timeline, cause, fix, prevention.
- Feed changes back into this runbook, the operational runbook and the DR plan.
