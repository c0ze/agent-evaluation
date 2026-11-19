# Editorial choices and unresolved questions

These are the decisions I made turning `SOURCE_NOTES.md` into `WEBHOOKS.md`.

## Editorial choices

- **Audience and structure.** I wrote for an integrating developer: what arrives on the wire, how to verify it, what the service promises, and how to recover. Sections follow the task's required topics: minimal verification example, delivery/retry semantics, ordering/idempotency, key rotation, operational advice, and a troubleshooting table.
- **Guarantees vs. recommendations.** I labeled every behavioral statement **Guarantee** or **Recommendation** explicitly, and explained the convention up front. Guarantees are limited to facts actually stated in the notes. Advice that is merely prudent (constant-time comparison, deduplication, background processing, monitoring, secret storage) is marked as a recommendation so readers do not mistake it for a service commitment.
- **Word count.** Final guide is roughly 1,070 words, inside the 700–1,100 target.
- **Verification example.** I used a compact Python 3 standard-library example because it shows the two easy-to-get-wrong details directly: signing raw bytes (`ts + "." + raw_body`) and using `hmac.compare_digest` for constant-time comparison. I kept it minimal and standard-library-only so it is easy to port. A timestamp-tolerance check is included but presented as local policy, not a service rule.
- **Header table.** Header names, meanings, body-size limit, and the 10-second/2xx/ignored-body facts are collected in one reference section so the contract is scannable.
- **Retry and ordering language.** I preserved the qualifiers from the notes: retries are "roughly" on the stated schedule, order "usually" follows creation but is "not guaranteed," and duplicates "can occur." I did not sharpen any of these into a hard promise. The 408/425/429/5xx and "no other 4xx" rules are stated as guarantees because the notes state them plainly.
- **Idempotency framing.** I tied deduplication to `X-Orbit-Event` and noted that UI replays reuse the same ID. This is the one safe way to reconcile "duplicates possible" with "replay resends the same event," so I presented it as a recommendation built on a fact rather than inventing a new delivery guarantee.
- **Secret rotation.** I stated the 24-hour, two-secret, current/previous facts as guarantees, and recommended accepting both secrets during the overlap.
- **Security hygiene.** I included the requested warnings against logging secrets and full sensitive payloads, both in the verification section and echoed in troubleshooting/operations.
- **Troubleshooting table.** Each row maps a symptom to a likely cause drawn from the notes and a concrete action, covering the main failure modes (signature mismatch, rotation, clock skew, duplicates, ordering, `4xx` stops, timeouts, size limits).

## Resolving contradictions conservatively

- **Signing formula (main conflict).** Old-system docs say the signature covers parsed JSON; the current implementation is said to sign `timestamp + "." + raw body`. I treated the old note as stale and documented the current formula, but attached an explicit **documentation conflict** callout telling readers to verify with a test event and not rely on either interpretation without an end-to-end check. I did not silently pick one.
- **Redirects.** The notes flag that security believes redirects are not followed but the implementation owner has not confirmed. I did **not** state a behavior. It appears only in "Open items," with conservative advice to use a final, non-redirecting URL and treat a redirect as a failure until confirmed.

## Unresolved questions requiring product confirmation

1. Confirm the exact signing input (`timestamp + "." + raw body`) and correct or retire the stale parsed-JSON documentation.
2. Are redirects followed? Security thinks no; the implementation owner has not confirmed.
3. Is there an official timestamp-tolerance / replay window for signature verification? The 300-second value in the example is a local default, not a documented guarantee.
4. Are the approximate retry delays (1m/5m/30m/2h/12h) a service commitment or best-effort behavior?
5. What are the exact boundaries of the 24-hour two-secret rotation window (when "previous" stops being accepted)?
6. Not raised in the notes but worth confirming: do the 10-second timeout and 512 KiB limit apply identically to replayed events and to all event types?

I deliberately did not invent answers to any of these; each is flagged in the guide rather than filled in with plausible-sounding behavior.
