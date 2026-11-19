# Orbit Webhooks Integration Guide

Orbit sends event notifications to your HTTPS endpoint as HTTP `POST` requests with JSON payloads.

Throughout this guide, **Guarantees** describe documented platform behavior, **Recommendations** describe integration best practices, and **Pending confirmation** marks unconfirmed behavior that you should handle conservatively.

## Request Format

**Guarantees**
- Orbit sends HTTP `POST` requests with a JSON body up to **512 KiB** and `User-Agent: Orbit-Hooks/2`.
- Requests include these headers:

| Header | Purpose |
|---|---|
| `X-Orbit-Event` | Event ID; reused on retries and manual replays. |
| `X-Orbit-Type` | Event type name. |
| `X-Orbit-Timestamp` | Unix timestamp in seconds. |
| `X-Orbit-Signature` | HMAC-SHA256 signature (`v1=<hex>`). |

**Recommendations**
- Use `User-Agent` for logging only—never for authentication.

## Signature Verification

**Guarantees**
- Orbit signs requests with HMAC-SHA256 using your endpoint secret and sends `v1=<hex>` in `X-Orbit-Signature`.
- Signing secrets are shown **only once** at creation; store them in a secrets manager.
- The current implementation signs `<X-Orbit-Timestamp>.<raw_request_body>` (timestamp string, `.`, and unmodified raw request bytes).

> **Conflicting legacy notes:** Older docs mention signing parsed JSON, and brief notes mention signing raw body bytes alone. Both conflict with the current `timestamp + "." + raw_body` implementation. Never parse and re-serialize JSON before verifying—whitespace or key-order differences break verification. *(Pending confirmation: whether any legacy endpoints omit the timestamp prefix or vary hex casing.)*

**Recommendations**
- Read raw request bytes before JSON parsing and compare digests in constant time.
- Optionally reject timestamps outside a tolerance window (e.g., 5 minutes), after confirming how manual UI replays set `X-Orbit-Timestamp`.
- **Never log signing secrets or full sensitive payloads.** Log only non-sensitive metadata (`X-Orbit-Event`, `X-Orbit-Type`, `X-Orbit-Timestamp`, and HTTP status).

### Minimal Verification Example (Python)

```python
import hashlib
import hmac
import time


def verify_orbit_webhook(
    raw_body: bytes,
    timestamp: str,
    signature_header: str,
    secrets: list[str],
    tolerance_seconds: int | None = 300,
) -> bool:
    """Verify an Orbit signature. Never log secrets or sensitive payloads."""
    if not timestamp or not signature_header.startswith("v1="):
        return False
    try:
        ts = int(timestamp)
    except ValueError:
        return False
    if tolerance_seconds is not None and abs(int(time.time()) - ts) > tolerance_seconds:
        return False

    received = signature_header[3:].lower().encode("utf-8")
    signed = f"{timestamp}.".encode("utf-8") + raw_body
    for secret in secrets:  # Include [current, previous] during rotation.
        expected = hmac.new(
            secret.encode("utf-8"), signed, hashlib.sha256
        ).hexdigest().encode("utf-8")
        if hmac.compare_digest(expected, received):
            return True
    return False
```

## Delivery and Retry Semantics

**Guarantees**
- Your endpoint has **10 seconds** to return any `2xx` status code; Orbit ignores the response body.
- Orbit retries on timeouts, network errors, `408`, `425`, `429`, and `5xx` responses.
- Orbit does **not** retry other `4xx` responses (e.g., `400`, `401`, `403`, `404`).
- Orbit performs **5 retries after the initial attempt** (6 total deliveries) on an approximate schedule: `1m`, `5m`, `30m`, `2h`, `12h`.

**Not guaranteed / Pending confirmation**
- Retry intervals are approximate; do not rely on exact timing.
- **Redirects (`3xx`) — pending confirmation:** Security believes redirects are not followed, but engineering has not confirmed this. **Recommendation:** Configure the final HTTPS URL directly and avoid `3xx` responses.
- **Pending confirmation:** `Retry-After` handling on `429`/`503`, and whether retries or manual replays refresh `X-Orbit-Timestamp`.

## Ordering, Idempotency, and Replays

**Guarantees vs. Non-guarantees**
- **At-least-once delivery:** Duplicates can occur from retries, timeouts, or replays.
- **No ordering guarantee:** Events usually arrive in creation order, but concurrent retries can deliver them out of order.
- **7-day replay UI:** Operators can resend an event from the UI for up to **7 days** using the same `X-Orbit-Event` ID.

**Recommendations**
- Deduplicate atomically on `X-Orbit-Event` (e.g., a unique database index) and retain IDs for **at least 7 days** to span both retries (~14.6 hours) and manual replays.
- Guard against out-of-order updates using payload versions or timestamps rather than arrival order.

## Secret Rotation

**Guarantees**
- During rotation, **two secrets remain valid for 24 hours**, labeled `current` and `previous` in the UI.

**Recommendations**
1. Rotate in the UI and store the new `current` secret immediately (shown once).
2. Configure your receiver to accept signatures matching either `current` or `previous`.
3. Verify incoming traffic succeeds with the new secret within 24 hours.
4. Remove `previous` after the 24-hour window expires.

*(Pending confirmation: whether Orbit signs with `current` only or includes multiple signatures in `X-Orbit-Signature` during overlap.)*

## Operational Advice

**Recommendations**
- **Acknowledge fast:** Verify the signature, enqueue the raw event asynchronously, and return `2xx` well within 10 seconds.
- **Body limits:** Configure proxies and frameworks to accept at least **512 KiB** while capping larger bodies.
- **Accurate status codes:** Return `2xx` only after durable persistence; return `5xx`/`429` for transient errors and `400`/`401` only for permanent rejection.
- **Safe logging:** Never log signing secrets or full sensitive payloads; log only event ID, type, timestamp, and result.

## Troubleshooting

| Symptom | Likely Cause | Action |
|---|---|---|
| Signature mismatch (`401`) | Hashing parsed JSON, omitting `<timestamp>.`, or unrotated secret. | Hash `<X-Orbit-Timestamp>.<raw_body>`; verify against both `current` and `previous`. |
| Retries despite processing | Handler exceeded 10s timeout or returned non-`2xx`. | Enqueue work asynchronously and return `2xx` immediately. |
| Events dropped permanently | Endpoint returned non-retryable `4xx` (`400`, `401`, `403`, `404`). | Fix receiver and resend via Replay UI within 7 days. |
| Failures on redirected URL | Endpoint returns `3xx`; redirect following unconfirmed. | Point webhook config directly to final HTTPS URL. |
| Duplicate side effects | Missing `X-Orbit-Event` deduplication or short TTL. | Deduplicate atomically on `X-Orbit-Event` for at least 7 days. |
| Out-of-order overwrites | Concurrent retries delivered older event late. | Check payload timestamps or versions before mutating state. |
| `413 Payload Too Large` | Server/proxy body limit below 512 KiB. | Raise max request body size to at least 512 KiB. |
