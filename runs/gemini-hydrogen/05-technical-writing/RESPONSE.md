# Editorial Notes & Unresolved Questions

## Summary of Deliverable

- [`WEBHOOKS.md`](./WEBHOOKS.md): Customer-facing integration guide (`1,019` words via `wc -w`, within the `700–1,100` word target), covering request headers, guarantees vs. recommendations, signature verification with a minimal Python example, delivery and retry semantics, ordering/idempotency, 24-hour key rotation, operational advice, and a troubleshooting table.

---

## Editorial Choices

1. **Conservative resolution of the signature contradiction:**
   - `SOURCE_NOTES.md` notes both "over raw bytes" and a conflicting legacy document claiming signatures are computed over "parsed JSON," alongside the current implementation signing `timestamp + "." + raw body`.
   - `WEBHOOKS.md` treats `<X-Orbit-Timestamp>.<raw_body_bytes>` as the authoritative `v1` format, uses raw `bytes` (not parsed/re-serialized JSON) in the code example, and includes an explicit warning callout stating that the older parsed-JSON note conflicts with current behavior.

2. **Clear separation of guarantees, unconfirmed/best-effort behavior, and recommendations:**
   - Placed an explicit **Guarantees vs. Recommendations** section near the top so integrators can immediately distinguish contractual invariants (e.g., 10s response limit, max 5 retries, 24h dual-secret rotation window, 7-day UI replay preserving `X-Orbit-Event`, 512 KiB max payload) from approximate/best-effort behavior (retry cadence, event ordering, duplicates) and unconfirmed behavior (`3xx` redirects, timestamp refresh behavior).
   - Preserved conservative wording throughout (e.g., describing retry intervals as "roughly 1m, 5m, 30m, 2h, 12h" without assuming cumulative vs. inter-attempt deltas or jitter curves, and avoiding assumptions about unstated JSON body schemas or Orbit REST API endpoints).

3. **Explicit replay-window caution on `X-Orbit-Timestamp`:**
   - Rather than inventing a standard tolerance (such as rejecting signatures older than 5 minutes), `WEBHOOKS.md` explicitly warns integrators to confirm whether `X-Orbit-Timestamp` updates per delivery attempt before rejecting older timestamps, since unrefreshed timestamps would break automatic retries (~15h) and manual UI replays (7 days).

4. **Conservative guidance on `3xx` redirects:**
   - Treated redirect following as **unconfirmed** (noting Security's belief that redirects are not followed, pending implementation-owner confirmation) and recommended pointing webhook registrations directly to the final HTTPS endpoint URL.

5. **Minimal Python verification example:**
   - Used Python standard library (`hmac`, `hashlib`, `logging`) to avoid external framework dependencies while demonstrating case-insensitive header lookup, raw `bytes` handling, `<timestamp>.<raw_body>` signing input, constant-time `hmac.compare_digest`, empty-secret guarding, rotation support across `[current, previous]`, fast async `200` return, and prominent warnings against logging secrets, raw signatures, or unredacted sensitive payloads.

6. **Idempotency & operational alignment:**
   - Linked the 7-day UI replay window (which preserves `X-Orbit-Event`) to idempotency retention (>= 7 days) and to recording completion only after durable handoff so failed deliveries remain replayable.
   - Linked the 512 KiB limit to proxy/framework max-body configuration because `413 Payload Too Large` falls outside retried `4xx` codes (`408`, `425`, `429`).

---

## Unresolved Questions Requiring Product / Engineering Confirmation

1. **Redirects (`3xx` handling):**
   - Implementation owner needs to confirm Security's belief that `3xx` redirects are not followed. If not followed, are `3xx` responses classified as permanent failures or retried?
2. **`X-Orbit-Timestamp` lifecycle & replay window:**
   - Is `X-Orbit-Timestamp` updated to the send time on each automatic retry and 7-day UI replay, or does it remain fixed to the original event creation time?
   - Is there an official recommended timestamp tolerance window for receivers?
3. **Legacy documentation cleanup:**
   - Confirm that the old system ("sign parsed JSON") is fully deprecated in production or clarify whether any legacy endpoints/versions still receive the older signature format so docs can be cleaned up or versioned.
4. **Signature formatting & rotation edge cases:**
   - Is `<hex>` in `X-Orbit-Signature: v1=<hex>` guaranteed lowercase?
   - During the 24-hour key rotation overlap, does Orbit immediately switch outbound signing to `current` (relying on receivers keeping `previous` configured for in-flight requests/deployment lag), or can `X-Orbit-Signature` carry multiple comma-separated signatures?
   - Is `previous` automatically revoked after 24 hours, and can customers revoke it earlier in case of secret compromise?
5. **Retry schedule & failure semantics:**
   - Are `1m, 5m, 30m, 2h, 12h` inter-retry delays or offsets from initial failure, and how is jitter applied?
   - Does Orbit honor `Retry-After` headers on `429` or `503` responses?
   - Does the 10-second timeout cover total connection + TLS + full response completion, or response headers/TTFB?
   - How are `1xx` status codes handled?
   - What happens operationally after all 5 retries fail (e.g., alerting, endpoint auto-disabling, or UI visibility during the 7-day replay window)?
6. **Headers, encoding, and event identity:**
   - What exact `Content-Type` header is sent (e.g., `application/json` vs. `application/json; charset=utf-8`), and is UTF-8 encoding guaranteed?
   - Is `X-Orbit-Event` globally unique across Orbit, per account, or per endpoint (which determines how customers should scope database idempotency keys)?
   - How are events exceeding 512 KiB handled at emission time (rejected, truncated, or split)?
