# Receiving Orbit Webhooks

Orbit delivers event notifications to your endpoint as HTTP `POST` requests
with a JSON body. This guide covers how to verify deliveries, what delivery
behavior is guaranteed, and how to operate a robust receiver. Throughout,
**guarantees** describe behavior the service commits to; **recommendations**
are operational advice you should follow but that the service does not enforce.

## Delivery format

Each delivery is a `POST` with these headers:

| Header | Meaning |
|---|---|
| `X-Orbit-Event` | Unique event ID. Stable across retries and replays. |
| `X-Orbit-Type` | Event type (e.g., `invoice.paid`). |
| `X-Orbit-Timestamp` | Unix seconds when the delivery was signed. |
| `X-Orbit-Signature` | `v1=<hex>` — HMAC-SHA-256 signature (see below). |

Requests are sent with `User-Agent: Orbit-Hooks/2`. Payloads are capped at
**512 KiB**.

## Verifying signatures (guarantee)

Orbit signs every delivery with the endpoint secret shown to you **once** in
the dashboard. The signed content is:

```
<X-Orbit-Timestamp> + "." + <raw request body bytes>
```

Compute HMAC-SHA-256 over that exact string with your secret, hex-encode it,
and compare it against the `<hex>` value in `X-Orbit-Signature` (after the
`v1=` prefix) using a **constant-time comparison**.

Two details matter:

1. **Sign the raw bytes, not parsed JSON.** Re-serializing a parsed body
   changes whitespace and key order and will produce mismatches. (Older
   documentation described signing the parsed JSON; that guidance is stale —
   the current implementation signs `timestamp + "." + raw body` as above.)
2. **Check the timestamp** (recommendation): reject deliveries whose
   `X-Orbit-Timestamp` is more than a few minutes old to limit replay
   windows. Since the timestamp is part of the signed content, an attacker
   cannot alter it without invalidating the signature.

### Minimal verification example (Python/Flask)

```python
import hashlib, hmac, time
from flask import Flask, request, abort

app = Flask(__name__)
SECRET = b"whsec_..."          # store in a secret manager, never in code
MAX_SKEW = 300                  # 5 minutes

@app.post("/webhooks/orbit")
def orbit_hook():
    ts = request.headers.get("X-Orbit-Timestamp", "")
    sig = request.headers.get("X-Orbit-Signature", "")
    body = request.get_data()   # raw bytes — do not parse first

    expected = "v1=" + hmac.new(
        SECRET, f"{ts}.".encode() + body, hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(expected, sig):
        abort(401)
    if abs(time.time() - int(ts)) > MAX_SKEW:
        abort(401)

    event_id = request.headers["X-Orbit-Event"]
    # ... enqueue / process idempotently (see below) ...
    return "", 204
```

**Recommendation:** never log your signing secret or full payloads containing
sensitive data. Log the event ID and type instead.

## Responding and retries

Your endpoint has **10 seconds** to respond with any **2xx** status. The
response body is ignored, so return quickly (a bare `204` is fine) and process
the event asynchronously.

### What is retried (guarantee)

Orbit retries a delivery when your endpoint:

- times out or fails at the network level (connection refused, reset, DNS), or
- returns `408`, `425`, `429`, or any `5xx` status.

Other `4xx` statuses are **not** retried — they are treated as permanent
rejections. If your endpoint cannot accept a class of events, return a
non-retryable 4xx deliberately rather than letting the delivery retry to
exhaustion.

There are **five retries after the initial attempt** (six attempts total), on
an approximate schedule of **1 minute, 5 minutes, 30 minutes, 2 hours, and
12 hours** after the previous attempt. Treat these intervals as approximate;
do not build logic that depends on exact timing.

## Ordering, duplicates, and idempotency

- **Duplicates are possible.** At-least-once delivery plus retries means the
  same event can arrive more than once.
- **Order is not guaranteed.** Delivery usually follows event creation order,
  but concurrent retries can reorder events.

**Recommendation:** make your handler idempotent. Before processing, check
whether you have already processed the `X-Orbit-Event` ID; store processed
IDs (e.g., in a database table or cache) and skip duplicates. Where ordering
matters, use a monotonic field inside the payload (such as an updated-at
timestamp or version) to discard stale events rather than assuming arrival
order is authoritative.

## Secret rotation

Orbit supports zero-downtime rotation: **two secrets are valid at the same
time for 24 hours**, labeled *current* and *previous* in the dashboard. To
rotate:

1. Generate a new secret in the dashboard. The old secret remains valid as
   *previous* for 24 hours.
2. Update your receiver to accept signatures from **both** secrets during the
   overlap (try the new secret first, fall back to the old).
3. After the 24-hour window, remove the old secret from your configuration.

## Replays

The dashboard replay UI can resend any event for up to **7 days**. Replays
use the **same event ID** as the original delivery, so the idempotency check
above also protects you from accidental reprocessing of replays — or, if you
want replays to reprocess, you can distinguish them operationally by forcing
a reprocess of a known ID rather than by trusting that replays look
different.

## Operational recommendations

- Return `2xx` within 10 seconds; offload work to a queue.
- Monitor your 4xx/5xx rates; sustained 5xx burns through the retry schedule
  and events are dropped after the final attempt.
- Alert on signature-verification failures — they indicate a wrong secret or
  possible tampering.
- Serve a stable, publicly reachable HTTPS URL. Whether Orbit follows HTTP
  redirects (3xx) is **unconfirmed**; do not rely on redirects. If your URL
  changes, update the endpoint configuration in the dashboard instead.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Signature always mismatches | Body parsed/re-serialized before hashing, or wrong secret | Hash `timestamp + "." + raw body`; confirm current/previous secret |
| Signature fails only during rotation | Receiver only knows one secret | Accept both secrets during the 24-hour overlap |
| Deliveries stop after ~13.5 hours | All 6 attempts exhausted (5xx/timeout) | Fix endpoint health; use replay UI (events kept 7 days) |
| Same event processed twice | Retried delivery or replay not deduplicated | Deduplicate on `X-Orbit-Event` |
| Events arrive out of order | Concurrent retries | Use payload timestamps/versions, not arrival order |
| Non-retryable error keeps resending | Your endpoint returns 408/429/5xx or times out | Return a different 4xx for permanent rejections |
| Requests rejected as too large | Payload over 512 KiB | Not fixable receiver-side; contact Orbit about payload size |

## Open item

- **Redirect handling:** whether Orbit follows 3xx redirects is not confirmed
  by the implementation owner. Until it is, assume redirects are *not*
  followed and keep endpoint URLs stable.
