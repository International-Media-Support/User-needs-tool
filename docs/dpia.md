# Data Protection Impact Assessment (DPIA): skeleton

This skeleton is pre-filled with what is known from the system. Risk ratings and
sign-off need an owner and, where relevant, the DPO.

## 0. Is a DPIA required?
Article 35 requires a DPIA where processing is likely to result in a high risk to
individuals. This processing is limited: a pseudonymous identifier, usage counts,
no special category data, no profiling, no automated decisions with legal or
similarly significant effects, and a small defined user group of authorised
Moodle users. On that basis a full DPIA may not be strictly required, and this
document may serve better as a proportionate record of the assessment.
[FILL: the DPO confirms whether a full DPIA is required or whether this record
suffices.]

## 1. The processing
The User Needs Tool scores and generates story ideas against the BBC User Needs
Model. It is launched from Moodle via LTI 1.3. It stores the Moodle user id only, plus
usage records, which are reduced to per-day counts per feature after the day
ends. Name and email are not collected. Content pasted for analysis is sent to
the Anthropic API and is not stored.

## 2. Necessity and proportionality
The two purposes are enforcing the daily usage limit and per-user feature
analysis. Data was reviewed against those purposes: email and name served
neither and have been removed, leaving a pseudonymous record. Detailed usage
timestamps are needed only for the current day's limit, so older rows are
reduced to counts. Pasted content is not retained. Access is limited to authorised Moodle users. [FILL: confirm the
processing is necessary for the stated purpose and no less intrusive option
exists.]

## 3. Data flows
Moodle (LTI authentication) -> this app (Vercel) -> Supabase (moodle_user_id and
usage counts) and Anthropic (pasted content, processed in the US, not stored by
this tool). See the runbook data inventory.

## 4. Risks to individuals
Candidate risks identified from the system. Likelihood and severity ratings, and
any further risks, are for the assessor.

| # | Risk | Likelihood | Severity | Notes |
|---|------|-----------|----------|-------|
| 1 | Content pasted by users is transferred to and processed by a US provider | [FILL] | [FILL] | The most sensitive data the system touches. Users may paste unpublished or personal material. Transferred under Standard Contractual Clauses; see docs/transfer-impact-assessment.md. Mitigated by sending no identifier with the content, not storing it, TLS, volume caps and in-tool guidance. Residual risk is what users choose to paste, addressed behaviourally. |
| 2 | Unauthorised access to the database | [FILL] | [FILL] | Pseudonymous only: moodle_user_id and usage counts. No name or email held. |
| 3 | Re-identification of a user from moodle_user_id | [FILL] | [FILL] | Requires access to Moodle to resolve the identifier. |
| 4 | LTI signing key compromise leading to impersonation | [FILL] | [FILL] | Key held server-side only; rotation procedure documented. |
| 5 | Loss of availability | [FILL] | [FILL] | Daily encrypted backup with 30-day retention, restorability proved weekly. Most data self-heals on the next LTI launch; usage_daily is the only irreplaceable data. See the DR plan. |
| 6 | Retention failing silently (jobs stopped) leading to over-retention | [FILL] | [FILL] | Scheduled jobs are not restored by a dump; explicit check documented. |

## 5. Mitigations already in place
- Least-privilege access; service-role key server-side only; RLS on all tables.
- HTTPS with HSTS; input size caps; per-route rate limiting.
- LTI signing key kept server-side; JWKS publishes the public key only.
- Automated purging of short-lived operational data.
- Data minimisation applied against stated purposes: no name or email held;
  usage detail reduced to daily counts.

## 6. Outstanding mitigations
- Lawful basis recorded. [FILL]
- Privacy notice completed and published. [FILL]
- DPAs executed with Supabase, Vercel, Anthropic and Sentry. [FILL]
- Sentry (error tracking) added as a processor. EU data region. Receives
  exception type, message, stack trace, HTTP method, URL path and the internal
  pseudonymous user UUID. Configured so it cannot receive request bodies,
  authorisation headers, cookies, query strings or the Moodle user identifier;
  Session Replay and performance tracing are disabled. Enforced by tests in
  tests/security.test.ts rather than by configuration alone. Retention period
  as configured in the Sentry project: [FILL].
- Transfer basis for the US processing documented: Standard Contractual Clauses,
  with a transfer impact assessment drafted at docs/transfer-impact-assessment.md.
  [FILL: legal review and sign-off of that assessment.]
- Retention period set for usage_daily (six months) and the purge enabled in
  migration 0007. Done.
- Backups in place: daily encrypted dump, weekly restore verification. Move to Supabase Pro for managed backups and PITR. [FILL: sign-off]

## 7. Sign-off
- Prepared by: [FILL]. Date: [FILL].
- DPO / approver: [FILL]. Date: [FILL].
