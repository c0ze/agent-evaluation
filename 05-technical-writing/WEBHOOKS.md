# Orbit webhooks: delivery and verification guide

This guide covers what you build: verifying requests, responding correctly,
handling retries and duplicates, and rotating secrets.

**Guarantee** marks behaviour Orbit commits to today; **Recommendation** marks
advice that is not part of the contract.

## What Orbit sends

Each event is a `POST` with a UTF-8 JSON body of at most 512 KiB and these
headers:

| Header | Value |
| --- | --- |
| `X-Orbit-Event` | Opaque event id, stable for the life of the event |
| `X-Orbit-Type` | Event type |
| `X-Orbit-Timestamp` | Unix time in seconds, decimal |
| `X-Orbit-Signature` | `v1=<hex HMAC-SHA-256>` |
| `User-Agent` | `Orbit-Hooks/2` |

Header names are case-insensitive.

## Verifying the signature

**Guarantee.** The signature is HMAC-SHA-256, keyed with your signing secret,
over the timestamp, a literal `.` (0x2E), and the raw request body bytes. The
header value is the hex digest prefixed with `v1=`.

Older documentation says the signature covers parsed JSON. That is stale: the
current implementation signs the timestamp and raw body. Signing parsed JSON
would be unsafe anyway, because re-serialising does not reproduce the original
bytes. Verify before you parse.

Minimal Python example, standard library only:

```python
import hashlib, hmac, time

def verify(secret: bytes, headers, raw_body: bytes, tolerance: int = 300) -> bool:
    h = {k.lower(): v for k, v in headers.items()}   # lookup is case-insensitive
    ts = h.get("x-orbit-timestamp")
    signature = h.get("x-orbit-signature", "")
    try:
        fresh = abs(time.time() - int(ts)) <= tolerance
    except (TypeError, ValueError):
        return False                       # missing or malformed timestamp
    if not fresh or not signature:
        return False
    signed = ts.encode("ascii") + b"." + raw_body
    expected = "v1=" + hmac.new(secret, signed, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected.lower(), signature.lower())  # constant-time
```

**Guarantee.** Signature comparison is constant-time on our side; use an
equivalent primitive, never `==` on the digest.

The timestamp check is a **Recommendation**. Rejecting requests older than a few
minutes limits replay; Orbit publishes no tolerance window, so 300 seconds is a
reasonable default. Keep clocks synchronised.

Most JSON parsers discard the original bytes. Capture them explicitly —
`express.raw({ type: "application/json" })`, `request.get_data()` — and parse
after verification.

## Responding

**Guarantee.** You have 10 seconds from arrival to return a complete response.
Any 2xx counts as success, including 202 and 204. The response body is ignored.

**Recommendation.** Verify, persist, enqueue, then return 2xx; keep slow work
out of the handler. A 2xx is final — you cannot report a later failure — so
return it only once the event is durably accepted.

## Retries

**Guarantee.** An attempt is retried when it times out, fails at the network
level (DNS, TCP, TLS), or returns 408, 425, 429 or any 5xx. Other 4xx responses
— 400, 401, 403, 404, 409, 410, 422 and so on — are permanent and are not
retried. There are five retries after the initial attempt, at approximately 1
minute, 5 minutes, 30 minutes, 2 hours and 12 hours: six attempts over roughly
15 hours.

**Recommendation.** Treat the schedule as approximate; do not depend on arrival
at a particular minute. If you return 429 deliberately, ensure capacity recovers
inside the window.

## Ordering

**Guarantee.** Delivery order is not guaranteed. Events usually arrive in
creation order, but a concurrent retry can put a later event ahead of an earlier
one still in flight.

**Recommendation.** Assume any two events may arrive in either order. Where
order matters, use a sequence number or timestamp from the payload, or re-read
state from the API instead of replaying it locally.

## Duplicates and idempotency

**Guarantee.** Delivery is at-least-once: the same event can arrive more than
once.

**Recommendation.** Deduplicate on `X-Orbit-Event`. Record ids in durable
storage, not process memory, for at least seven days to cover replay. Make side
effects idempotent where you can — upserts keyed on the event's subject,
conditional writes — so a duplicate is harmless.

## Rotating secrets

**Guarantee.** After a rotation, two secrets are accepted for 24 hours. The
dashboard labels them current and previous; the previous secret stops being
accepted when the window ends.

**Recommendation.** Verify against both secrets during the window — accept a
match on either — and deploy that logic before you rotate, not after.

## Replaying events

**Guarantee.** The dashboard can resend an event for up to 7 days after
creation. A replay reuses the original event id and type and follows normal
delivery rules.

**Recommendation.** Treat a replay as any other duplicate and let idempotency
absorb it.

## Operational advice

- Reject unverified requests with 401 before parsing.
- Never log the signing secret, `X-Orbit-Signature`, or full payloads carrying
  personal or payment data. Log event id, type, status and latency instead.
- Alert on a sustained rise in 4xx responses; a wall of 401s usually means a
  secret or timestamp problem, not an attack.

## Troubleshooting

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| Every signature fails | Hashing parsed JSON, or bytes a parser rewrote | Capture raw bytes; sign `timestamp + "." + raw_body` |
| Fails only in production | A proxy or middleware re-encoding the body | Disable body rewriting on the route |
| Fails for a minute every hour | Clock drift on the host | Enable NTP; widen tolerance only as a stopgap |
| Requests time out | More than 10 s of work in the handler | Return 2xx first, process asynchronously |
| Same event processed twice | Dedupe absent, or lost from memory on restart | Persist event ids for at least 7 days |
| Verification breaks after rotation | Only the current secret is checked | Verify both for the 24-hour window |
| Delivery stops entirely | Non-retryable 4xx, or retries exhausted | Check the endpoint's response codes and history |

## Needs product confirmation

These points are unresolved; each gives the conservative reading.

- **Redirects.** Whether 3xx responses are followed is unconfirmed. Assume not;
  return 2xx or a definite failure rather than redirecting.
- **After the final retry.** Nothing documents what happens when all six
  attempts fail — whether events are retained, surfaced, or the endpoint
  disabled. Assume the event is not redelivered automatically.
- **Rotation detail.** It is unstated which secret signs outgoing deliveries
  during the window, and whether the header can carry two `v1=` values. Verify
  both.
- **Retry identity.** Replays are documented to reuse the event id; retries
  doing the same is implied by "duplicates possible" but never stated.
- **Payload limit.** The 512 KiB maximum is stated, but not whether larger
  payloads are rejected or truncated at the boundary.
