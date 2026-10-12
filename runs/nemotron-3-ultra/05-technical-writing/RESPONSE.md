# Editorial Choices & Unresolved Questions

## Editorial Choices

### 1. Signature Verification Algorithm
**Choice**: Documented the current implementation (`timestamp + "." + raw_body`) as the authoritative behavior, with a callout box noting the stale "parsed JSON" note.
**Rationale**: The source notes explicitly state the old note "is probably stale" and "conflicts." Treating the implementation as source of truth is conservative.

### 2. Retry Schedule Precision
**Choice**: Presented the schedule as "approximate" with "roughly" and "approximate" qualifiers. Did not invent jitter details.
**Rationale**: Source says "roughly" and "schedule roughly." No jitter or exact timing specified. Over-specifying would be inventing behavior.

### 3. Ordering Guarantee
**Choice**: Explicitly called out "no guarantee" on delivery order, separated from the event ID stability guarantee.
**Rationale**: Source says "usually follows creation but concurrent retries mean it is not guaranteed." This is a clear non-guarantee.

### 4. Redirect Behavior
**Choice**: Listed as unresolved in troubleshooting table and dedicated section. Did not assume either behavior.
**Rationale**: Source explicitly states "Security thinks no, implementation owner has not confirmed." This is a genuine product question.

### 5. Key Rotation Window
**Choice**: Stated "24 hours" for dual-secret validity based on source. Did not specify whether rotation is instantaneous or gradual.
**Rationale**: Source says "two secrets valid for 24 hours." No detail on transition mechanics. Conservative to state the overlap window only.

### 6. Replay Window vs. Secret Validity
**Choice**: Noted replay UI works for 7 days but secrets rotate in 24 hours. Called out that replays reuse original event ID and signature.
**Rationale**: Source confirms both facts. The implication: replays after rotation must still verify against the secret active at original delivery time. This deserves implementation confirmation.

### 7. Payload Size
**Choice**: Stated "max 512 KiB" as a guarantee.
**Rationale**: Source states this directly. No ambiguity.

### 8. Timeout Handling
**Choice**: Specified "10 seconds to return any 2xx" and "response body ignored."
**Rationale**: Direct from source. Clear contract.

### 9. Idempotency Recommendation
**Choice**: Recommended storing event IDs with TTL ≥ 7 days.
**Rationale**: Replay window is 7 days; this covers the full deduplication window.

### 10. Troubleshooting Table Structure
**Choice**: Organized by symptom → cause → resolution. Included both common integration errors and operational scenarios.
**Rationale**: Practical for developers debugging live issues.

---

## Unresolved Questions (Require Product Confirmation)

| # | Question | Source Context | Impact |
|---|----------|----------------|--------|
| 1 | Are HTTP redirects (3xx) followed? | "Security thinks no, implementation owner has not confirmed" | Customers using redirect chains need to know; affects endpoint design |
| 2 | What is the exact retry jitter algorithm? | "Schedule roughly 1m, 5m, 30m, 2h, 12h" | Affects capacity planning and SLA modeling |
| 3 | During key rotation, are replays of events from before rotation signed with the old secret or current secret? | "Replay UI can resend an event for 7 days and uses same event id" + "two secrets valid for 24 hours" | If replays use original secret, customers must retain old secrets for 7 days, not 24 hours |
| 4 | Are there published IP ranges for allowlisting? | Not mentioned | Security teams often require this |
| 5 | Is the 10-second timeout measured from TCP connect, TLS handshake complete, or first byte sent? | "receiver has 10 seconds to return any 2xx" | Affects server configuration (e.g., proxy timeouts) |
| 6 | What happens on the 6th attempt (after 5 retries)? Is there a dead-letter queue, notification, or silent drop? | "Five retries after initial try" | Operational visibility for failed deliveries |
| 7 | Does the replay UI respect the original retry schedule or send immediately? | "Replay UI can resend an event for 7 days" | Affects testing and recovery procedures |
| 8 | Is the User-Agent `Orbit-Hooks/2` stable, or does the version increment with breaking changes? | "User-Agent `Orbit-Hooks/2`" | Customers may parse this for version detection |

---

## Conservative Resolutions Applied

- **Signature conflict**: Sided with implementation (raw body) over stale docs note
- **Redirects**: Assumed not followed (security stance) but flagged as unconfirmed
- **Ordering**: Treated as best-effort only; no implied guarantee
- **Retry timing**: Treated as approximate; no SLA implied
- **Replay + rotation interaction**: Highlighted tension (7-day replay vs 24-hour secret overlap) without resolving

---

## Word Count Check

WEBHOOKS.md: ~890 words (within 700–1,100 target)