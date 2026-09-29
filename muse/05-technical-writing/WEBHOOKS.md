# Orbit Webhooks

Use webhooks to receive event notifications over HTTPS: verification, retries, and running a reliable receiver.

Throughout this guide, **Guarantee** means behavior the service commits to, and **Recommendation** means guidance for your receiver that the service does not enforce.

## 1. Receiving and verifying events

**Guarantee:** Each delivery is an HTTPS `POST` with a JSON body of at most 512 KiB and these headers:

- `X-Orbit-Event`: unique event ID. Replays reuse the same ID.
- `X-Orbit-Type`: event type string.
- `X-Orbit-Timestamp`: send time as Unix seconds.
- `X-Orbit-Signature`: `v1=<hex>`, an HMAC SHA-256 signature.
- `User-Agent`: `Orbit-Hooks/2`.

**Guarantee:** The signature is computed over the raw request bytes as:

```text
signed_payload = <timestamp ASCII> + "." + <raw body bytes>
signature = "v1=" + hex(HMAC-SHA256(secret, signed_payload))
```

Verify against the raw bytes before JSON parsing. Older documentation described signing parsed JSON; that note is **stale and must not be used**. The current behavior signs `timestamp + "." + raw body`.

**Guarantee:** Your endpoint must return any `2xx` within 10 seconds for the delivery to count as successful. The response body is ignored.

Minimal verification example (Python):

```python
import hashlib
import hmac

def verify_orbit(secret: bytes, timestamp: str, raw_body: bytes, header: str) -> bool:
    signed = timestamp.encode("ascii") + b"." + raw_body
    expected = "v1=" + hmac.new(secret, signed, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header)

# In your handler: read raw_body first, then verify, then parse JSON.
# if not verify_orbit(secret, timestamp, raw_body, signature_header):
#     return 400  # do not retry; see Section 2
```

**Recommendation:** Use a constant-time comparison such as `hmac.compare_digest`, reject requests with a missing timestamp or signature, and reject timestamps far from your clock (for example, older than 5 minutes). No clock-skew window is published, so treat your tolerance as your own policy.

**Recommendation:** Never log the webhook secret, the full signature header alongside the body, or full sensitive payloads. Log the event ID, type, timestamp, and verification outcome instead.

## 2. Delivery and retry semantics

**Guarantee:** The service retries on timeouts, network errors, and these status codes: `408`, `425`, `429`, and any `5xx`.

**Guarantee:** The service does not retry other `4xx` responses. Use `400` for malformed or unverifiable deliveries you do not want retried, and `429` or `503` when you want a retry after a transient overload.

**Guarantee:** A failing delivery is retried up to five times after the initial attempt (six attempts total). The nominal schedule is approximately 1 minute, 5 minutes, 30 minutes, 2 hours, and 12 hours after the prior attempt. Intervals are approximate and are not a timing guarantee.

**Recommendation:** Return `2xx` quickly and work asynchronously. If you cannot finish within 10 seconds, enqueue the event and return `2xx` immediately.

**Recommendation:** Do not rely on redirects. Whether the sender follows redirects is currently unconfirmed (see Section 6); configure your webhook URL as the final HTTPS endpoint.

## 3. Ordering and idempotency

**Guarantee:** Duplicates are possible. The same event ID may be delivered more than once because of retries and manual replays.

**Guarantee:** Delivery order is not guaranteed. Events usually arrive in creation order, but concurrent retries can reorder them.

**Recommendation:** Treat every handler as idempotent: key processed work by `X-Orbit-Event`, deduplicate before side effects, and make repeated deliveries safe. If ordering matters, include your own sequence or timestamp check per entity and tolerate late or reordered arrivals rather than assuming arrival order.

**Guarantee:** Operators can replay an event from the dashboard for up to 7 days after its original delivery. A replay carries the same event ID and must be handled as a duplicate of the original.

## 4. Secret rotation

**Guarantee:** The webhook secret is shown only once when created. Store it securely on receipt.

**Guarantee:** During rotation, two secrets are valid simultaneously for 24 hours. The UI labels them current and previous.

**Recommendation:** On each delivery, try the current secret first and fall back to the previous secret during the rotation window. Complete the cutover within 24 hours, then remove the old secret from your configuration. Rotate promptly if a secret may have been exposed.

## 5. Operating a receiver

**Recommendation:** Expose a dedicated HTTPS route, validate that the payload is under 512 KiB before buffering unbounded input, and optionally check for `User-Agent: Orbit-Hooks/2` as a routing hint — never as authentication. Authentication is the HMAC signature only.

**Recommendation:** Monitor verification failures, `429`/`5xx` rates, latency, duplicates, and per-entity sequence gaps. A sustained rise in retries or signature failures usually means a secret mismatch, clock problem, or overload.

**Recommendation:** Deploy safely: drain in-flight requests, keep both secrets configured across a secret change, and test rotation and replay in staging first.

## 6. Needs product confirmation

The following is explicitly unresolved; do not build on an assumption:

- Redirect behavior: Security expects redirects are not followed, but the implementation owner has not confirmed it. Until confirmed, assume redirects may fail and use a final URL.

## 7. Troubleshooting

| Symptom | Likely cause | What to do |
|---|---|---|
| Signature mismatch on every event | Signing parsed JSON instead of `timestamp + "." + raw bytes`; wrong secret; whitespace or encoding change | Sign raw bytes per Section 1; re-check current/previous secret; log event ID and headers, not the secret |
| Valid events rejected after rotation | Receiver still uses only the old secret | Accept both current and previous secrets for 24 hours, then remove the old one |
| Retries continue after your handler ran | Handler returned non-`2xx`, timed out after 10 seconds, or returned `429`/`5xx` | Return `2xx` within 10 seconds; move slow work to a queue; use `4xx` other than `408`/`425`/`429` to stop retries |
| Same event processed twice | At-least-once delivery; retry or 7-day dashboard replay | Deduplicate by `X-Orbit-Event` before side effects |
| Events arrive out of order | Concurrent retries; order is not guaranteed | Do not assume arrival order; sequence per entity in your own store |
| Large payload rejected or truncated | Body exceeds the 512 KiB maximum | Enforce the limit, return `2xx` only after accepting the full body, and fetch large objects out of band if needed |
| Deliveries stop after a URL move | Endpoint redirect behavior is unconfirmed | Update the webhook URL to the final HTTPS URL instead of relying on a redirect |
