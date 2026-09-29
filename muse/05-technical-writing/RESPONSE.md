# Response — editorial choices and open questions

## Contradiction resolved

- **Signing input.** The old-system note ("sign parsed JSON") conflicts with the current implementation ("sign `timestamp + '.' + raw body`"). Resolved conservatively in favor of the current implementation: the guide specifies raw bytes and explicitly flags the old note as stale, with a migration callout. Rationale: following stale docs would break verification for every new integrator; following current behavior is the only safe default.

## Guarantee vs. recommendation splits

- Treated as **guarantees** only what the notes state as implemented behavior: signature construction, headers, 10-second / any-`2xx` rule, retryable codes, ~6-try schedule, duplicates possible, order not guaranteed, two-secrets-for-24h, 7-day replay with same event ID, 512 KiB max, `Orbit-Hooks/2` UA.
- Everything else (5-minute skew window, constant-time comparison detail beyond "use it", acknowledge-then-process, dedup retention length, rotation procedure order, monitoring advice) is labeled **recommendation** because the notes do not pin those values as product behavior. The 5-minute skew is my chosen example threshold, not a sourced value — stated as a recommendation, not a guarantee.

## Conservative choices

- Retry intervals presented as approximate (notes say "roughly"); warned against building timing logic on them.
- "Other `4xx` not retried" framed as terminal for that delivery so integrators do not expect a retry that will never come.
- Replay resend described only up to its sourced facts (7 days, same ID); no invented replay rate limits or auth behavior.
- Logging warning from the notes kept in both the verification section and the example context.

## Unresolved — needs product confirmation

1. **Redirects (`3xx`).** Notes say security believes redirects are not followed but the implementation owner has not confirmed. The guide therefore advises serving the final URL with no redirect. Needs: confirm follow/no-follow, and whether `301/302` vs `307/308` differ.
2. **Clock-skew policy.** No server-side timestamp enforcement is documented. The 5-minute check is a receiver-side recommendation only. Needs: does the sender expire signatures, and is there a recommended skew?
3. **"Roughly" retry schedule.** Needs: exact backoff algorithm, jitter, and whether the 12-hour tail extends under sender-side incidents.
4. **Replay mechanics.** Needs: does a replayed delivery re-sign with a fresh timestamp (affects freshness checks), and is replay rate-limited?
5. **Secret format/rotation trigger.** Needs: secret encoding/length and whether rotation can be API-driven or UI-only.
