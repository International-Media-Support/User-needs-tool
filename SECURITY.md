# Security Policy

## Reporting a vulnerability

If you believe you have found a security vulnerability in the User Needs Tool,
please report it privately. Do not open a public issue, and do not include
proof-of-concept details in any public channel.

- Preferred: use GitHub's private vulnerability reporting on this repository
  (Security tab > Report a vulnerability).
- Alternatively, email: [FILL: security contact address].

Please include what you found, how to reproduce it, and the impact you believe
it has. We will acknowledge within [FILL: target, e.g. 5 working days] and keep
you updated until it is resolved.

## Scope

In scope: this application, its API routes, the LTI 1.3 launch and session
handling, and the database schema and policies in `supabase/`.

Out of scope: vulnerabilities in Vercel, Supabase, Moodle or the Anthropic API
themselves. Please report those to the respective vendor.

## What this system holds

Reports are easier to triage with this context. The database stores a Moodle
user identifier and usage counts. It holds no names or email addresses. Content
submitted for analysis is sent to the Anthropic API and is not stored.

## Handling

Confirmed reports are handled through the incident-response runbook in
`docs/incident-response.md`, which covers containment, key rotation, session
invalidation and, where personal data is involved, notification of the data
protection officer.
