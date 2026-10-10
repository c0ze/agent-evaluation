# Editorial choices and unresolved questions

## Editorial choices

- Organized the customer guide around authentication, acknowledgment and retries, duplicate handling, rotation, and operations, with a troubleshooting table for common failures.
- Used **Contract**, **Recommendation**, and **Product confirmation** labels to distinguish documented service behavior from receiver advice and unresolved details. Approximate timings, usual ordering, and security's redirect expectation are explicitly not guarantees.
- Selected `timestamp + dot + unchanged raw body` for the verifier because the notes explicitly identify it as the current implementation. Called out both the older parsed-JSON instruction and the abbreviated raw-bytes-only note as conflicting, and requested confirmation of the published signing contract. Did not silently normalize JSON or timestamps.
- Chose a small Python standard-library example to avoid dependencies and framework-specific body handling. It validates the signature shape, compares decoded digests in constant time, and supports both rotation keys without short-circuiting the key comparisons. It receives key bytes rather than inventing the UI secret's encoding.
- Kept timestamp freshness outside the minimal verifier. A five-minute window is only an example recommendation and is conditional on confirmation of retry/replay signing behavior, not an Orbit requirement.
- Explained that the stated signing formula excludes event ID and event type headers. The source recommends neither an authenticated-header mechanism nor a payload schema, so neither was invented.
- Described five automatic retries after the initial attempt as at most six attempts in that sequence. Did not promise ultimate delivery, exactly-once processing, strict ordering, exact retry execution times, or an exhaustion deadline.
- Recommended durable acceptance before acknowledgment, atomic deduplication, and idempotent side effects. The seven-day replay period informs retention advice, with a margin and explicit uncertainty about its starting point and ID scope.
- Included every stated request detail, the 10-second deadline, ignored response body, retryable and nonretryable statuses, replay identity, rotation overlap, payload limit, User-Agent, and sensitive-logging warning. Redirect advice uses a direct endpoint while confirmation remains pending.

## Questions for product confirmation

1. Is HMAC-SHA-256 over the exact timestamp header bytes, a literal dot, and the raw body the authoritative signing contract? Can the contradictory legacy documentation be retired? What is the displayed secret's encoding and conversion to key bytes?
2. Are timestamps and signatures regenerated for each automatic retry and manual replay? Is there a supported freshness window or clock-skew allowance?
3. Are redirects followed? Security expects they are not, but the implementation owner has not confirmed this. How are `3xx` responses classified for retry purposes?
4. Are the five listed retry timings delays between attempts or offsets from the initial attempt? Is there jitter, and is `Retry-After` honored? What happens after the final retry? The guide makes no claim about any unlisted scheduling or failure policy.
5. When does the 24-hour rotation overlap start, and which key signs requests during it? Does automatic removal of the previous key occur at a defined time?
6. From which point is the seven-day replay window measured? What is the uniqueness scope of event IDs, and what retention margin covers in-flight deliveries at the replay boundary?
7. Are event ID and type also available within authenticated payload data, or otherwise bound to the signature? What guarantees support trusting these header values for routing and deduplication?

These questions remain open because `SOURCE_NOTES.md` does not establish their answers. The deliverables document the uncertainties without adding service behavior.
