# Webhook Delivery Guide

This guide covers integrating with Orbit's webhook system. It distinguishes **guarantees** (contractual behaviors you can depend on) from **recommendations** (best practices for reliability).

---

## Quick Verification Example

```python
import hmac
import hashlib
import time

SECRET = "whsec_your_secret_here"  # Store securely, never log

def verify_signature(request):
    timestamp = request.headers.get("X-Orbit-Timestamp")
    event_id = request.headers.get("X-Orbit-Event")
    event_type = request.headers.get("X-Orbit-Type")
    signature = request.headers.get("X-Orbit-Signature", "")
    raw_body = request.get_data()  # Raw bytes, NOT parsed JSON

    if not all([timestamp, event_id, event_type, signature]):
        return False, "Missing required headers"

    # Reject stale requests (recommended: 5 min tolerance)
    if abs(int(timestamp) - int(time.time())) > 300:
        return False, "Timestamp out of tolerance"

    expected = f"v1={hmac.new(SECRET.encode(), f'{timestamp}.{raw_body.decode()}'.encode(), hashlib.sha256).hexdigest()}"
    return hmac.compare_digest(signature, expected), None
```

> **Note:** The signature covers `timestamp + "." + raw_body`, not parsed JSON. An older internal note suggested signing parsed JSON; that note is stale and conflicts with the current implementation.

---

## Delivery & Retry Semantics

### Guarantees
- **Delivery attempt**: POST with JSON payload (max 512 KiB)
- **Timeout**: Your endpoint has **10 seconds** to return any `2xx` status
- **Retry triggers**: Timeout, network error, `408`, `425`, `429`, and any `5xx`
- **No retry**: Other `4xx` responses (including `400`, `401`, `403`, `404`)
- **Retry schedule** (approximate): 1 min → 5 min → 30 min → 2 hr → 12 hr
- **Total attempts**: 1 initial + 5 retries = 6 attempts over ~14.5 hours
- **User-Agent**: `Orbit-Hooks/2`

### Recommendations
- Respond `2xx` quickly; offload processing to a queue
- Return `429` with `Retry-After` if you need backpressure
- Treat `425 Too Early` as a transient condition (safe to retry)
- Do not depend on exact retry timing—treat as approximate

---

## Ordering & Idempotency

### Guarantees
- **Event ID** (`X-Orbit-Event`) is stable per event; replays reuse the same ID
- **Duplicates are possible** due to retries and replays

### No Guarantee
- **Delivery order** is not guaranteed. Concurrent retries can cause later events to arrive before earlier ones.

### Recommendations
- Design handlers to be **idempotent** using `X-Orbit-Event`
- Store processed event IDs (with TTL ≥ 7 days to cover replay window)
- Do not rely on `X-Orbit-Timestamp` for ordering; it reflects creation time, not delivery time

---

## Key Rotation

### Guarantees
- **Two secrets valid simultaneously** for 24 hours during rotation
- UI labels: "current" and "previous"
- Replay UI can resend events for **7 days** using the original event ID and signature

### Recommendations
- Support verifying against both current and previous secrets
- Rotate via the UI; do not manually overwrite secrets
- After rotation completes, the old secret is revoked—update your config promptly

---

## Operational Advice

### Security
- **Never log secrets** or full sensitive payloads
- Validate `X-Orbit-Timestamp` within a reasonable window (recommended: ±5 minutes)
- Use constant-time comparison (shown in example above)
- Prefer allowlisting Orbit IP ranges if your infrastructure supports it

### Reliability
- Acknowledge (`2xx`) within 10 s; process asynchronously
- Implement exponential backoff in your own retry logic for downstream dependencies
- Monitor delivery latency and failure rates per event type

### Testing
- Use the replay UI to resend recent events during development
- Test with both current and previous secrets during rotation windows
- Simulate `429`, `5xx`, and timeout responses to verify retry handling

---

## Troubleshooting

| Symptom | Likely Cause | Resolution |
|---------|--------------|------------|
| `401` / signature mismatch | Using wrong secret (old/new during rotation) | Verify against both current and previous secrets |
| `401` / signature mismatch | Signing parsed JSON instead of raw body | Sign `timestamp + "." + raw_body` exactly |
| `401` / signature mismatch | Body modified by middleware (e.g., body parser) | Access raw request bytes before any parsing |
| `408` / timeout | Handler takes >10 s | Offload work to queue; return `202` immediately |
| `429` from your side | No `Retry-After` or too aggressive | Return `Retry-After` header; respect Orbit's backoff |
| Events arriving out of order | Concurrent retries | Normal behavior; use event ID for idempotency |
| Duplicate events | Retries or replay UI | Normal; deduplicate via `X-Orbit-Event` |
| No deliveries for >14.5 hrs | All 6 attempts exhausted | Check endpoint health; use replay UI (7-day window) |
| Redirects not followed | Security policy (unconfirmed) | Use direct endpoint URL; avoid redirects |

---

## Unresolved / Requires Product Confirmation

- **Redirect behavior**: Security believes redirects are not followed; implementation owner has not confirmed. Use direct URLs until confirmed.
- **Exact retry jitter**: Schedule is approximate; no guarantee on jitter or exact timing.
- **IP allowlist ranges**: Not documented here; request current ranges from Orbit support if needed.