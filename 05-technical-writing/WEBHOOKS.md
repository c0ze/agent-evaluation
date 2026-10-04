# Orbit Webhooks — Developer Guide

Orbit delivers event notifications to your HTTP endpoint as POST requests with a JSON body. This guide covers signature verification, delivery semantics, retries, ordering, key rotation, and operational best practices.

## Endpoint requirements

- Accept POST requests with a JSON body of up to **512 KiB**.
- Respond with any `2xx` within **10 seconds**. The response body is ignored; only the status code is used to mark the delivery as successful.
- The `User-Agent` header is set to `Orbit-Hooks/2`. Allowlist it if you filter by client.

## Request headers

| Header | Description |
| --- | --- |
| `X-Orbit-Event` | Stable event id (e.g. `evt_01H...`). Use this as your idempotency key. |
| `X-Orbit-Type` | Event type (e.g. `order.created`). |
| `X-Orbit-Timestamp` | Unix seconds, in UTC, at signing time. |
| `X-Orbit-Signature` | `v1=<hex>` — HMAC SHA-256 over `timestamp + "." + raw_body`. |

> ⚠️ **Sign the raw bytes of the request body**, not a re-serialized or parsed JSON object. Our earlier integration guide stated otherwise; that note is stale. If you have a verifier built from the older guide, rebuild it against this one.

## Verifying a signature

```python
import hmac, hashlib, time

SECRET = b"<your-webhook-secret>"
TOLERANCE = 300  # seconds; recommendation, not enforced by Orbit

def verify(raw_body: bytes, sig_header: str, ts_header: str, event_id: str) -> bool:
    ts = int(ts_header)
    if abs(time.time() - ts) > TOLERANCE:
        return False  # reject stale or future-dated requests
    expected = "v1=" + hmac.new(
        SECRET, f"{ts}.".encode() + raw_body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, sig_header)
```

The signing secret is shown **once** when it is generated. Store it in your secret manager immediately — Orbit cannot retrieve it later.

## Delivery and retries

After the initial attempt, Orbit retries on:

- Network errors (DNS, connection refused, TLS handshake, read timeout).
- A response timeout (no `2xx` within 10 seconds).
- HTTP `408`, `425`, `429`, and any `5xx`.

Other `4xx` codes are treated as permanent failures — **they are not retried**. Your endpoint should return `2xx` for any event it has durably accepted, even if business logic will skip it.

The retry schedule is approximately **1 minute, 5 minutes, 30 minutes, 2 hours, and 12 hours** after the previous attempt. Five retries follow the initial try.

> The schedule above is approximate. Jitter and concurrent retry workers may shift exact timings by minutes. Do not rely on a fixed wall-clock interval between attempts.

## Ordering and idempotency

Delivery order **usually follows event creation**, but it is not guaranteed: concurrent retries mean an earlier event can arrive after a later one, and a `4xx` followed by retry after a configuration change can break sequence too. Build idempotent receivers keyed on `X-Orbit-Event`. A retry of the same event always carries the same id, and the dashboard's replay feature reuses the original id as well.

## Key rotation

You may have up to two active secrets at any time. The dashboard labels them **Current** and **Previous**. When you generate a new one, both stay valid for **24 hours**, giving you a window to roll your verifier. After 24 hours, the Previous secret stops signing deliveries and may be removed.

## Replay

The dashboard can resend any event from the last **7 days**. Replays reuse the original `X-Orbit-Event`, so your idempotency key handles them exactly like a retry.

## Operational advice

- **Log only event ids and types**, not full bodies. Webhook payloads often contain personal or financial data.
- Store the signing secret in a secret manager (Vault, AWS Secrets Manager, GCP Secret Manager). Never commit it.
- Set any reverse-proxy body size cap above 512 KiB, otherwise valid Orbit deliveries will be rejected upstream.
- Monitor `5xx` and timeout rates per integration. Sudden spikes usually indicate a deploy regression on your side.
- Return `2xx` as soon as you have durably enqueued the event; do heavy work asynchronously.
- Treat the retry schedule as approximate — design for at least 24 hours of retryable backlog.

## Troubleshooting

| Symptom | Likely cause | Action |
| --- | --- | --- |
| Signature verification always fails | Body was parsed/re-serialized before hashing | Sign the raw bytes off the wire; do not `JSON.parse` first |
| Valid signature rejected | Clock skew between your host and Orbit | Verify system clock is within 5 minutes of UTC |
| Events arrive minutes after creation | Retries in flight after a transient failure | Treat all `X-Orbit-Event` as idempotency keys; do not assume ordering |
| Endpoint consistently times out at 10s | Synchronous work blocking the response | Return `2xx` first, then process via a queue |
| Event marked `payload_too_large` | Body exceeded 512 KiB | Stream the data, or split into smaller events |
| Signature fails after secret rotation | Old secret still active, new one not deployed | Deploy the new secret and verify both during the 24-hour window |
| Replayed event rejected by verifier | Old `X-Orbit-Timestamp` outside your tolerance | Widen tolerance slightly, or pin replay-window length with product |

## Open questions requiring product confirmation

- **HTTP redirects**: Our security guidance recommends not following them. The implementation owner has not confirmed whether redirects are followed. If your endpoint issues `301`/`302` to another host, treat delivery as best-effort until Orbit confirms the behavior.
- **Old-doc conflict**: The previous integration guide described signing parsed JSON. That guidance is stale. If your team or any downstream customer has documents referencing the old behavior, flag them for update.