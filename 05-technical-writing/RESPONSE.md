# Editorial Choices and Unresolved Questions

This document details the editorial choices, structural rationale, conservative contradiction resolutions, and unresolved product questions for the Orbit Webhooks Developer Guide (`WEBHOOKS.md`).

---

## 1. Editorial Choices & Information Architecture

### Target Audience & Tone
The guide is designed for backend engineers and systems integrators implementing webhook ingestion. The tone is authoritative, concise, and technical, focusing on deterministic protocols, concrete security practices, and actionable error handling.

### Document Structure & Pacing
The guide is sequenced in order of an engineer's implementation workflow:
1. **Protocol Specifications & Headers:** First establish the envelope format, standard HTTP headers, and explicit contract boundaries.
2. **Guarantees vs. Recommendations:** Explicitly separate hard system contracts (e.g., 512 KiB payload ceiling, 10s timeout, HMAC-SHA256) from consumer-side architectural recommendations (e.g., async job queueing, replay window validation).
3. **Signature Verification:** Placed upfront before payload processing because unverified payloads should never be ingested into downstream application logic.
4. **Delivery & Retry Semantics:** Detail the full retry lifecycle (initial + 5 retries), specific retryable status codes, and non-retryable 4xx handling.
5. **Ordering & Idempotency:** Explain why ordering cannot be guaranteed due to concurrent retries, provide practical deduplication guidance using `X-Orbit-Event`, and document replay behavior.
6. **Secret Key Rotation:** Provide clear operational instructions for zero-downtime rotation during the 24-hour dual-secret window.
7. **Operational Advice:** Provide architectural best practices (decoupling ingestion from processing, body limits, security logging rules).
8. **Troubleshooting Guide:** A quick-reference table mapping observable symptoms to root causes and concrete remediation steps.

### Verification Code Language
Node.js was selected for the minimal verification example using the built-in `crypto` module:
- Requires zero external dependencies (`crypto.createHmac`, `crypto.timingSafeEqual`).
- Demonstrates how to handle raw byte buffers versus parsed JSON strings.
- Explicitly enforces constant-time byte comparison to protect against timing attacks.
- Demonstrates timestamp tolerance parsing to prevent replay attacks.

---

## 2. Conservative Resolutions of Contradictions

### 1. Raw Byte Signing vs. Parsed JSON (Legacy Documentation Conflict)
* **Contradiction:** Legacy documentation suggested computing signatures over parsed JSON objects, whereas current dispatcher implementation computes signatures over `${X-Orbit-Timestamp}.${raw_request_body}`.
* **Resolution:** Conservatively adopted the active implementation and explicitly documented the legacy note as obsolete. Explained that verifying over parsed JSON causes widespread false failures because JSON deserialization/serialization does not guarantee whitespace preservation, key ordering, or numeric float formatting. Integrators are explicitly instructed to capture the raw byte stream before body-parsing middleware executes.

### 2. HTTP Redirect Behavior
* **Contradiction:** Security guidelines state that redirects must not be followed, but the engineering implementation owner has not officially confirmed whether the dispatcher rejects redirects or follows them.
* **Resolution:** Conservatively advised integrators that endpoints must never return HTTP `3xx` redirects and must configure canonical destination URLs directly. Avoided asserting definitive dispatcher mechanics, labeling redirect handling as "Pending Product Confirmation" to avoid inventing behavior.

### 3. Key Rotation Verification Strategy
* **Contradiction / Ambiguity:** Source notes indicate two keys are valid for 24 hours, labeled "Current" and "Previous", but do not specify whether the dispatcher ever sends multiple signatures in one header.
* **Resolution:** Prescribed trial verification against the Current key first, followed by the Previous key if rotation is underway. This guarantees zero downtime regardless of whether an event in-flight was signed with the previous or new secret.

---

## 3. Unresolved Questions & Product Confirmations

The following points could not be definitively determined from source notes and require confirmation from product management and engineering:

1. **Exact Dispatcher Behavior on HTTP 3xx Redirects:**
   - *Question:* When an endpoint responds with a 301, 302, 307, or 308 redirect, does the dispatcher immediately fail the request permanently, treat it as a retryable error, or follow up to $N$ hops?
   - *Impact:* Determines whether customer migrations involving domain redirects cause silent message loss or transient retry storms.

2. **Signature Header Semantics During Key Rotation:**
   - *Question:* During the 24-hour dual-key window, does Orbit sign using only the Current secret, or does the dispatcher support sending multiple signatures in `X-Orbit-Signature` (e.g., `v1=sig_current, v1=sig_previous` or comma-separated values)?
   - *Impact:* Informs whether receiver verification logic can inspect header key identifiers or must attempt sequential HMAC computations.

3. **Replay Identification Telemetry:**
   - *Question:* When events are manually resent via the 7-day dashboard Replay UI, does Orbit include an identifying header (e.g., `X-Orbit-Replay: true` or `X-Orbit-Delivery-Attempt: n`)?
   - *Impact:* Enables consumers with strict state machines to distinguish organic delivery retries from administrative operational replays while preserving the invariant `X-Orbit-Event` ID.

4. **Static Egress IPs & CIDR Blocks:**
   - *Question:* Does Orbit publish a static set of egress IP addresses or CIDR ranges for webhook dispatchers to support customer firewall allowlisting?
   - *Impact:* Critical for enterprise customers whose corporate security policies prohibit accepting webhooks without network-level IP filtering.

5. **Sender-Enforced Clock Skew & Timestamp Window:**
   - *Question:* Does Orbit specify or enforce an official timestamp drift threshold, or is the 5-minute tolerance strictly an integrator recommendation?
   - *Impact:* Helps customers configure appropriate tolerance thresholds without rejecting valid deliveries during clock drift.

6. **Destination Concurrency Limits & Throttling:**
   - *Question:* Does Orbit cap the maximum number of concurrent HTTP connections dispatched to a single destination host during event spikes?
   - *Impact:* Influences consumer capacity planning and whether webhook receivers risk thread starvation without external reverse proxy buffering.
