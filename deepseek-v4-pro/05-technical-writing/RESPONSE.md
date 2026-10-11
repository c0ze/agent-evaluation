# Editorial choices and unresolved questions

## Editorial choices

- **Signature algorithm conflict.** The notes contain two accounts: an older
  document saying the signature is over parsed JSON, and the current
  implementation signing `timestamp + "." + raw body`. I treated the current
  implementation as authoritative, documented the raw-body algorithm, and
  flagged the parsed-JSON description as outdated rather than presenting both as
  equally valid.
- **Timestamp as signing input.** I described the `X-Orbit-Timestamp` value as
  the string that is prepended to the raw body with a dot separator, and
  recommended treating it as an opaque signature component rather than a clock.
- **Retry schedule.** The notes say "five retries after initial try" followed by
  the schedule `1m, 5m, 30m, 2h, 12h` (five entries). I presented these as the
  five retries, labeled "approximately," since the source uses "roughly."
- **Guarantees vs. recommendations.** I labeled statements explicitly as
  **guarantee**, **recommendation**, or **unconfirmed** so readers can
  distinguish enforced behavior from advice.
- **Language for the example.** I used Python because `hmac.compare_digest`
  makes the constant-time comparison requirement idiomatic and short. The
  example reads the raw body as bytes and never parses before verifying.
- **Replay.** I included the 7-day same-ID replay as a source of duplicate
  deliveries under ordering/idempotency rather than omitting it, since it
  directly strengthens the idempotency recommendation.
- **Redirect behavior.** Marked as **unconfirmed** in the guide rather than
  inventing a policy.

## Unresolved questions requiring product confirmation

1. **Redirects.** Whether HTTP redirects are followed (and to what depth/limit)
   is explicitly uncertain in the source; the security and implementation teams
   disagree. Final behavior needs confirmation.
2. **Timestamp canonicalization.** Whether the signing input uses the timestamp
   exactly as emitted in the header (decimal seconds, no padding) or a stricter
   canonical form. I assumed the header string is used verbatim.
3. **Secret overlap window.** Whether the "two secrets valid for 24 hours"
   window is a fixed 24-hour rotation, or an overlap that is configurable /
   per-secret from creation time.
4. **Retry schedule precision.** Whether the `1m, 5m, 30m, 2h, 12h` intervals
   are fixed or jittered, and whether retries are strictly capped at five.
5. **Replay scope.** Whether the 7-day replay always reuses the original event
   ID and signature, or can regenerate/update timestamps or signature inputs.