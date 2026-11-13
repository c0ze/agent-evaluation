# Orbit webhook delivery guide

Orbit notifies your application of events by sending an HTTP `POST` with a JSON body to an endpoint you register.

Every statement in this guide is labelled by how far you can rely on it:

- **Guaranteed**: behaviour Orbit commits to. Build on it.
- **Recommended**: our advice. Orbit does not enforce it.
- **Unconfirmed**: awaiting product confirmation. Do not depend on it. These items are collected under [Open questions](#open-questions).

## Request format

**Guaranteed**

| Header | Value |
|---|---|
| `X-Orbit-Event` | Event ID. A replay carries the same ID as the original. |
| `X-Orbit-Type` | Event type. |
| `X-Orbit-Timestamp` | Unix time in seconds. Part of the signed message. |
| `X-Orbit-Signature` | `v1=<hex>`, a hex-encoded HMAC-SHA-256 signature. |
| `User-Agent` | `Orbit-Hooks/2` |

The body is JSON and at most 512 KiB.

**Recommended**: authenticate requests by signature only. Anyone can send the `User-Agent` value.

## Verify the signature

**Current implementation** (see the conflict note below): the signature is an HMAC-SHA-256, keyed with your signing secret, over three parts joined in this order:

1. the `X-Orbit-Timestamp` value
2. a literal `.`
3. the raw request body

Use the body bytes exactly as received. Re-serialising the JSON changes them and breaks verification.

> **Conflict with older documentation.** Documentation from the previous system says the signature covers the *parsed JSON*. That contradicts the current implementation described above. The older text is probably stale, but this is not yet confirmed.

```python
import hashlib
import hmac


def verify(secrets, timestamp, signature, raw_body):
    """secrets: list of str. timestamp, signature: header values or None.
    raw_body: bytes, exactly as received."""
    if not timestamp or not signature:
        return False
    scheme, _, received = signature.partition("=")
    if scheme != "v1":
        return False
    message = timestamp.encode() + b"." + raw_body
    for secret in secrets:
        expected = hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()
        if hmac.compare_digest(expected.encode(), received.lower().encode()):
            return True
    return False
```

**Recommended**

- Verify before you parse the body.
- Compare in constant time, as `hmac.compare_digest` does, never with `==`.
- Never log secrets or full payloads, which may contain sensitive data. Log the event ID, type and outcome instead.

**Unconfirmed**: the example uses the secret string's UTF-8 bytes as the key and accepts hex in either case. Whether the timestamp is refreshed on retries and replays is also unconfirmed, so do not reject requests for timestamp age yet: you could discard legitimate retries.

## Delivery and retries

**Guaranteed**

- A delivery succeeds when your endpoint returns any `2xx` within 10 seconds. The response body is ignored.
- Orbit retries after a timeout, a network error, or a `408`, `425`, `429` or `5xx` response.
- Orbit does not retry any other `4xx` response.
- Orbit makes at most five retries after the initial attempt: six attempts in total.

**Not guaranteed**: the retry delays, which are roughly 1 minute, 5 minutes, 30 minutes, 2 hours and 12 hours.

**Unconfirmed**: whether Orbit follows redirects, whether it honours `Retry-After`, and what happens to an event after the sixth failed attempt.

## Ordering and idempotency

**Not guaranteed**

- Exactly-once delivery. The same event can arrive more than once.
- Ordering. Deliveries usually follow creation order, but concurrent retries can reorder them.

**Recommended**

- Deduplicate on `X-Orbit-Event`. Record the ID once processing succeeds, and answer later copies with `2xx` without reprocessing.
- Keep processed IDs for at least 7 days, the replay window.
- Make handlers safe to run twice and in any order.

## Rotating secrets

**Guaranteed**

- A secret is displayed once, when it is issued.
- After a rotation, two secrets are valid for 24 hours. The dashboard labels them *current* and *previous*.

**Unconfirmed**: which secret signs deliveries during the 24 hours.

**Recommended**

1. Make your receiver accept a list of secrets, as `verify` does above.
2. Rotate in the dashboard and store the new secret immediately.
3. Add it to your receiver alongside the old one without delay. Assume Orbit starts signing with the new secret at once.
4. Remove the old secret after 24 hours.
5. Check for deliveries that failed verification between steps 2 and 3, and replay them.

## Operational advice

All **recommended**.

- **Acknowledge first, process later.** Verify, store the event durably, return `2xx`, then process asynchronously.
- **Choose status codes deliberately.** Return `5xx` for failures on your side that should be retried. Return a non-retried `4xx`, such as `401` for a bad signature, only when you never want that request again.
- **Allow 512 KiB bodies** at every hop, including proxies. A `413` from your own stack is not retried.
- **Register the final URL**, served over HTTPS. Do not rely on redirects.
- **Monitor** signature failures and response times against the 10-second limit.
- **Recover with replay.** The replay UI can resend an event for 7 days. Replays reuse the event ID, so deduplication skips events you already processed.

## Troubleshooting

| Symptom | Likely cause | Action |
|---|---|---|
| Signature never matches | Signing parsed or re-serialised JSON, or omitting the timestamp and `.` | Sign `timestamp.raw_body` using the raw bytes |
| Signature matches locally, fails in production | Middleware alters the body before your handler | Capture the body before anything parses it |
| Signatures fail after a rotation | Receiver holds only one secret | Accept both secrets for 24 hours |
| Same event processed twice | Retry or replay without deduplication | Deduplicate on `X-Orbit-Event` |
| Retries although processing succeeded | Response took over 10 seconds, or was not `2xx` | Acknowledge before processing |
| Failed delivery is never retried | You returned a non-retried `4xx` | Fix the cause, then replay within 7 days |
| Event missing after a long outage | All six attempts failed | Replay within 7 days |

## Open questions

These need product confirmation.

1. **Signing input.** Older documentation (parsed JSON) contradicts the current implementation (timestamp, `.`, raw body).
2. **Redirects.** Security expects they are not followed. The implementation owner has not confirmed.
3. **Timestamp.** Whether it is refreshed per attempt, and whether receivers should enforce a tolerance.
4. **Rotation.** Which secret signs during the overlap, and whether retries are re-signed.
5. **Retries.** Exact delays, `Retry-After` handling, and what happens after the final attempt.
6. **Encoding.** Secret key encoding and hex case.
7. **Size limit.** What happens to an event that would exceed 512 KiB.
8. **Replay window.** When the 7 days start.
