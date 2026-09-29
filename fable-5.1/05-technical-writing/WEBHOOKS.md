# Orbit webhooks

Orbit notifies your service of events by sending HTTP requests to a URL you configure.

**Conventions.** *Guarantee* marks service behaviour you can rely on. *Recommendation* marks our advice for your receiver. *Unconfirmed* marks behaviour awaiting product confirmation; do not build on it.

## Request format

*Guarantee.* Every delivery is an HTTP `POST` with a JSON body of at most 512 KiB and the `User-Agent` `Orbit-Hooks/2`. Each request carries:

| Header | Meaning |
|---|---|
| `X-Orbit-Event` | Unique event id; identical across retries and replays. |
| `X-Orbit-Type` | Event type. |
| `X-Orbit-Timestamp` | Unix time in seconds when the request was signed. |
| `X-Orbit-Signature` | `v1=<hex>`: HMAC-SHA-256 of the signed message, using your endpoint secret. |

## Verifying signatures

*Guarantee.* The signed message is the `X-Orbit-Timestamp` value, a literal `.`, and the raw request body bytes exactly as received. Verify before your framework parses or re-serialises the body; any change to whitespace or key order breaks verification. (Older documentation described signing the parsed JSON. That description is believed stale; see *Unconfirmed*.)

*Recommendation.* Compare digests in constant time, accept either the current or the previous secret (see *Rotating secrets*), and reject stale timestamps to limit replay attacks.

```python
import hashlib, hmac, time

TOLERANCE_SECONDS = 300  # recommendation; see Unconfirmed

def verify(headers, raw_body: bytes, secrets: list[str]) -> bool:
    ts = headers["X-Orbit-Timestamp"]
    sig = headers["X-Orbit-Signature"]
    if not sig.startswith("v1=") or abs(time.time() - int(ts)) > TOLERANCE_SECONDS:
        return False
    message = ts.encode() + b"." + raw_body
    for secret in secrets:  # [current, previous] during rotation
        expected = hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()
        if hmac.compare_digest(expected, sig[3:]):
            return True
    return False
```

Reject failures with `401`; it is not retried, which is right for a bad signature. If you rejected genuine deliveries (for example during a rotation gap), use replay. Never log secrets, signatures or full payloads.

## Delivery, timeouts and retries

*Guarantee.* Your endpoint has 10 seconds to return any `2xx` status; the response body is ignored. A delivery is retried after a connection error, a timeout, or a `408`, `425`, `429` or `5xx` response. Any other `4xx` is final and is not retried. Up to five retries follow the initial attempt, with roughly 1 minute, 5 minutes, 30 minutes, 2 hours and 12 hours of backoff; expect the last retry 12–15 hours after the first attempt.

After the last retry or a final `4xx`, the event is not delivered again automatically; you can resend it from the replay UI for 7 days, with the same event id.

*Recommendation.* Return `2xx` as soon as the event is durably queued, then process it asynchronously; keep slow work out of the 10-second window. Return `5xx` (or `429` when overloaded) to request a retry, and a final `4xx` only for requests you can never process.

## Ordering and idempotency

*Guarantee.* You may receive the same event more than once; retries, replays and concurrent delivery all produce duplicates. Deliveries usually arrive in creation order, but this is not guaranteed; a retried older event can arrive after a newer one.

*Recommendation.*

- Treat `X-Orbit-Event` as the idempotency key. Claim the id atomically before acting (release it if processing fails), and skip ids you have already seen.
- Keep those records for at least the 7-day replay window plus the retry window, so 8 days or more.
- Do not infer state from event order; where current state matters, treat the event as a signal and re-read the resource from your source of truth.
- A replay is an intentional duplicate: to reprocess an event, clear your record for its id first, or deduplication will drop it.

## Rotating secrets

*Guarantee.* The endpoint secret is shown once, when created. After you rotate, the previous and current secrets are both valid for 24 hours (the UI labels them *current* and *previous*); after that, only the current secret is valid.

*Recommendation.*

1. Store the secret in a secrets manager when it is shown; it cannot be retrieved later.
2. Verify against a list of secrets, as in the example.
3. Rotate in the UI, add the new secret to the list immediately, and deploy.
4. Once deliveries verify against the new secret, remove the old one, within 24 hours.
5. Replay any deliveries rejected between rotation and deploy.

Rotate immediately if a secret may have been exposed, for example in logs.

## Operating a receiver

*Recommendation.*

- Use an HTTPS URL that answers directly. Do not rely on redirects (see *Unconfirmed*).
- Accept request bodies of at least 512 KiB. A `413` from your server is a final `4xx` and will not be retried.
- Read the raw body before your framework parses it, and verify before any other processing.
- Log event id, type and outcome only; payloads may contain personal or sensitive data.
- Alert on rising failure or duplicate rates, and check the replay UI for failed deliveries; replay is available for only 7 days.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Signature never verifies | Body parsed or re-serialised before hashing; wrong secret | Hash the raw bytes; check the current secret in the UI |
| Verification fails after rotation | Old secret removed early, or new one not deployed | Add the current secret; replay rejected events |
| Deliveries fail with no retries | Your endpoint returned a final `4xx` (`401`, `404`, `413`) | Fix the cause; use replay |
| Deliveries time out | Handler exceeds 10 seconds | Queue, then return `2xx` |
| Same event arrives twice | Retry or replay; expected | Deduplicate on the event id |
| Events out of order | Expected | Do not depend on order |
| Nothing arrives | URL wrong, redirecting, or blocked | Use the final HTTPS URL; allow `Orbit-Hooks/2` |
| Replays rejected | Your timestamp tolerance (see *Unconfirmed*) | Widen the tolerance while replaying |

## Unconfirmed

These await product confirmation; the guide takes the conservative reading of each.

- **Signature input.** Older documentation says the parsed JSON is signed; the current implementation signs `timestamp.rawbody`. This guide documents the current implementation.
- **Redirects.** Believed not to be followed. Use a URL that responds directly; a `3xx` may count as a failed delivery.
- **Rotation window.** Whether deliveries during the 24-hour window carry one signature or two. Verifying against both secrets works either way.
- **Replay timestamps.** Whether a replay carries a fresh `X-Orbit-Timestamp`. If not, a timestamp tolerance rejects replays.
