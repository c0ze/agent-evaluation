# Orbit Webhooks

This guide describes how to integrate with Orbit webhooks. It covers signature
verification, delivery and retry behavior, ordering and idempotency, secret
rotation, and operational advice. Each section labels statements as
**guarantees** (behavior you can rely on) or **recommendations** (best
practices we suggest but do not enforce).

## Overview

Orbit delivers each event as an HTTP `POST` with a JSON body to your configured
endpoint. The following headers accompany every delivery:

- `X-Orbit-Event` — the event ID.
- `X-Orbit-Type` — the event type.
- `X-Orbit-Timestamp` — the send time in Unix seconds.
- `X-Orbit-Signature` — the signature, in the form `v1=<hex>`.

Requests identify themselves with `User-Agent: Orbit-Hooks/2`. The JSON payload
is at most 512 KiB.

## Verifying signatures

Orbit signs each request with HMAC-SHA256 over the message
`timestamp + "." + raw body`, where `timestamp` is the string value of
`X-Orbit-Timestamp` (Unix seconds) and `raw body` is the exact request body,
byte for byte.

**Guarantee:** the signature is computed over the raw body bytes. Verify the
signature *before* parsing or re-serializing the JSON, since reformatting
changes the bytes and breaks the check. Use a constant-time comparison to avoid
timing leaks.

A minimal verification example in Python:

```python
import hashlib
import hmac

def verify(raw_body: bytes, signature: str, timestamp: str, secret: str) -> bool:
    message = timestamp.encode() + b"." + raw_body
    expected = "v1=" + hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
```

Connect this to your framework by reading the raw request body as bytes and
passing the timestamp header unchanged. In the example, `secret` must match the
signing secret shown by our dashboard.

**Note:** older documentation described signing the parsed JSON instead of the
raw body. That description is outdated, and the raw-body algorithm above matches
the current implementation. If your integration followed the older guidance,
re-verify against the raw body before going live.

## Delivery and retry semantics

**Guarantee:** Orbit retries a delivery on timeouts, network errors, and HTTP
status codes `408`, `425`, `429`, and any `5xx`. It does **not** retry any other
`4xx` response. After the initial attempt, five retries are scheduled at
approximately 1 minute, 5 minutes, 30 minutes, 2 hours, and 12 hours.

**Guarantee:** your endpoint has 10 seconds to return any `2xx` status. The
response body is ignored, so return a minimal `200 OK` once the event is
committed.

**Unconfirmed:** whether deliveries follow HTTP redirects. Do not rely on
redirect responses for delivery; if your endpoint must move, update the
configured URL instead.

## Ordering and idempotency

**Guarantee:** deliveries are not guaranteed to be unique or strictly ordered.
The same event may be delivered more than once, and although events are usually
sent in creation order, concurrent retries can reorder them. In addition, the
dashboard replay feature can resend an event (using the same event ID) for up
to 7 days, which is another source of duplicate deliveries.

**Recommendation:** treat each event as at-least-once and make your consumer
idempotent. Persist the `X-Orbit-Event` ID and skip processing if you have
already handled it. Because ordering is not guaranteed, do not rely on arrival
order for correctness.

## Secret rotation

**Guarantee:** the dashboard supports two simultaneously valid signing secrets
for 24 hours, labeled *current* and *previous*. The new secret is shown only
once; store it securely at creation time.

**Recommendation:** rotate by adding a new secret, verifying that production
traffic signed with the new secret verifies correctly, then retiring the old
one. Accepting both secrets during the overlap prevents dropped events from
in-flight requests.

## Operational advice

- Do not log the signing secret or full sensitive payloads; log only fields you
  need for debugging.
- Respond with `2xx` only after the event is durably stored so retries are
  idempotent rather than lossy.
- Treat the timestamp as an opaque identifier for signature input, not a clock
  for your business logic.
- Monitor webhook failure rates and dead-letter your own undeliverable events.

## Troubleshooting

| Symptom | Likely cause | Remedy |
| --- | --- | --- |
| Signature mismatch | Secret wrong or body reformatted before verification | Verify with raw body bytes; confirm the secret matches the dashboard |
| Signature mismatch after deploying old integration | Parsing JSON before signing | Use the raw-body algorithm; ignore outdated parsed-JSON docs |
| No retries after a `4xx` | Other `4xx` codes are not retried | Return `5xx`/`429` for transient failures, `2xx` on success |
| Events arriving out of order | Concurrent retries reorder deliveries | Do not rely on order; key idempotency on event ID |
| Duplicate event processed twice | At-least-once delivery | Deduplicate on `X-Orbit-Event` |
| Delivery times out | Endpoint slower than 10 seconds | Return `2xx` immediately and process asynchronously |