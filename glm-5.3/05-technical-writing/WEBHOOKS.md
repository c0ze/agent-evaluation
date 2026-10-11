# Orbit Webhooks: Integration Guide

This guide explains how Orbit delivers webhook events, how to verify them, and
how to handle failures, duplicates, and key rotation.

Statements labeled **Guarantee** describe behavior you can rely on when
building your integration. Statements labeled **Recommendation** are strong
advice, not enforced by the service. Items labeled **Unconfirmed** are not
committed behavior — do not build on them until Orbit confirms them.

## Receiving deliveries

Orbit sends events as HTTP `POST` requests with a JSON body.

**Guarantee:** A payload is at most 512 KiB. Requests identify themselves with
`User-Agent: Orbit-Hooks/2` and carry these headers:

| Header | Meaning |
|---|---|
| `X-Orbit-Event` | Event id. The same event keeps this id across retries and replays. |
| `X-Orbit-Type` | Event type name. |
| `X-Orbit-Timestamp` | Send time, in Unix seconds. |
| `X-Orbit-Signature` | HMAC signature; see [Verifying signatures](#verifying-signatures). |

**Guarantee:** Your endpoint must return a `2xx` status within **10 seconds**
of receiving a request. The response body is ignored.

**Recommendation:** Acknowledge immediately and process asynchronously.
Anything close to the 10-second limit risks spurious retries and duplicate
traffic.

**Unconfirmed:** Whether Orbit follows HTTP redirects. Do not rely on them —
have your endpoint URL return `2xx` itself.

## Verifying signatures

**Guarantee:** `X-Orbit-Signature` has the form `v1=<hex>`. It is an HMAC
SHA-256 digest, keyed with your signing secret, over the string
`<X-Orbit-Timestamp>` + `"."` + the **raw request body**.

> An older internal document described signing a *parsed* JSON object. That
> description is stale; the current implementation signs the timestamp and raw
> body as specified above. If your integration predates this change, confirm
> with support before relying on either scheme.

**Guarantee:** The signing secret is shown only once, when it is created or
rotated. Store it in a secrets manager immediately.

**Recommendation:** Never log the secret, and be selective about logging
payloads — event bodies can contain sensitive data.

Minimal verification (Python):

```python
import hashlib, hmac, time

def verify_orbit(secret: bytes, timestamp: str, raw_body: bytes,
                 signature: str, tolerance: int = 300) -> bool:
    # Freshness check is a receiver-side recommendation,
    # not a documented service guarantee.
    if abs(time.time() - int(timestamp)) > tolerance:
        return False
    mac = hmac.new(secret, f"{timestamp}.".encode() + raw_body, hashlib.sha256)
    return hmac.compare_digest(f"v1={mac.hexdigest()}", signature)
```

Two requirements deserve emphasis. First, compute the HMAC over the **raw**
request bytes; re-serializing parsed JSON will not match. Second, include the
timestamp prefix. Use a constant-time comparison, as in the example.

**Recommendation:** Reject deliveries whose timestamp is far from the present,
as shown. The 300-second tolerance is illustrative; Orbit has not documented a
service-side tolerance.

## Retries

**Guarantee:** A delivery attempt is retried on timeout, network error, `408`,
`425`, `429`, and any `5xx`. Any other `4xx` is treated as a permanent failure
and is not retried.

**Guarantee:** Failed deliveries are retried up to **five times** after the
initial attempt, at intervals of roughly 1 minute, 5 minutes, 30 minutes,
2 hours, and 12 hours. The schedule is approximate — treat it as "over the
course of about 12 hours," not as a precise backoff contract.

**Guarantee:** Once retries are exhausted, delivery stops permanently for that
event.

**Guarantee:** The replay UI can resend any event for **7 days** after it was
first delivered, using the same event id.

## Ordering, duplicates, and idempotency

**Guarantee:** Orbit may deliver the same event more than once. Duplicates are
expected behavior, not an error.

**Guarantee:** Delivery usually follows event creation order, but concurrent
retries mean **ordering is not guaranteed**.

**Guarantee:** The same event always carries the same `X-Orbit-Event` id —
across the initial delivery, retries, and replays. This makes the id a safe
idempotency key.

**Recommendation:** Store processed event ids and skip ones you have already
handled. If ordering matters to you, derive order from fields inside the event
payload rather than from arrival order.

## Key rotation

**Guarantee:** After a rotation, both the current and the previous secrets are
accepted for **24 hours**. The dashboard labels each secret accordingly. When
the window closes, only the current secret is accepted.

**Recommendation:** Update your verification to accept both secrets as soon as
you rotate, and finish migrating well before the 24-hour window closes. The
new secret is displayed only once, so store it immediately.

## Operational advice

- Return `2xx` quickly, from a stable URL that never issues redirects.
- Verify every delivery before processing it, with a constant-time comparison.
- Make handlers idempotent, keyed on `X-Orbit-Event`.
- Never log secrets; log only minimal payload fields when debugging.
- Monitor delivery outcomes. If retries are exhausted, fix the endpoint and
  replay the event within the 7-day window.
- Rotate secrets periodically and use the 24-hour overlap to migrate safely.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Signatures never validate | HMAC computed over re-serialized JSON instead of raw bytes, timestamp prefix omitted, or wrong secret | Sign `"<timestamp>." + raw body`; check current vs. previous secret |
| Signatures fail after rotation | Endpoint still using a secret whose 24-hour window has closed | Accept both secrets during rotation; migrate before the window ends |
| Duplicate events | Retries or replays — expected behavior | Deduplicate on `X-Orbit-Event` |
| Events arrive out of order | Concurrent retries — expected behavior | Order by payload fields, not arrival |
| Deliveries stop after ~12 hours of failures | Five retries exhausted | Restore the endpoint, then replay within 7 days |
| Event rejected with `400`/`422`, never redelivered | Endpoint returned a non-retried `4xx` | Fix the endpoint, then replay; only `408`, `425`, `429`, and `5xx` are retried |
| Slow endpoint causing duplicate traffic | Processing before responding pushes past 10 seconds | Ack with `2xx` first, process asynchronously |
| Very large events fail | Payload exceeds 512 KiB | Keep events under the limit |
