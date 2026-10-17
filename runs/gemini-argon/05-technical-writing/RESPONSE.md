# Editorial Choices and Unresolved Questions

## Editorial Choices

1. **Clear Separation of Guarantees vs. Recommendations:**
   Each core section of `WEBHOOKS.md` is divided into explicit **Service Guarantees** and **Integration Recommendations** subsections. This ensures customers can immediately distinguish platform-enforced contract rules (e.g., 10-second timeout, `512 KiB` payload cap, retry status codes, 7-day UI replay retention, 24-hour dual-secret rotation window) from customer-side engineering responsibilities (e.g., asynchronous queueing, constant-time comparison, 7-day idempotency key storage).

2. **Conservative Resolution of Signature Contradictions:**
   `SOURCE_NOTES.md` contained three conflicting or overlapping statements regarding signature generation:
   * A shorthand note stating "`v1=<hex>` using HMAC SHA-256 over raw bytes."
   * Legacy system documentation stating that parsed JSON is signed.
   * A specific note stating: "Current implementation signs timestamp + dot + raw body. Timestamp header is `X-Orbit-Timestamp` Unix seconds. Need state that old note conflicts."
   
   To resolve this conservatively without inventing behavior, `WEBHOOKS.md` documents the specific current implementation (`<X-Orbit-Timestamp>.<raw_request_body_bytes>` over raw, unparsed body bytes) and includes an explicit callout warning customers not to follow the stale parsed-JSON legacy documentation.

3. **Rotation-Ready Verification Example & Logging Safeguards:**
   The minimal Python verification function (`verify_orbit_webhook`) accepts an iterable of active secrets so customers can pass both `current` and `previous` secrets during the 24-hour rotation window without code changes. It uses `hmac.compare_digest` for constant-time comparison and embeds explicit warnings in both code comments and prose against logging secrets or raw sensitive payloads.

4. **Aligning Idempotency Retention with the 7-Day Replay Window:**
   Because the replay UI can resend an event with the same `X-Orbit-Event` ID for up to 7 days, `WEBHOOKS.md` specifically recommends a minimum 7-day TTL for the customer's idempotency deduplication store rather than an arbitrary shorter window.

5. **Word Count Discipline:**
   `WEBHOOKS.md` is ~980 words, keeping the guide concise, scannable, and squarely within the 700–1,100 word target.

---

## Unresolved Questions (Pending Product Confirmation)

1. **HTTP `3xx` Redirect Handling:**
   * *Context:* Security believes redirects are not followed, but the implementation owner has not confirmed.
   * *Question:* Does `Orbit-Hooks/2` refuse to follow all `3xx` responses, and does it treat a `3xx` response as a permanent failure (like non-retryable `4xx`) or a retryable failure?
   * *Interim Guidance in Docs:* Customers are advised to point webhook URLs directly to the final HTTPS endpoint and never rely on `3xx` redirects.

2. **Signature Behaviour During the 24-Hour Key Rotation Window:**
   * *Context:* The notes state that two secrets (`current` and `previous`) are valid for 24 hours during rotation, but do not specify how outbound requests are signed during that period.
   * *Question:* Does Orbit sign outbound webhooks exclusively with the `current` secret once rotated (keeping `previous` valid only for in-flight retries or rollback), or does `X-Orbit-Signature` include multiple space/comma-separated `v1=<hex>` signatures signed by both `current` and `previous`? (If multiple signatures are emitted in a single header, the verification parser must also split `X-Orbit-Signature` before running `hmac.compare_digest`.)
   * *Interim Guidance in Docs:* Customers are advised to verify incoming signatures against both `current` and `previous` secrets during the 24-hour window.

3. **`X-Orbit-Timestamp` Behavior on Retries and 7-Day UI Replays:**
   * *Context:* Orbit sends `X-Orbit-Timestamp` (Unix seconds) and includes it in the signed payload, and allows retries up to ~14.5 hours later and manual UI replays for up to 7 days.
   * *Question:* When an event is retried automatically or replayed via the UI days later, does Orbit generate a fresh `X-Orbit-Timestamp` and recompute `X-Orbit-Signature`, or does it resend the original timestamp and signature?
   * *Interim Guidance in Docs:* Flagged in both the Retry/Replay section and the Troubleshooting table so customers enforcing timestamp freshness tolerances do not inadvertently reject legitimate retries or manual replays.

4. **Deprecation Status of Legacy Parsed-JSON Signatures:**
   * *Context:* Old system documentation describes signing parsed JSON.
   * *Question:* Have all customer webhooks been migrated to `Orbit-Hooks/2` (`v1=<hex>` over `timestamp.raw_body`), and can the legacy documentation be formally archived?
