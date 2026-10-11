# RESPONSE.md — Three riskiest assumptions

1. **Field-level last-write-wins is sufficient to protect supervisor edits.**
   The plan assumes supervisors and inspectors mostly edit *different* fields, so
   merging only the client's dirty fields is safe. If supervisors routinely edit
   the *same* fields during an inspector's offline window, automatic LWW will
   silently supersede one party's work and we will need a manual-conflict
   review UI — the very thing product explicitly ruled out. This is the most
   consequential assumption because getting it wrong adds an unbudgeted
   collaborative-editing feature.

2. **A successful sync reliably reaches the tablet before the 24-hour clock
   expires.** The 24-hour purge starts only once the device learns of server
   acceptance. If a tablet stays offline past the deadline, customer data remains
   on-device beyond the regulatory window — a compliance failure we cannot detect
   until the device reconnects. The risk is that "intermittent connectivity"
   occasionally means "days offline," which would violate the requirement the
   whole plan is designed to satisfy.

3. **The existing REST API and integer versioning can be extended in place.**
   The plan assumes we can add a dedupe key, field-level merge, and resumable
   uploads without re-architecting the server. If the current API has no notion
   of per-field ownership, timestamps, or idempotency tokens, the server change
   is larger than estimated, and the pilot timeline — not the product — becomes
   the real constraint.