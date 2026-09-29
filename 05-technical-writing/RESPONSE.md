# Editorial choices and open questions

## Editorial choices

- Treated the current implementation note as authoritative for signature verification: HMAC-SHA-256 covers `X-Orbit-Timestamp`, a literal period, and the raw body bytes. Explicitly identified the older parsed-JSON instruction as stale because it contradicts that implementation note.
- Separated documented behavior (“Guarantee”) from integration guidance (“Recommendation”), particularly around fast acknowledgment, durable queuing, idempotency, logging, and key handling.
- Interpreted “five retries after initial try” plus the five listed intervals as up to six total delivery attempts, and retained “roughly” because the schedule is approximate.
- Described `X-Orbit-Event` as a deduplication key while noting that UI replay retains the same ID. This makes the operational consequence visible without implying that a replay creates a distinct event.
- Included a Node.js/Express verification example that preserves the raw request body and compares equal-length digest buffers with a timing-safe function. It demonstrates signature verification without inventing timestamp expiry validation.
- Called out that the documented HMAC does not include the event ID or type headers, so their authentication status needs product confirmation; the guide limits their use to routing and duplicate suppression until clarified.
- Avoided claiming that Orbit follows redirects, retries `3xx`, has a particular timeout retry cadence, or provides payload sequence fields.

## Product questions to resolve

1. Does Orbit follow endpoint redirects? The notes explicitly say this is unconfirmed. Until answered, integrations should configure the final URL directly.
2. Is there an expected timestamp freshness/replay window, and is the timestamp generated per event or per delivery attempt? The timestamp is signed, but no validation window or regeneration rule is documented.
3. What happens for a `3xx` response? Retry rules list certain status codes and say not to retry other `4xx`, leaving `3xx` unspecified.
4. Is `X-Orbit-Event` globally unique, and does manual replay intentionally preserve the ID so receiver-side deduplication suppresses it? The seven-day replay window and stable replay ID are documented, but uniqueness scope and intended reprocessing behavior are not.
5. Are the listed retry intervals measured from the preceding attempt, and does retrying stop immediately after the fifth retry fails? The notes give approximate intervals and a retry count, but not exact clock semantics or post-exhaustion status visibility.
6. Should `X-Orbit-Event` and `X-Orbit-Type` be included in the authenticated signing input, or are they intentionally unsigned? The documented formula signs the timestamp and raw body only.
