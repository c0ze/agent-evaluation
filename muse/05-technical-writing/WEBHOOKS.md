# Receiving Webhooks

Webhooks notify your service about events via HTTP `POST` with a JSON body. This guide covers how to verify, receive, and operate a webhook endpoint.

> **How to read this guide.** Statements marked **[Guarantee]** describe behavior you can rely on. Statements marked **[Recommendation]** are best practices that improve reliability and security.

## Quick start

1. Expose a public HTTPS endpoint that accepts `POST` with a JSON body.
2. Store the signing secret securely when you create it — it is shown once and cannot be retrieved later.
3. Verify the signature and timestamp on every delivery before processing.
4. Return any `2xx` status within 10 seconds. Then process the event idempotently.

Every delivery includes these headers:

| Header | Contents |
|---|---|
| `X-Orbit-Event` | Unique event ID. Stable across retries and replays. |
| `X-Orbit-Type` | Event type (e.g., `order.created`). |
| `X-Orbit-Timestamp` | Unix epoch seconds when the signature was computed. |
| `X-Orbit-Signature` | `v1=<hex>` HMAC-SHA-256 signature (see below). |
| `User-Agent` | Always `Orbit-Hooks/2`. **[Guarantee]** |

Payloads are at most 512 KiB. **[Guarantee]**

## Verifying signatures

**[Guarantee]** The signature is computed over the timestamp, a literal dot, and the raw request body bytes:

```
signed_payload = timestamp + "." + raw_body
signature = HMAC-SHA-256(secret, signed_payload), hex-encoded as v1=<hex>
```

Verify against the **raw bytes** of the body, before JSON parsing. Parsing and re-serializing first will change whitespace or key order and break verification.

> **Note on older documentation.** An older document states the signature covers the parsed JSON. That note is stale and conflicts with the current implementation. This guide follows the current behavior (`timestamp + "." + raw body`). If your existing code verifies parsed JSON, migrate it to raw bytes.

**[Recommendation]** Compare signatures in constant time, enforce HTTPS, and reject deliveries whose timestamp differs from your clock by more than 5 minutes to limit replay risk. Never log the secret or full sensitive payloads; log event IDs and types instead.

Minimal example (Python, standard library only):

```python
import hashlib
import hmac
import time

def verify(raw_body: bytes, timestamp: str, signature: str, secret: str,
           max_skew_seconds: int = 300) -> bool:
    # 1. Freshness check (recommendation)
    try:
        if abs(time.time() - int(timestamp)) > max_skew_seconds:
            return False
    except ValueError:
        return False
    # 2. Recompute over raw bytes (guarantee)
    expected = "v1=" + hmac.new(
        secret.encode(), timestamp.encode() + b"." + raw_body,
        hashlib.sha256).hexdigest()
    # 3. Constant-time comparison (recommendation)
    return hmac.compare_digest(expected, signature)
```

Check `X-Orbit-Signature` starts with `v1=` before comparing. Look up the secret by endpoint, not by anything in the payload.

## Delivery and retry semantics

**[Guarantee]** Your endpoint has **10 seconds** to return any `2xx` status. The response body is ignored.

**[Guarantee]** A delivery is retried on timeouts, network errors, and these status codes: `408`, `425`, `429`, and any `5xx`. Other `4xx` responses are **not** retried — the event is treated as permanently undeliverable to that endpoint.

**[Guarantee]** The retry schedule is approximately **1 min, 5 min, 30 min, 2 h, 12 h** — five retries after the initial attempt (six tries total). Treat intervals as approximate: do not schedule business logic around exact retry times.

**[Recommendation]** Return `200` only after durable receipt (e.g., enqueue to your own queue). Return `429` or `503` when overloaded rather than timing out, since those trigger a scheduled retry. Return `4xx` (other than `408`/`425`/`429`) only when retrying cannot help, such as a permanently misconfigured endpoint path.

## Ordering and idempotency

**[Guarantee]** Deliveries may arrive **more than once** and **out of order**. Creation order is usually preserved, but concurrent retries can reorder events, so ordering is not guaranteed.

**[Recommendation]** Deduplicate on `X-Orbit-Event` (keep seen IDs for at least 7 days plus the maximum retry window), and design handlers to be idempotent — e.g., keyed upserts rather than increments. If event order matters for your use case, buffer by event timestamp or sequence field in the payload and reconcile, rather than assuming arrival order. The manual Replay feature resends with the **same event ID [Guarantee]**, so replays are safe if you deduplicate.

## Secret rotation

**[Guarantee]** During rotation, **two secrets are valid for 24 hours**. The dashboard labels them current and previous.

**[Recommendation]** Rotation procedure:

1. Generate the new secret; both secrets now verify.
2. Update your verifier to try the current secret first, then the previous.
3. Switch your stored primary within 24 hours.
4. Remove the old secret after confirming deliveries verify against the new one.

**[Recommendation]** If verification suddenly fails across all events, check whether a rotation started before assuming an outage.

## Operational advice

- **[Recommendation]** Respond fast, process later: acknowledge within the 10-second window, then do slow work asynchronously.
- **[Recommendation]** Allowlist by `User-Agent: Orbit-Hooks/2` only as a weak hint — always verify the signature for authentication.
- **[Recommendation]** Monitor signature failures, skew rejections, and duplicate rates; alert on a sudden spike, which usually means a secret, clock, or parsing change.
- **[Recommendation]** Keep endpoints idempotent under replay: operators can resend any event for **7 days [Guarantee]**.
- **[Recommendation]** Enforce the 512 KiB expectation defensively and cap JSON parse depth.

## Troubleshooting

| Symptom | Likely cause | Action |
|---|---|---|
| `401`-equivalent signature mismatch on all events | Verifying parsed JSON instead of raw bytes; or secret mismatch | Switch to `timestamp + "." + raw body`; re-check stored secret |
| Signature mismatch after working fine | Secret rotation started | Try previous secret; complete rotation steps |
| Rejected as stale | Clock drift or delayed queue | Sync clocks (NTP); allow 5-min skew; accept-then-reconcile |
| Duplicate processing side effects | Non-idempotent handler | Deduplicate on `X-Orbit-Event`; use keyed upserts |
| Out-of-order state transitions | Assumed arrival order | Buffer and reconcile by payload timestamp/sequence |
| No retries after `4xx` | Only `408`/`425`/`429` and `5xx` retry | Fix the `4xx` cause on your side; other `4xx` never retry **[Guarantee]** |
| Timeouts logged as failures | Handler exceeds 10 s | Acknowledge first, process asynchronously |

## Requires product confirmation

- **Redirects:** whether the sender follows `3xx` redirects is unconfirmed. Until clarified, serve webhooks from the final URL with no redirect. See `RESPONSE.md`.
