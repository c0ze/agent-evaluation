# Orbit Webhooks

Webhooks let your service receive event notifications from Orbit as HTTP POST
requests. This guide covers how to verify deliveries, how delivery and retries
behave, how to handle duplicates and ordering, key rotation, and common
problems.

Throughout this guide, **Guaranteed** marks behavior the platform commits to,
and **Recommended** marks our advice, which is not enforced.

## 1. Verifying signatures

Every delivery includes these headers:

- `X-Orbit-Event` — the unique event ID.
- `X-Orbit-Type` — the event type.
- `X-Orbit-Timestamp` — Unix timestamp (seconds) at signing time.
- `X-Orbit-Signature` — `v1=<hex>`, an HMAC-SHA256 signature.

**Guaranteed:** the signature is HMAC-SHA256, keyed with your webhook secret,
computed over `<timestamp>.<raw request body>` — the timestamp header value, a
literal dot, then the exact raw body bytes as received. Verify against the raw
bytes; do not parse and re-serialize the JSON first.

> Older documentation said the signature was computed over the parsed JSON
> object. That note is stale and conflicts with the current implementation.
> Always sign and verify the raw request body exactly as received.

**Guaranteed:** your webhook secret is shown exactly once, when the endpoint is
created or the secret is rotated. Store it immediately.

Minimal verification example (Python, no framework):

```python
import hashlib
import hmac
import os

def verify(raw_body: bytes, timestamp: str, signature: str) -> bool:
    secret = os.environ["ORBIT_WEBHOOK_SECRET"].encode()
    expected = hmac.new(
        secret, timestamp.encode() + b"." + raw_body, hashlib.sha256
    ).hexdigest()
    received = signature.removeprefix("v1=")
    return hmac.compare_digest(expected, received)
```

Reject the request if verification fails, and use a constant-time comparison
(`hmac.compare_digest` above); a plain `==` leaks timing information.

**Recommended:** also reject deliveries whose `X-Orbit-Timestamp` is too old.
The platform does not publish a maximum accepted age, so choose a tolerance
(for example, five minutes) with your security team. This is a recommendation,
not a platform guarantee.

## 2. Delivery semantics

**Guaranteed:**

- Deliveries are HTTP POST requests with a JSON body.
- Your endpoint has 10 seconds to return any 2xx status. The response body is
  ignored.
- Payloads are at most 512 KiB.
- The `User-Agent` header is `Orbit-Hooks/2`.

**Recommended:** return 2xx as soon as you have durably stored the raw body,
then process asynchronously. Verifying and fully processing within 10 seconds
is possible but leaves little margin for slow dependencies.

## 3. Retries

**Guaranteed:**

- We retry a delivery on timeout, on network error, and on HTTP 408, 425, 429,
  or any 5xx.
- We do not retry other 4xx responses; those are treated as permanent
  failures.
- After the initial attempt there are five retries, at roughly 1 minute,
  5 minutes, 30 minutes, 2 hours, and 12 hours.

**Recommended:** treat the status you return as a decision. A 4xx (other than
408/425/429) means "do not send this event again"; a 5xx or a timeout means
"try again later." Log the `X-Orbit-Event` ID with every failure so you can
correlate with the retry schedule.

## 4. Ordering and idempotency

**Guaranteed:**

- Duplicate deliveries are possible.
- Delivery order usually follows event creation order, but it is not
  guaranteed, because concurrent retries can arrive out of order.
- The replay feature can resend an event for up to 7 days, and a replayed event
  keeps the same `X-Orbit-Event` ID.

**Recommended:** make your handler idempotent by using `X-Orbit-Event` as the
idempotency key — store processed event IDs and skip repeats. Do not infer
creation order from delivery order; if your logic depends on sequence, use
sequence data in the payload.

## 5. Key rotation

**Guaranteed:**

- During rotation, two secrets are valid simultaneously for 24 hours.
- The dashboard labels them current and previous.

**Recommended:** deploy the new secret first and verify with it, accept
signatures from either secret during the 24-hour overlap, and remove the old
secret only after in-flight deliveries have drained. Because each secret is
shown only once, store it at creation time.

## 6. Operational advice

- Never log your webhook secret, and avoid logging full payloads that contain
  sensitive data. Log event IDs and types instead.
- Keep the endpoint reachable: five retries over roughly 14.5 hours are the
  entire safety net for a failing endpoint.
- **Recommended:** alert on repeated signature-verification failures; they
  usually indicate a wrong or stale secret (see the table below).

## 7. Troubleshooting

| Symptom | Likely cause | What to do |
|---|---|---|
| Signature verification fails on every event | Wrong secret, or verifying re-serialized JSON instead of the raw body | Verify `timestamp + "." + raw body`; confirm you use the current secret |
| Signature fails only after rotation | Old secret removed too early, or new secret not yet deployed | Both secrets are valid for 24 h; accept either during the overlap |
| No deliveries at all | Endpoint unreachable, TLS/firewall issue, or no 2xx within 10 s | Check connectivity; confirm a 2xx response within 10 s |
| Events stop after ~14.5 hours of failures | All five retries exhausted | Fix the endpoint, then replay the event from the dashboard (7-day window) |
| Duplicate processing | Retries or a manual replay (same event ID) | Deduplicate on `X-Orbit-Event` |
| Events arrive out of order | Concurrent retries; order is not guaranteed | Do not rely on delivery order; use payload sequence data |
| Endpoint returns 4xx and events stop | 4xx other than 408/425/429 is not retried | Fix the bug, then replay the event from the dashboard |

## 8. Open questions

- **Redirects:** it is not yet confirmed whether the delivery client follows
  HTTP redirects. Our security team believes it does not, but the
  implementation owner has not confirmed. Until product confirms, do not rely
  on redirects — expose the final endpoint URL directly.
