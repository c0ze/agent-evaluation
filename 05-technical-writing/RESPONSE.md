# Editorial choices and unresolved questions

Companion to `WEBHOOKS.md`. Source: `SOURCE_NOTES.md`.

## Editorial choices

- **Signature contradiction resolved in favor of the current implementation.**
  The old docs say the signature covers the parsed JSON; the notes say the
  current implementation signs `timestamp + "." + raw body` and that the old
  note is probably stale. I documented the current behavior as the guarantee
  and added an explicit callout that the old note conflicts, advising readers
  to verify against raw bytes. This is conservative because re-serialized
  JSON almost never byte-matches the original body, so signing parsed JSON
  would fail against the real implementation.
- **Guarantees vs. recommendations.** Every behavior stated in
  `SOURCE_NOTES.md` is labeled **Guaranteed**. Anything I added beyond the
  notes — returning 2xx before async processing, timestamp-freshness checks,
  idempotency-key strategy, rotation sequencing, alerting on verification
  failures — is labeled **Recommended**, since the notes do not commit to it.
- **Timestamp tolerance not invented.** The notes give no maximum accepted
  timestamp age, so the guide recommends a tolerance (e.g., five minutes) and
  explicitly says no platform value is published.
- **Minimal verification example in Python** with no web framework, using
  `hmac.compare_digest` for constant-time comparison, per the notes.
- **Retry schedule presented as approximate** ("roughly 1m, 5m, 30m, 2h,
  12h") exactly as the notes state it, including five retries after the
  initial attempt; the ~14.5-hour total window is derived arithmetic and is
  presented as approximate.
- **Replay documented as keeping the same event ID** within its 7-day window,
  which reinforces the idempotency-key guidance.
- **Security warnings included** per the notes: never log secrets or full
  sensitive payloads; log event IDs and types instead.
- Target length 700–1,100 words; the guide is within range.

## Unresolved questions (require product confirmation)

1. **Redirect following.** It is unconfirmed whether the delivery client
   follows HTTP redirects. Security believes no; the implementation owner has
   not confirmed. The guide flags this in "Open questions" and advises not to
   rely on redirects rather than inventing behavior.
2. **Maximum accepted timestamp age.** No published value exists; the guide
   recommends a customer-chosen tolerance instead of asserting one.
3. **Stale parsed-JSON signing note.** Treated as stale and called out, but
   worth confirming with the docs owner that no legacy endpoints still sign
   parsed JSON.
