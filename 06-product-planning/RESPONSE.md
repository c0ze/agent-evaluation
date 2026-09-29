# Response: the three riskiest assumptions

`PLAN.md` covers the full plan for offline inspection work: assumptions A1–A12,
scope, decisions D1–D11 with recommendations, user flow, SQLite model, sync
protocol, conflict policy, attachments, security, migration, observability,
rollout, rollback, testing and milestones M0–M9. The plan rests most heavily on
the three assumptions below. Each one must be validated in M0, before any build
work is committed.

## 1. The 24-hour removal rule can be met by purging on server receipt (A1, D3)

**Assumption.** Deleting local customer data as soon as the server confirms full
receipt of a submission satisfies the rule, with a local timer as a backstop. The
rule does not require the device to prove deletion within 24 hours of acceptance.

**Why it is risky.** Acceptance happens on the server, often while the tablet is
offline. A device that goes back underground right after submitting cannot learn
about the acceptance in time. The design only works if purging *before*
acceptance is allowed. It also depends on how "local customer data" is defined:
logs, OS backups and stubs holding only an ID might count. And it depends on what
happens when the rule conflicts with the other requirement of never discarding
unsynced field work. If the interpretation is wrong, this is a regulatory breach
on every such device, not just a bug.

**Validate by** getting a written interpretation from compliance/legal in M0, and
testing a device that goes offline immediately after submitting in M5. A purge
receipt report on the server makes compliance measurable.

## 2. Forms can be merged field by field, and same-field conflicts are rare (A2, A8, D2)

**Assumption.** Form templates have stable field IDs, and repeating sections can
be given stable row IDs. Supervisors seldom edit the same field an inspector is
editing offline. Given that, a per-category rule is enough ("inspector wins on
fields captured on site, supervisor wins on review and status fields, the losing
value is kept and flagged").

**Why it is risky.** The whole conflict policy, and the promise of "no full
collaborative editor", depend on it. If records are stored as positional arrays
or free-text blobs, field-level merge is not safe without a data migration. If
concurrent same-field edits are common, a flag on the web will not be enough.
Supervisors would need a real review queue, and the pilot scope would grow.

**Validate by** auditing the template and record schema, and measuring from
production edit history how often the web and mobile clients write to the same
record, and which fields.

## 3. The server can add an idempotent field-level changes API without disrupting existing clients (A3, D1)

**Assumption.** A new batch `/changes` endpoint can be added next to the existing
REST API with integer versions. The endpoint handles op-ID deduplication, merge on
the server and audit writes. The web editor and other clients keep working
unchanged, and all of them write through a shared audit path.

**Why it is risky.** Connectivity is intermittent, so "committed but the response
was lost" is the normal case, not an edge case. A record-level `PUT` with an
integer version cannot tell a lost acknowledgement apart from a real conflict. It
also cannot record device time or operation IDs for the audit history the
regulation requires. If the server cannot change (ownership, capacity, or the web
editor bypassing the version or audit), the fallback is rebasing on the client.
That leaves weaker duplicate protection and an incomplete audit trail, which
threatens both the "no lost work" goal and compliance.

**Validate by** a server codebase and ownership review in M0, and by confirming
that every existing write path increments the version and can emit audit events.
