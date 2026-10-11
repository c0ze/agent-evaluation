# RESPONSE.md — editorial notes for WEBHOOKS.md

## Editorial choices

1. **Conflicting signature schemes.** Old docs say HMAC over parsed JSON; the notes say the current implementation signs `X-Orbit-Timestamp` + `.` + raw body. I treated the current implementation as authoritative (conservative: the notes call the old docs "probably stale" and describe it as an old system), documented the conflict in a callout instead of silently fixing it, and framed "legacy events still in flight" as an open question rather than asserting none exist.
2. **Timeout vs. retry overlap.** The notes give both a 10-second receiver deadline and "retry on timeout." I resolved these by treating the 10-second deadline as the delivery timeout, so a non-responsive endpoint falls under the documented retry conditions, and stated both facts in one coherent section rather than inventing separate parameters.
3. **Guarantees vs. recommendations.** I added an explicit "Guaranteed vs. recommended" paragraph in the delivery section and consistently phrased order ("usually follows creation"), idempotency, rotation, and logging guidance as recommendations. Things stated as guarantees: retry conditions, retry count (5), approximate schedule, 10-second window, any-2xx acceptance, ignored response body, two-secret 24-hour rotation overlap, 7-day replay with same event ID, 512 KiB payload cap, and the retry/non-retry status lists.
4. **Ordering.** Documented as "not guaranteed" per the notes, with dedupe-by-event-ID as the recommendation, since both retries and replay produce duplicates.
5. **Redirects.** Left unconfirmed. Per the task's instruction not to invent behavior, I did not state whether 3xx redirects are followed; I gave conservative integrator advice (assume not followed, register direct URLs) and listed it first in "Open questions."
6. **Timestamp replay tolerance.** The notes never define one. I did not invent a window or claim the service enforces one; I presented choosing a tolerance as a client-side decision and flagged it as unresolved.
7. **Verification example.** Kept to a single ~6-line Python function covering the exact signing string, `v1=` prefix, constant-time comparison, and the raw-body requirement. Added a warning against logging secrets/payloads per the notes.
8. **Word count.** 956 words, inside the 700–1,100 target. Each required element (verification example, delivery/retry semantics, ordering/idempotency, rotation, operational advice, troubleshooting table) has its own section, so the count includes the table and code block markup.

## Unresolved questions for product

1. Does webhook delivery follow 3xx redirects? Security believes it should not; the implementation owner has not confirmed.
2. Is there any service-side enforcement of `X-Orbit-Timestamp` freshness, and is there a documented tolerance integrators should use?
3. Are any events signed with the old parsed-JSON scheme still in flight or replayable, and should the old docs be corrected or annotated?
4. Is a replayed event re-signed (new timestamp, current secret) or is the original signature resent? This determines whether strict timestamp checks break replay verification.
5. Is the 512 KiB payload cap enforced by the service (events above it are rejected at creation) or only a sizing expectation for receivers?
6. Is the 24-hour rotation overlap fixed, and what exactly happens to verifications using the previous secret after it expires — hard rejection?
7. Is replay available to all customers via the dashboard, or only through support? This affects how I phrase the "event never arrives" troubleshooting row.
