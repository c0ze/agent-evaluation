# Editorial choices and unresolved questions

## Editorial choices

- Produced `WEBHOOKS.md` as a customer-facing integration guide using only `SOURCE_NOTES.md`. No network research or undocumented product behavior was added.
- Separated documented behavior, receiver recommendations, and items requiring product confirmation. In particular, approximate retry timings, usual ordering, and finite retries are not presented as timing, ordering, or eventual-delivery guarantees.
- Resolved the signing contradiction in favor of the explicit current implementation: timestamp text, a literal dot, and the raw body. Called out both the older parsed-JSON instruction and the incomplete raw-body-only description instead of silently reconciling them.
- Used a small standard-library Python verifier with strict timestamp/signature syntax, constant-time digest comparison, and support for both rotation keys. It checks every supplied key and returns false for an empty key set. Framework-specific body access, secret loading, and header validation remain integration responsibilities.
- Did not invent a timestamp tolerance. The example explicitly does not provide freshness protection, because retry/replay timestamp generation is unspecified. Called out that the documented signature does not cover the event ID or type headers.
- Described five retries after the first attempt as six attempts within one automatic sequence. Kept manual replay separate and preserved the approximate schedule without choosing an undocumented interpretation of its timing.
- Connected acknowledgment to durable acceptance and idempotency to persistent, coordinated processing. Explained that replay retains the event ID and should not duplicate completed business effects.
- Treated a directly reachable endpoint as a recommendation while leaving redirect behavior unresolved. Included payload limits, key storage and rollout, safe logging, monitoring, recovery, and a troubleshooting table.

## Questions for product and implementation owners

1. **Authoritative signing contract:** Can the current timestamp-plus-dot-plus-raw-body format be formally confirmed and the stale parsed-JSON documentation removed? How is the displayed secret converted to key bytes? Can the service provide an official test vector?
2. **Timestamp and replay protection:** Is the timestamp created per attempt, per event, or per manual replay? What age and clock skew should receivers accept? How should a freshness policy accommodate legitimate retries and seven-day replays?
3. **Header integrity and parsing:** How are event ID and event type authenticated or bound to signed content? Are duplicate header fields or multiple signature values possible, and what parsing rules apply?
4. **Retry timing:** Are the listed times delays between attempts or offsets from the first attempt? Is there jitter, and does `Retry-After` affect `429` or other responses? What happens after exhaustion, and how is that outcome exposed to customers?
5. **Redirects:** Are any `3xx` responses followed or retried? Security's expectation is not sufficient to document implementation behavior as a guarantee.
6. **Rotation:** What starts the 24-hour overlap, when does outbound signing switch keys, and which key signs retries or replays of older events? What happens if another rotation is initiated during the overlap?
7. **Event identity and recovery windows:** What is the event ID uniqueness scope? When does the seven-day replay window start, can replay trigger another automatic retry sequence, and what is the maximum time an in-flight delivery can arrive after replay eligibility ends? These answers determine safe deduplication retention.

These uncertainties are documented rather than blocking completion of the requested writing. No payload schema, ordering metadata, recovery API, delivery SLA, or other unsupported capability is assumed.

## Validation

The guide was checked against each supplied note and the requested coverage. It contains 1,029 whitespace-delimited words including code, or 965 excluding code, within the 700–1,100-word target under either count. The verification example passed 23 local checks covering valid signatures, body and timestamp changes, malformed inputs, empty and rotated key sets, and rejection of raw-body-only signing. Fixture digests were constructed independently of `hmac.new`; the HMAC implementation also passed RFC 4231 test case 1 using its known expected digest, with no network access. This validates the example's mechanics; it does not replace an official Orbit signing test vector or resolve the product questions above.
