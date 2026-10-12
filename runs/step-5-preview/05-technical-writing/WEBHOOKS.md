# Webhooks

Orbit delivers webhooks as HTTP `POST` requests with a JSON body to an endpoint URL you register in the dashboard. Every delivery is signed so you can confirm it came from Orbit. This guide states what the service guarantees, what it only recommends, and what still requires product confirmation.

## Request format

Each delivery sends these headers:

| Header | Value |
| --- | --- |
| `X-Orbit-Event` | Unique event ID, stable across retries and replays |
| `X-Orbit-Type` | Event type, e.g. `invoice.paid` |
| `X-Orbit-Timestamp` | Unix time (seconds) the request was signed |
| `X-Orbit-Signature` | Signature, format `v1=<hex>` |
| `User-Agent` | `Orbit-Hooks/2` |
| `Content-Type` | `application/json` |

The body is JSON and will not exceed 512 KiB.

## Verifying signatures

The signature is HMAC-SHA256, computed over the signing string — the `X-Orbit-Timestamp` value, a literal `.`, then the raw request body exactly as received — hex-encoded and prefixed with `v1=`.

Minimal example (Python):

```python
import hashlib, hmac

def verify(headers, raw_body, secret):
    signing_string = f'{headers["X-Orbit-Timestamp"]}.'.encode() + raw_body
    expected = hmac.new(secret.encode(), signing_string, hashlib.sha256).hexdigest()
    return hmac.compare_digest(headers["X-Orbit-Signature"], f"v1={expected}")
```

Rules:

- Hash the raw bytes as received. Never parse the JSON and re-serialize it before hashing; different key order or whitespace breaks verification.
- Compare in constant time, as above, to avoid timing leaks.
- Reject requests whose signature header is missing or malformed.
- Never log the signing secret or full request payloads. Log the event ID and type instead.

> **Docs conflict.** Older Orbit documentation describes signing *parsed JSON* without a timestamp. That is stale. The current implementation signs `X-Orbit-Timestamp` + `.` + raw body. If you implemented the old scheme, switch to this one. Whether any events signed under the old scheme remain in flight is an open question (below).

## Delivery and retries

Orbit attempts each delivery once, then retries up to five times, at roughly 1 minute, 5 minutes, 30 minutes, 2 hours, and 12 hours. The schedule is approximate; exact timings are not guaranteed.

A delivery is retried when:

- the connection times out — your endpoint has **10 seconds** to respond;
- a network error occurs; or
- your endpoint returns 408, 425, 429, or any 5xx.

A delivery is **not** retried when your endpoint returns any other 4xx (for example 400, 401, 403, 404, 422). Treat those as permanent failures: that event will not be redelivered automatically.

**Guaranteed vs. recommended.** The service guarantees the retry conditions, the retry count, the 10-second window, acceptance of any 2xx, and that the response body is ignored. It does not guarantee exact retry timing, nor delivery itself: if all attempts fail, the event is not delivered. It is recommended that you return a 2xx first (`204 No Content`) and process asynchronously if handling takes longer than 10 seconds.

## Ordering and idempotency

Events usually arrive in creation order, but concurrent processing and retries mean order is **not** guaranteed, and duplicates happen for the same reasons.

Recommended:

- Deduplicate on `X-Orbit-Event`; treat the event ID as an idempotency key.
- Make handlers order-independent where possible, and reconcile out-of-order updates using timestamps in the payload.

## Secret rotation

Your signing secret is displayed once at creation — store it immediately. Rotation keeps two secrets valid for 24 hours; the dashboard labels them "current" and "previous."

Recommended during the window: store both secrets and accept a signature that verifies against either. Retire the old secret after the window closes. If verification starts failing, check first whether you are still using the previous secret.

## Replay

The dashboard can resend an event for 7 days after it occurs, reusing the same event ID — so your deduplication logic covers replays too.

## Operational advice

- Verify the signature before processing anything.
- Register direct HTTPS endpoint URLs; do not rely on redirects (see below).
- Allowlisting `User-Agent: Orbit-Hooks/2` is a coarse filter only, not authentication.
- Set your endpoint's body-size limit to at least 512 KiB.
- Redact secrets and sensitive fields from logs; log event IDs and types.
- Alert on sustained delivery failures, since events stop after the final retry.

## Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| Signature check fails | You hashed parsed JSON instead of the raw body, omitted the timestamp, or are using a rotated-out secret. Hash raw bytes plus `timestamp.`; try the previous secret during rotation. |
| Events arrive late | Retries fire at roughly 1m/5m/30m/2h/12h; delivery stops only after five failed retries. |
| Duplicate events | Expected from retries and replays. Deduplicate on `X-Orbit-Event`. |
| Events out of order | Order is not guaranteed. Make handlers order-independent. |
| Event never arrives | Your endpoint returned a non-retryable 4xx, so it was not retried. Replay it from the dashboard within 7 days. |
| Endpoint returns 3xx | Redirect handling is unconfirmed. Point the webhook URL directly at the final endpoint. |
| Payload rejected by a proxy | Payloads can be up to 512 KiB; raise body-size limits. |

## Open questions (pending product confirmation)

1. **Redirects.** Does delivery follow 3xx redirects? Security's position is that it should not; the implementation owner has not confirmed. Until confirmed, assume redirects are *not* followed and register direct URLs.
2. **Timestamp tolerance.** No replay-tolerance window for `X-Orbit-Timestamp` is documented, and it is unknown whether the service itself rejects stale timestamps. Choose your own tolerance client-side rather than assuming one.
3. **Legacy signatures.** Are any events signed under the old parsed-JSON scheme still in flight or replayable?
4. **Replay signing.** Is a replayed event re-signed (fresh timestamp, current secret) or is the original signature resent? This affects how strictly you should enforce timestamp freshness.
