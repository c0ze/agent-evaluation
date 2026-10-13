# Webhook delivery guide

Orbit sends events to your HTTPS endpoint by `POST` with a JSON body, so you can react without polling. **Guaranteed** below means behaviour you can rely on; **Recommended** means advice we do not enforce; **Not guaranteed** means do not assume it.

| Item | Value |
| --- | --- |
| Event ID / type headers | `X-Orbit-Event` / `X-Orbit-Type` (**Guaranteed**) |
| Timestamp header | `X-Orbit-Timestamp`, Unix seconds (**Guaranteed**) |
| Signature header | `X-Orbit-Signature`: `v1=<hex>` (**Guaranteed**) |
| User-Agent | `Orbit-Hooks/2` (**Guaranteed**) |
| Max payload | 512 KiB (**Guaranteed**) |
| Response deadline | Any `2xx` within 10 seconds (**Guaranteed**) |

Do not authenticate by `User-Agent` alone. Always verify the signature.

## Verify signatures

Deliveries are signed with HMAC SHA-256. The secret is shown only once. Store it in a secret manager; never log it or commit it.

> **Conflicting older documentation:** Old material says the parsed JSON is signed. That is stale. The current implementation signs the timestamp plus the raw body. Verifying re-serialised JSON will fail because formatting changes the bytes. Always use the raw bytes as received.

Steps:

1. Keep the raw body unparsed (**Recommended**).
2. Build the signed payload as `timestamp + "." + raw_body`, using the `X-Orbit-Timestamp` value verbatim (**Guaranteed** for the current implementation).
3. Compute HMAC SHA-256 with your secret, strip `v1=` from `X-Orbit-Signature`, and compare hex digests in constant time (**Recommended**; do not use ordinary string equality).

### Minimal example (Python)

Do not log the secret or the full payload. Log only the event ID and type if needed.

```python
import hashlib, hmac

def is_valid(secret, timestamp, raw_body: bytes, signature_header):
    provided = signature_header.removeprefix("v1=")
    signed = timestamp.encode() + b"." + raw_body  # raw bytes, not parsed JSON
    expected = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, provided)
```

Only parse and route on `X-Orbit-Type` after verification succeeds.

**Not confirmed:** No fixed tolerance for rejecting old timestamps has been published. Checking freshness is **Recommended** as replay defence, but choose and monitor your own window; do not assume one.

## Delivery and retry semantics

Delivery is at-least-once: duplicates are possible, so exactly-once delivery is **Not guaranteed** (**Guaranteed** that you must handle duplicates).

Return any `2xx` within 10 seconds (**Guaranteed** deadline). The response body is ignored (**Guaranteed**), so respond quickly and do slow work asynchronously.

Orbit retries on timeout, network error, `408`, `425`, `429`, and `5xx`, and does not retry other `4xx` (**Guaranteed**). There are five retries after the initial attempt, roughly at `1m, 5m, 30m, 2h, 12h` (**Guaranteed** count; exact timing is **Not guaranteed**). Concurrent retries can overlap, so a retry may arrive after a newer event.

Prefer queuing the raw event and returning `2xx` quickly over returning `429`/`5xx` to shed load, since those trigger more retries.

## Ordering and idempotency

Ordering is **Not guaranteed**. Delivery usually follows creation order, but concurrent retries break strict ordering. Do not infer state from arrival order.

**Recommended:**

- Use `X-Orbit-Event` as the idempotency key. Store processed IDs durably and return `2xx` without repeating side effects.
- Make each handler idempotent.
- If the payload has a version or updated-at field, ignore updates older than the state you hold.

## Replay

The replay UI can resend an event for 7 days, reusing the same event ID (**Guaranteed**). Treat replays as duplicates: verify as usual and let idempotency suppress repeated effects.

## Key rotation

If you lose a secret, create a new one; the old value will not be shown again.

During rotation, two secrets are valid for 24 hours, labelled `current` and `previous` (**Guaranteed**). **Recommended** procedure: configure your verifier to try `current` then `previous`, deploy, confirm new deliveries verify, then retire the old secret. Do not replace the secret without the overlap, and never log either secret.

## Operational advice

- **Recommended:** Verify before parsing; keep raw-body access in your framework and disable or redact payload logging.
- **Recommended:** Alert on sustained non-`2xx`, signature failures, and latency near 10 seconds. Non-retryable `4xx` will not be retried, so it needs a manual fix.
- **Recommended:** Keep processed event IDs for at least the 7-day replay window plus your retry horizon.
- **Recommended:** Allow at least 512 KiB at proxies and framework body limits for the webhook route.
- Redirects: whether Orbit follows redirects is **Not confirmed** — Security expects it does not, but the implementation owner has not confirmed. Use a direct URL that returns `2xx` without redirecting and do not treat `3xx` as success until confirmed.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Verification always fails | Parsed/re-serialised JSON, or missing timestamp and dot | Verify `timestamp + "." + raw_body` on exact bytes |
| Fails only in rotation | Only one secret tried | Try both `current` and `previous` for 24h |
| Event processed twice | Duplicate or replay, same ID | Deduplicate on `X-Orbit-Event`; return `2xx` |
| Out-of-order events | Overlapping retries | Ignore stale versions; do not rely on order |
| No retry after `4xx` | Non-retryable error | Fix endpoint, replay within 7 days |
| Retries then stops | 10s timeout or `5xx` | Return `2xx` fast; queue work async |
| Missing after URL change | Endpoint redirects (`3xx`) | Use direct `2xx` URL; following unconfirmed |
| Large event rejected | Edge limit < 512 KiB | Raise limit on webhook route |

## Pending confirmation

Redirect following is the one behaviour above that still needs product confirmation; it is flagged as unconfirmed rather than specified. If observed behaviour conflicts with this guide, treat the signature (timestamp plus raw body) and retry rules here as current and contact Orbit with the `X-Orbit-Event` ID — never the secret.
