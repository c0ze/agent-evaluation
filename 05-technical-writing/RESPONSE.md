# Response: editorial choices and open questions

## Editorial choices

- **Guarantee vs. recommendation labels:** Every behavior paragraph is prefixed
  with bold **Guarantee** (service commits to it per the notes) or
  **Recommendation** (receiver-side advice the service does not enforce).
  This keeps the required distinction visible without a separate legend
  the reader could miss.
- **Signature contradiction resolved toward the current implementation:**
  The notes say old docs describe signing parsed JSON but the current
  implementation signs `timestamp + "." + raw body`. I documented only the
  current form as the guarantee, marked the old note stale in Section 1,
  and warned to verify raw bytes before parsing (re-serialization breaks
  signatures).
- **Conservative retry wording:** The schedule is stated as nominal and
  approximate ("approximately ... not a timing guarantee") because the
  notes say "roughly". The retryable set (timeout, network error, 408,
  425, 429, 5xx) and the non-retry of other 4xx are stated as guarantees,
  with receiver guidance on which status to return.
- **Ordering stated as no guarantee:** "Usually in creation order" is
  explicitly downgraded to background context; the guarantee is that order
  is not guaranteed, with idempotency keyed on `X-Orbit-Event` as the
  recommendation.
- **No invented timestamp tolerance:** The notes give no clock-skew window,
  so the 5-minute freshness check is framed as an example receiver policy,
  not a service requirement.
- **Rotation as try-current-then-previous:** The notes only say two secrets
  are valid for 24 hours with UI labels. The fallback-then-remove pattern
  is presented as a recommendation, not a service behavior.
- **Replay and duplicates unified:** The 7-day replay with the same event ID
  is placed under ordering/idempotency so readers treat replays as expected
  duplicates rather than new events.
- **Logging warning kept in the code section:** Placed next to the
  verification example where a developer is most likely to add debug
  logging, rather than buried in operations.
- **Redirects not documented as behavior:** Left as an explicit unresolved
  item in its own section and in troubleshooting, with the conservative
  advice to use a final URL.

## Unresolved questions needing product confirmation

1. **Redirects:** Are any `3xx` responses followed (which codes, how many
   hops, method/body preserved)? Security believes no, but the
   implementation owner has not confirmed. Blocks firm guidance.
2. **Timestamp validation:** Is there a sender-side or required
   receiver-side clock-skew window? Should receivers reject old timestamps,
   and at what age?
3. **Retry details:** What counts as "timeout" vs. "network error" (connect
   vs. read, DNS failure, TLS failure)? Is there jitter on the nominal
   1m/5m/30m/2h/12h schedule, and does the schedule restart after a replay?
4. **Signature versioning:** Is `v1` the only version receivers will see?
   How should unknown versions be handled, and will new versions overlap
   like secrets during migration?
5. **Oversize payloads:** What happens above 512 KiB — never sent, truncated,
   or delivered with an error signal? Should receivers pre-reject by
   `Content-Length`?
6. **Replay signing secret:** Is a replayed event re-signed with the current
   secret or the secret active at original delivery? This affects how long
   old secrets must be retained.
