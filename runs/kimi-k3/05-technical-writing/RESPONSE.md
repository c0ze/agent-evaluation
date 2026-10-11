# RESPONSE — editorial choices and open questions

## What I wrote and why

`WEBHOOKS.md` is a developer-facing integration guide built strictly from
`SOURCE_NOTES.md`. It covers: delivery format and headers, a minimal working
signature-verification example (Python/Flask, hashing the raw body and using
`hmac.compare_digest`), response and retry semantics, ordering/duplicates and
idempotency guidance, secret rotation, replay behavior, operational
recommendations, and a troubleshooting table. Length is within the 700–1,100
word target (roughly 1,000 words of prose and code).

## Editorial choices

- **Guarantees vs. recommendations.** I labeled statements explicitly.
  Guarantees come straight from the notes (what is retried, retry count and
  approximate schedule, 10-second window, 512 KiB cap, two-secret/24-hour
  rotation, 7-day replay with the same event ID, raw-body signing).
  Recommendations are advice layered on top: timestamp-skew checks,
  idempotency-key deduplication, async processing, not logging secrets or
  sensitive payloads, monitoring, and avoiding redirects.
- **Contradiction resolution — signature scheme.** The notes say old docs
  describe signing *parsed JSON* while the current implementation signs
  `timestamp + "." + raw body`. I resolved this conservatively: the guide
  instructs raw-body signing (matching the current implementation and the
  timestamp header's existence) and explicitly flags the older guidance as
  stale rather than silently dropping it, so readers who saw the old docs
  know which to trust.
- **Retry math.** "Five retries after initial try" is stated as six total
  attempts; the troubleshooting table's "~13.5 hours" is the sum of the
  approximate intervals (1m+5m+30m+2h+12h), framed as approximate since the
  schedule itself is approximate.
- **Idempotent example.** The minimal example verifies, checks timestamp
  skew, and returns `204` without processing, with a comment pointing to the
  idempotency section — kept minimal per the task while remaining safe to
  copy.
- **Redirect uncertainty.** Rather than inventing behavior, the guide states
  that redirect handling is unconfirmed, advises assuming redirects are *not*
  followed (the conservative, security-aligned reading), and lists it as an
  open item.

## Unresolved questions for product/engineering

1. **Redirects:** Does the delivery client follow 3xx responses (and if so,
   how many hops, and is the signature re-sent to the redirect target)?
   Security believes no; the implementation owner has not confirmed.
2. **Timestamp enforcement:** Is the timestamp validated server-side at all
   (i.e., does Orbit sign a fresh timestamp per retry, and is there any
   canonical tolerance)? The guide's 5-minute skew is a recommendation only.
3. **Retry jitter/exactness:** Are the 1m/5m/30m/2h/12h intervals fixed or
   jittered? The guide says "approximate," but confirmed behavior would let
   us tighten the wording.
4. **Payload size at 512 KiB:** What happens to events exceeding the cap —
   dropped, truncated, or delivered differently? Not covered by the notes.
5. **Replay signature:** Do replays reuse the original timestamp/signature
   inputs, or are they re-signed with a fresh timestamp? This affects whether
   strict timestamp-skew checks could reject legitimate replays — worth
   confirming before customers adopt tight skew windows.
