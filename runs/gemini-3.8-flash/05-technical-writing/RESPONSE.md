# Editorial Choices and Unresolved Questions

This document details the editorial choices, conservative reconciliation of contradictory source notes, and open questions requiring product confirmation that guided the production of `WEBHOOKS.md`.

---

## 1. Editorial Choices

### Audience and Tone
The developer guide targets backend software engineers and infrastructure architects integrating with Orbit. The tone is authoritative, concise, and security-centric, providing concrete implementation patterns rather than abstract advice.

### Clear Separation of Guarantees vs. Recommendations
To avoid developer misconceptions:
- **Service Guarantees** are strictly scoped to contractual commitments Orbit enforces (at-least-once delivery, 10-second timeout, 2xx acceptance, 24-hour dual-secret validity, 7-day replay availability).
- **Implementation Recommendations** cover customer-side responsibilities (idempotent handling via `X-Orbit-Event`, timestamp drift tolerance, asynchronous worker handoff, log sanitization).

### Verification Example
Node.js using the built-in `crypto` module was selected as the reference implementation. The example directly addresses common real-world failure modes:
1. **Raw byte preservation**: Explicitly accepts unparsed raw request bytes.
2. **Replay defense**: Validates `X-Orbit-Timestamp` against system clock drift (default 300 seconds).
3. **Constant-time comparison**: Uses `crypto.timingSafeEqual` across equal-length buffers to protect against side-channel timing attacks.
4. **Zero-downtime rotation**: Accepts an array of secrets, validating against both `current` and `previous` keys during rotation windows.

### Word Count Management
The guide adheres strictly to the 700–1,100 word target (totaling 1,048 words). High information density was achieved by using structured summary tables for headers, retry schedules, and troubleshooting diagnostics.

---

## 2. Conservative Resolution of Contradictions

### 1. Parsed JSON vs. Raw Request Body Bytes
- **Conflict**: Older documentation suggested verifying signatures over parsed/serialized JSON, whereas the current implementation signs `timestamp + "." + raw_body`.
- **Resolution**: Resolved in favor of the current implementation. Re-serializing parsed JSON alters key order, numeric representations, and whitespace, leading to false verification failures. The guide explicitly flags this historical conflict to prevent developers from following legacy documentation.

### 2. HTTP Redirect Following (3xx Statuses)
- **Conflict**: Security assumes redirects are blocked to prevent SSRF and credential leaks; implementation ownership has not confirmed.
- **Resolution**: Resolved conservatively by warning developers that redirects may not be followed, directing them to configure canonical endpoint URLs directly.

### 3. Chronological Ordering vs. Concurrency
- **Conflict**: Delivery order usually matches creation order, but concurrent retries alter sequence.
- **Resolution**: Classified delivery as fundamentally unordered. Customers must rely on database timestamps or entity version counters rather than arrival order.

---

## 3. Unresolved Questions Requiring Product / Engineering Confirmation

The following behaviors could not be conclusively determined from the source notes and require engineering or product confirmation:

1. **HTTP Redirect Behavior**:
   - Does Orbit's HTTP client follow 3xx redirects (e.g., 301, 302, 307, 308), or does it immediately treat them as delivery failures?
   - If redirects are followed, what is the maximum hop limit, and does Orbit preserve or re-evaluate authentication headers across domain redirects?

2. **Manual Replay Timestamp Semantics**:
   - When an event is manually resent via the 7-day replay UI, does Orbit generate a new `X-Orbit-Timestamp` (and recomputed signature), or does it preserve the original event timestamp?
   - *Impact*: If the original timestamp is preserved, receivers enforcing standard timestamp freshness checks (e.g., 5-minute replay window) will automatically reject manual replays unless custom bypass logic is implemented.

3. **Secret Rotation Signing Key**:
   - During the 24-hour dual-secret grace period, does Orbit exclusively sign outbound payloads with the newly created `current` secret, or can certain workers still sign with `previous`?
   - At the 24-hour mark, does Orbit automatically revoke the previous secret, or does revocation require explicit customer confirmation?

4. **Retry Backoff Jitter**:
   - Are the stated retry intervals (~1m, ~5m, ~30m, ~2h, ~12h) fixed or randomized with exponential jitter to avoid thundering herd effects?

5. **Payload Size Limit Enforcement**:
   - If an event payload exceeds 512 KiB at emission time, does Orbit truncate the payload, fail the dispatch internally, or emit an error event?
