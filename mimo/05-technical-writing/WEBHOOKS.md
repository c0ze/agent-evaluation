# Orbit Webhooks

Orbit delivers events to your endpoint as HTTP `POST` requests with JSON bodies.
Verify the signature before you trust a payload. This guide covers request
format, verification, delivery semantics, and production operations.

Throughout, **Guarantee** marks documented product behavior; **Recommendation**
marks operational advice you may choose to ignore.

## Request format

Each delivery is an HTTP `POST` with a JSON body of at most **512 KiB** and
`User-Agent: Orbit-Hooks/2`.

| Header | Value |
| --- | --- |
| `X-Orbit-Event` | Event id — stable across retries and replays |
| `X-Orbit-Type` | Event type |
| `X-Orbit-Timestamp` | Unix time in seconds (signature input) |
| `X-Orbit-Signature` | `v1=<hex>` HMAC SHA-256 signature |

**Recommendation.** Acknowledge event types you do not recognize with `2xx` and
no-op, so new types roll out without breaking you.

## Signature verification

**Guarantee (current implementation).** `X-Orbit-Signature` is `HMAC-SHA256`
keyed by your signing secret over the ASCII bytes of
`"<X-Orbit-Timestamp>.<raw request body>"`. Note the literal `.` separator and
that the body is the exact bytes received — not re-serialized JSON. The digest
is lowercase hex, prefixed with `v1=`.

**Conflict — requires product confirmation.** Older documentation states that
the signature covers parsed JSON. That description conflicts with the current
implementation and is likely stale. This guide follows the current
implementation (`timestamp + "." + raw body`). Do not implement a
JSON-re-serialization scheme; see [Open questions](#open-questions-require-product-confirmation).

**Guarantee.** The signing secret is shown once at creation. Store it in a
secret manager immediately; it cannot be re-displayed.

Minimal verification example (Python 3):

```python
import hashlib
import hmac

def verify(secret: str, timestamp: str, body: bytes, signature_header: str) -> bool:
    message = f"{timestamp}.".encode("ascii") + body
    digest = hmac.new(secret.encode("ascii"), message, hashlib.sha256).hexdigest()
    return hmac.compare_digest(f"v1={digest}", signature_header)
```

**Recommendation.** Always compare in constant time (as above). Reject requests
whose `X-Orbit-Timestamp` is more than a few minutes away from your clock to
bound replay risk — the acceptable skew is your policy, not a product setting.
Never log signing secrets or full sensitive payloads; log event ids and types
only.

## Delivery and retries

**Guarantee.** A delivery succeeds only if your endpoint returns any `2xx`
within **10 seconds**. Response bodies are ignored.

**Guarantee.** Orbit retries on timeout, network errors, and HTTP `408`, `425`,
`429`, and `5xx`. Any other `4xx` is terminal and is not retried.

**Guarantee.** After the initial attempt there are **five retries**, scheduled
roughly at 1 minute, 5 minutes, 30 minutes, 2 hours, and 12 hours. Timing is
approximate.

**Recommendation.** Return `2xx` as soon as the event is durably queued and do
heavy work asynchronously, so you stay inside the 10-second window. Use `5xx`
or `429` for transient failures you want retried. Return a non-retryable `4xx`
(for example `400`) only when you want Orbit to stop.

## Ordering and idempotency

**Guarantee.** Duplicates are possible. A retry can race an earlier slow
success, and the replay UI (below) intentionally resends events.

**Guarantee.** Delivery order is **not** guaranteed. Deliveries usually follow
event creation order, but concurrent retries can reorder them.

**Recommendation.** Make handlers idempotent keyed on `X-Orbit-Event`: persist
processed ids and no-op on repeats. Do not assume event *N* is processed before
event *N+1*.

## Key rotation

**Guarantee.** During rotation, two secrets are valid for **24 hours**. The UI
labels them *current* and *previous*.

**Recommendation.** While rotating, accept signatures from either secret; drop
the previous secret when the 24-hour window closes.

## Replaying events

**Guarantee.** For **7 days** after an event, the replay UI can resend it.
Replays reuse the original `X-Orbit-Event` id.

**Recommendation.** Rely on idempotent handlers so replays are free.

## Operational advice

**Recommendation.** Expose a publicly reachable HTTPS endpoint. Secrets and
payloads are sensitive.

**Recommendation.** Keep verification and acknowledgment fast; defer business
logic past the `2xx`.

**Recommendation.** On an invalid signature, do not process the request. Return
a non-retryable `4xx` and log only metadata (event id, type, timestamp) — never
the secret or the full body.

**Recommendation.** Size handlers for 512 KiB request bodies.

**Unconfirmed.** Whether Orbit follows HTTP redirects on delivery is unknown.
Security believes redirects are *not* followed; the implementation owner has not
confirmed. Do not use redirects to migrate an endpoint — update the configured
URL instead.

## Troubleshooting

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| No deliveries arriving | Endpoint unreachable or wrong configured URL | Confirm public reachability; check Orbit's delivery log |
| Every signature check fails | Signed re-serialized JSON, or omitted the `timestamp.` prefix | HMAC the exact raw bytes of `"<timestamp>.<raw body>"` |
| Intermittent signature failures | Clock skew, or wrong secret during rotation | Check `X-Orbit-Timestamp`; try both secrets inside the 24-hour overlap |
| Duplicate side effects | Retries or replays hitting a non-idempotent handler | Dedupe on `X-Orbit-Event` |
| Events processed out of order | Concurrent retries | Remove ordering assumptions |
| Retries stopped unexpectedly | Endpoint returned a non-retryable `4xx` | Return `2xx` once accepted; use `5xx`/`429` for transient failures |
| Event undelivered after ~12 hours | All five retries exhausted | Replay from the UI within 7 days |
| Handler truncated the request | Body larger than expected | Accept up to 512 KiB |

## Open questions (require product confirmation)

1. **Signature input.** Legacy docs say parsed JSON; current notes say
   `timestamp + "." + raw body`. This guide documents the current
   implementation. Please confirm and retire the stale description.
2. **Redirects.** Unconfirmed (security: not followed; implementation owner:
   not confirmed). Documented as unknown; do not depend on redirects.
3. **Endpoint scheme.** Whether HTTPS is required or merely recommended is not
   stated. Treated here as a recommendation.
4. **Retry schedule precision.** Delays are described as "roughly" 1m/5m/30m/
   2h/12h. Confirm whether those are contractual or best-effort.
