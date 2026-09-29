# Orbit Webhooks: Delivery Guide

This guide covers how Orbit delivers webhooks, how to verify them, and how to build a receiver that tolerates retries, duplicates, and reordering.

Statements are labeled:

- **Guarantee**: behavior Orbit commits to. You can depend on it.
- **Recommendation**: our advice. Nothing enforces it.
- **Unconfirmed**: not yet confirmed by Orbit product or engineering. Do not build on it. See [Open items](#open-items).

## Request format

**Guarantee.** Each delivery is an HTTP `POST` with a JSON body of at most 512 KiB and the User-Agent `Orbit-Hooks/2`.

| Header | Value |
|---|---|
| `X-Orbit-Event` | Unique event ID (not the event type) |
| `X-Orbit-Type` | Event type |
| `X-Orbit-Timestamp` | Unix time in seconds |
| `X-Orbit-Signature` | `v1=<hex>` HMAC-SHA-256 signature |

**Recommendation.** Make sure your framework and any gateway in front of it accept bodies up to 512 KiB. Do not authenticate by User-Agent; verify the signature.

## Verify signatures

**Guarantee.** The signature is the hex HMAC-SHA-256, keyed with your signing secret, of the `X-Orbit-Timestamp` value, a literal `.`, and the raw request body bytes:

```
v1=<hex( HMAC_SHA256(secret, timestamp + "." + raw_body) )>
```

> **Conflict with older docs.** Documentation from the previous system says to sign the *parsed JSON*. That is stale and contradicts the current implementation. Follow this guide, and do not add a parsed-JSON fallback.

```python
import hashlib, hmac

def verify(raw_body: bytes, headers, secrets: list[bytes]) -> bool:
    sent = headers["X-Orbit-Signature"]
    if not sent.startswith("v1="):
        return False
    signed = headers["X-Orbit-Timestamp"].encode() + b"." + raw_body
    for secret in secrets:  # current + previous during rotation
        expected = "v1=" + hmac.new(secret, signed, hashlib.sha256).hexdigest()
        if hmac.compare_digest(expected.encode(), sent.encode()):
            return True
    return False
```

- **Recommendation.** Read the raw bytes before any JSON parsing or middleware.
- **Recommendation.** Compare in constant time, as above. Reject failures with a 4xx; it will not be retried.
- **Unconfirmed.** We assume the key is the secret exactly as displayed, as UTF-8 bytes, and that the header carries a single `v1=` value.

## Delivery and retries

**Guarantees**

- A delivery succeeds only if your endpoint returns a 2xx within 10 seconds. The response body is ignored.
- Orbit retries after a timeout, a network error, or a `408`, `425`, `429`, or 5xx response.
- Orbit does not retry any other 4xx.
- There are up to five retries after the first attempt, at roughly 1 minute, 5 minutes, 30 minutes, 2 hours, and 12 hours. Intervals are approximate.
- The dashboard can replay an event for 7 days. A replay uses the same event ID.

Retries are not a delivery guarantee. Once they are exhausted, Orbit does not resend automatically. If each interval runs from the previous attempt, the last retry lands about 14.5 hours after the first attempt (**Unconfirmed**).

**Unconfirmed: redirects.** Security review believes redirects are not followed; the implementation owner has not confirmed. Register your final URL and never answer with a redirect.

## Ordering, duplicates, and idempotency

**Guarantee.** Duplicates are possible. Delivery order usually follows creation order, but concurrent retries mean order is **not** guaranteed.

**Recommendations**

1. Deduplicate on `X-Orbit-Event`. Use an atomic insert-if-absent (for example a unique constraint), because duplicate deliveries can arrive concurrently.
2. Mark an event done only after your processing commits. If you record it on receipt and processing then fails, the retry or replay is discarded as a duplicate.
3. Do not let an older event overwrite newer state, and do not infer order from arrival time or `X-Orbit-Timestamp` (its meaning on retries is unconfirmed).
4. Expect replays to look like duplicates. Idempotent handlers make them safe.

## Key rotation

**Guarantee.** After a rotation, two secrets are valid for 24 hours. The dashboard labels them current and previous. A secret is shown only once.

**Recommended procedure**

1. Rotate and copy the new secret immediately.
2. Deploy a receiver that tries both secrets, as in the example.
3. After 24 hours, check for verification failures, then remove the previous secret.

**Unconfirmed.** Which secret signs during the overlap, so accept both. Also whether the previous secret can be revoked early; if you suspect compromise, contact us.

## Operating your endpoint

- **Recommendation: acknowledge fast.** Verify, durably enqueue, return `200` or `204`, then process asynchronously. Ten seconds is a ceiling.
- **Recommendation: choose status codes deliberately.** Use 5xx for temporary trouble you want retried. A 4xx caused by your own misconfiguration (a `401` from a wrong secret, say) is not retried; fix it, then replay.
- **Recommendation: monitor.** Alert on non-2xx rates and signature failures. After an outage longer than the retry span, replay missed events within 7 days.
- **Recommendation: protect data.** Never log signing secrets or commit them to source control. Avoid logging full payloads, which may be sensitive. Log event ID, type, and outcome.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Every signature fails | Following old docs (parsed JSON), or omitting the timestamp | Sign `timestamp + "." + raw_body` |
| Only some signatures fail | Middleware altered or re-serialized the body | Capture raw bytes before parsing |
| Failures right after rotation | Only one secret configured, or a truncated copy | Accept both secrets for 24 hours |
| Same event processed twice | No deduplication, or a check-then-insert race | Atomic dedupe on `X-Orbit-Event` |
| Events arrive out of order | Ordering is not guaranteed | Make handlers order-tolerant |
| Endless retries | No 2xx within 10 seconds, or a 5xx/`429` | Return 2xx early; process asynchronously |
| Event never retried | Your endpoint returned a non-retryable 4xx | Fix it and replay within 7 days |
| `413` or truncated bodies | Gateway limit below 512 KiB | Raise the body limit |
| Events missing after an outage | Retries exhausted | Replay from the dashboard within 7 days |
| Redirect response | Endpoint URL moved | Register the final URL (redirect handling is unconfirmed) |

## Open items

These need product confirmation.

1. Are redirects followed?
2. Secret key encoding, and whether the signature header can carry multiple values.
3. Which secret signs during rotation overlap, and whether early revocation exists.
4. Whether the timestamp is refreshed on retries and replays. Until then, we cannot recommend a freshness window.
5. Whether retries reuse the event ID. Replays do; retries are assumed to.
6. What happens after the final retry fails.
