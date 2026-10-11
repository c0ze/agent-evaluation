# Orbit webhooks: integration guide

This guide covers how Orbit delivers webhook events to your endpoint, how to verify them, and how to handle retries, duplicates, and key rotation.

Statements under **Guarantee** describe service behavior you can rely on. Statements under **Recommendation** are advice for your receiver. Items under **Pending confirmation** are not final.

## Delivery

**Guarantee**

- Each event is an HTTP `POST` with a JSON body of at most 512 KiB.
- Headers: `X-Orbit-Event` (event ID), `X-Orbit-Type` (event type), `X-Orbit-Timestamp` (Unix seconds), `X-Orbit-Signature` (`v1=<hex>`), and `User-Agent: Orbit-Hooks/2`.
- Any 2xx response within 10 seconds counts as success. The response body is ignored.
- Timeouts, network errors, 408, 425, 429, and 5xx responses are retried. Other 4xx responses are not.
- Between attempts the service waits roughly 1 minute, 5 minutes, 30 minutes, 2 hours, and 12 hours. That is five retries after the first attempt, six attempts in total.

**Not guaranteed:** exactly-once delivery, arrival order, or delivery after the final retry fails. Any event can be resent from the replay UI for 7 days, and a resend keeps the original event ID.

## Verifying signatures

**Guarantee:** the signature is `v1=` followed by the hex HMAC-SHA256, keyed with your endpoint secret, of the string `<X-Orbit-Timestamp>.<raw body>`. Comparison is constant-time.

Older documentation describes signing the parsed JSON. That conflicts with the current implementation, so do not follow it.

```python
import hashlib
import hmac

def verify(secret: str, timestamp: str, raw_body: bytes, signature: str) -> bool:
    signed = f"{timestamp}.".encode() + raw_body
    digest = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return hmac.compare_digest(f"v1={digest}", signature)
```

**Test vector** (a made-up secret, not a real Orbit secret): with secret `test-secret`, timestamp `1700000000`, and body `{"ok":true}`, the signature is `v1=e00af05ced77fd14c24ad92b550cd513693939af637a094ea86bcfc6681451b0`.

**Recommendation:** verify the raw request bytes before any JSON parsing or re-serialization. Parsing and re-serializing can change whitespace or key order, which changes the signed bytes.

**Pending confirmation:** whether `X-Orbit-Timestamp` is set per attempt or from event creation. Until this is confirmed, do not reject deliveries based on timestamp age.

## Ordering and idempotency

**Guarantee:** duplicates are possible. Order usually follows creation but is not guaranteed, because concurrent retries can overtake each other.

**Recommendations:**

- Record each `X-Orbit-Event` you have processed and skip repeats. Keep these records for at least 7 days, the replay window.
- Do not assume arrival order. Check each change against your stored state before applying it.
- Return 2xx for duplicates too, so the service stops retrying.

## Key rotation

**Guarantee:** the secret is shown once, when it is created. After a rotation, two secrets are valid for 24 hours. The UI labels them current and previous.

**Recommendations:**

- Store the secret immediately when it is shown.
- During rotation, accept a signature that matches either secret, then remove the previous secret once the 24-hour window has passed.

**Pending confirmation:** when the 24-hour window starts, and which secret signs deliveries during the overlap.

## Operational advice

- Return 2xx first, then process the event asynchronously. The 10-second limit applies to the response, so do heavy work after returning.
- Accept bodies up to 512 KiB.
- Respond directly at the registered URL. Do not rely on redirects.
- Do not log secrets or full payloads. Log the event ID and type instead.
- Do not treat `User-Agent` as authentication.
- Monitor for failed deliveries, and use the replay UI within 7 days to resend missed events.

## Troubleshooting

| Symptom | Likely cause | Action |
|---|---|---|
| Every signature check fails | Signing parsed or re-serialized JSON, or wrong secret | Verify raw bytes with the timestamp prefix; run the test vector |
| Checks fail after rotation | Stored secret is neither current nor previous | Load the current secret |
| Same event handled twice | Duplicates are possible | Deduplicate on `X-Orbit-Event` |
| Events arrive out of order | Concurrent retries | Check changes against stored state |
| Repeated retries | Response takes over 10 seconds, or returns 408, 425, 429, or 5xx | Return 2xx first, then process |
| No retry after a failure | Non-retried 4xx such as 400, 401, or 404 | Fix the endpoint, then resend from the replay UI within 7 days |
| Redirect responses | Redirect handling is pending confirmation | Respond at the registered URL without redirecting |

## Integration checklist

1. Verify the signature over the raw bytes before parsing.
2. Return 2xx within 10 seconds, then process asynchronously.
3. Deduplicate on `X-Orbit-Event`, keeping records for at least 7 days.
4. Store the secret when it is shown, and accept either secret during rotation.
5. Run the test vector before going live.

## Pending confirmation

- Whether `X-Orbit-Timestamp` reflects the attempt or the event creation time.
- When the 24-hour rotation window starts, and which secret signs during overlap.
- Whether redirects are followed.
- Whether a 2xx that arrives after the 10-second limit counts as success.
- The exact retry timing reference point, and whether retries reuse the original `X-Orbit-Event`.
