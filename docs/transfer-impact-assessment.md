# Transfer Impact Assessment (DRAFT: not valid until legal review)

**Status:** drafted from what the system actually does. Not legal advice. Must be
reviewed and approved by legal / the DPO before it is relied on. Sections marked
[FILL] need a decision or a document that only IMS can obtain.

**Transfer assessed:** content pasted by users for analysis or ideation, sent to
the Anthropic API in the United States.
**Mechanism relied on:** EU Standard Contractual Clauses.
**Date drafted:** 2026-07-27. **Review due:** [FILL: annually, or on any change
to the provider's terms or sub-processors.]

---

## 1. Why this assessment exists

The Court of Justice in *Schrems II* held that standard contractual clauses are
not sufficient on their own. The exporter must also assess whether the law of
the destination country prevents the importer from honouring them, and add
supplementary measures where it does. This document is that assessment.

Only one transfer is in scope. The database is in Ireland and nothing in it
leaves the EU. Vercel serves the application from an edge network but stores no
personal data. The transfer is the pasted content going to Anthropic in the US.

## 2. What is actually transferred

This section carries most of the weight of the assessment, because the answer is
unusually narrow.

| | |
|---|---|
| **Data transferred** | Free-text content the user pastes: an article, headline, transcript or story brief. Up to 20,000 characters. |
| **Identifiers transferred** | None. No name, no email, no Moodle identifier, no internal user id. The request carries only the text. |
| **Storage by this system** | None. The content is not written to the database at any point. Enforced by an automated test that fails if either AI route imports the database client or performs a write. |
| **Storage by the importer** | [FILL: confirm Anthropic's current retention position for API inputs, and whether a zero-retention arrangement is available.] |
| **Volume and frequency** | Bounded by a per-user daily cap (default 20 requests) and a per-user rate limit of 10 requests per minute. |
| **Data subjects** | Authorised Moodle users, i.e. journalists and media staff on IMS courses. |
| **Special category data** | Not intended. The tool is for editorial content. Users could paste material containing special category or third-party personal data, which is the residual risk addressed in section 5. |

The single most important fact for this assessment: **no identifier travels with
the content.** Anthropic receives text with no means of linking it to a person.
That does not remove it from scope, because the content itself may contain
personal data, but it substantially limits what the importer or any authority
compelling the importer could learn about an identified individual.

## 3. The importer and the legal environment

**Importer:** Anthropic PBC, United States.
**Role:** processor.
**Sub-processors:** [FILL: obtain the current list and subscribe to change
notifications. A new sub-processor in a new country changes this assessment.]

**Relevant US law.** The concern identified in *Schrems II* is US surveillance
law, principally FISA Section 702 and Executive Order 12333, which can compel
certain providers to disclose data and may limit the redress available to
non-US persons.

**Assessment of practical exposure.** [FILL: legal to confirm whether the
importer falls within the definition of an electronic communication service
provider for s702 purposes.] Regardless of that conclusion, the practical
exposure here is limited by what is transferred: transient, unstored by this
system, and carrying no identifier. A compelled disclosure would yield text
without any means of attributing it to a person through this system.

**Developments since *Schrems II*.** The EU-US Data Privacy Framework adequacy
decision took effect in July 2023 and introduced a redress mechanism. Where an
importer is certified under it, transfers may rely on adequacy instead of
standard contractual clauses. [FILL: check whether Anthropic is DPF-certified.
If it is, that is a stronger and simpler basis than clauses plus this
assessment, and should be preferred.]

## 4. Supplementary measures already in place

These were not adopted for transfer compliance. They exist because of how the
system was built, which makes them more reliable than measures bolted on.

- **Data minimisation at source.** Name and email are not collected at all, and
  the columns that once held them were dropped in migration 0005. A test fails if
  either the schema or any route reintroduces them.
- **No identifier in the transfer.** The request to Anthropic contains the text
  and nothing else.
- **No retention by the exporter.** Pasted content is never written to the
  database. This is enforced by a test that blocks the build, not by convention.
- **Encryption in transit.** TLS on all requests.
- **Volume limiting.** Per-user daily cap and per-minute rate limit bound how
  much content can be transferred.
- **Access control.** The tool is reachable only through an authenticated Moodle
  LTI launch. There is no public entry point.
- **Input ceiling.** 20,000 characters per request, which limits the size of any
  single disclosure.

## 5. Residual risk

**The main residual risk is what users choose to paste.** The system cannot
inspect content for personal or confidential material, and journalists working
on sensitive stories are a realistic category of user. If someone pastes an
unpublished investigation containing a source's details, that is transferred.

This is a behavioural risk, not a technical one, so the control has to be
behavioural too. Two measures:

1. **In-tool guidance** at the point of pasting, telling users the content is
   sent to an AI provider outside the EU and not to paste material that must not
   leave the EU or that identifies a confidential source.
2. **Course-level briefing** for the Moodle activity, so the expectation is set
   before use rather than at the moment of use.

**Assessment:** [FILL: legal to record whether the residual risk is acceptable
given the mechanism, the measures above, and the nature of the data.]

## 6. Conclusion and conditions

**Draft conclusion, subject to legal review.** The transfer can proceed on
standard contractual clauses, supported by the measures in section 4, provided:

- the clauses are in place through the executed data processing agreement;
- the in-tool guidance in section 5 is deployed;
- the retention position of the importer is confirmed and recorded in the
  privacy notice;
- the sub-processor list is obtained and change notifications enabled;
- an EU endpoint or zero-retention option is adopted if either becomes
  available, as either would materially reduce the exposure.

**Approved by:** [FILL: name, role, date.]

## 7. Review triggers

Reassess on any of the following, not only on the annual review:

- the importer changes its terms, retention position or sub-processors;
- an EU-region endpoint or zero-retention option becomes available;
- the tool begins transferring identifiers alongside content;
- a court or supervisory authority materially changes the position on US
  transfers;
- the tool is adopted for a programme whose contract restricts non-EU
  processing.
