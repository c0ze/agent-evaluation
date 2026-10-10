# Orbit webhook delivery

Orbit sends each event as an HTTP POST. **Guarantee** is current behavior. **Recommendation** is integrator practice. **Unconfirmed** points are collected at the end.

## Request

**Guarantee.** The body is JSON and at most 512 KiB (524,288 bytes). `User-Agent` is `Orbit-Hooks/2`. Every delivery sets these headers:

| Header | Value |
| --- | --- |
| `X-Orbit-Event` | Event id. Retries and manual replays reuse it. |
| `X-Orbit-Type` | Event type. |
| `X-Orbit-Timestamp` | Unix time in whole seconds, as decimal text. |
| `X-Orbit-Signature` | `v1=` and a hexadecimal HMAC-SHA256. |

**Recommendation.** Keep the raw body for verification, then parse JSON. Allow at least 524,288 bytes at the proxy. The user agent is a log label; the signature authenticates the call.

## Signatures

**Guarantee.** Orbit signs the exact `X-Orbit-Timestamp` value, one `.`, and the raw body, using HMAC-SHA256 and the endpoint secret. The header is `v1=` plus the hex digest.

Older docs signed parsed, re-serialized JSON. That conflicts with the current implementation, and the notes mark it as probably stale. Sign that byte string. A check that parses and re-encodes JSON will not match live traffic.

**Recommendation.** Compare digests in constant time. The secret is shown once; store it immediately. On failure, log the event id and type, and leave the secret and any sensitive body out of logs.

The sample uses the shown secret as UTF-8 and lowercase hex. Case and binary key format are unspecified, so keep failing closed until Orbit confirms them.

```python
import hmac, hashlib

def verify(secret: str, timestamp: str, raw_body: bytes, signature_header: str) -> bool:
    if not signature_header.startswith("v1="):
        return False
    message = timestamp.encode("utf-8") + b"." + raw_body
    digest = hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, signature_header[3:])
```

Pass the timestamp header and the raw body through unchanged. No skew window is published. The notes also do not say whether a 7-day replay keeps the original `X-Orbit-Timestamp`. **Recommendation:** accept a delivery with a valid `v1` signature, and add a freshness cutoff only after Orbit publishes one.

## Delivery and retries

**Guarantee.** Orbit waits 10 seconds for the response. Any `2xx` succeeds. The body is ignored, so a `200` counts even when its JSON says the handler failed. Orbit retries timeouts, network errors, `408`, `425`, `429`, and any `5xx`. Other `4xx` codes are not retried. Five retries follow the first attempt. The approximate schedule for those retries is 1 minute, 5 minutes, 30 minutes, 2 hours, and 12 hours.

Read together, a response after 10 seconds is that timeout. The status rules and the five-retry cap are firm. Timing is not an SLA: the notes never say whether each figure is a gap after the previous attempt or an offset from the first failure.

**Recommendation.** Store `X-Orbit-Event` before you return `2xx`, including a stored skip of a duplicate, and queue slow work. If the process dies after a side effect, Orbit delivers again, so stay idempotent. Use `408`, `425`, `429`, or `5xx` when a later try might succeed. Any other `4xx` ends the schedule. The replay UI resends that same event id for 7 days.

**Unconfirmed.** Security believes redirects are not followed. The implementation owner has not confirmed that, or how a `3xx` is retried. Register a URL that returns `2xx` directly. Behavior after the fifth retry is also unconfirmed.

## Ordering and idempotency

**Guarantee.** The same event can arrive more than once. Replay within 7 days reuses `X-Orbit-Event`. Creation order is usual and not guaranteed: concurrent retries can deliver an older event after a newer one.

**Recommendation.** Record `X-Orbit-Event` uniquely in the same transaction as the side effect. Return `2xx` and stop when that id is already complete. Process a replay whose id never finished. Keep your own sequence if order matters. The JSON schema is not in these notes, so no body field is named as an ordering key.

## Key rotation

**Guarantee.** Current and previous secrets are both valid for 24 hours. The UI labels them that way.

**Recommendation.** Treat the signature as valid when either secret produces it. Deploy the new secret first, and keep the previous one until the 24 hours end. Which secret signs during the overlap is unconfirmed. Each secret is shown once. If you did not store it, rotate and save the new secret when it is displayed.

## Operations

**Recommendation.** Count proxy time inside the 10 seconds, and use a separate secret per environment. Prefer HTTPS. The notes never require a scheme; confirm policy before using plain HTTP, which exposes bodies. Alert before the long retry tail. In tickets, quote `X-Orbit-Event` and omit secrets and sensitive payloads.

## Troubleshooting

| What you see | Likely cause | What to do |
| --- | --- | --- |
| Every signature fails | Signed parsed JSON, or dropped `timestamp.` | Sign timestamp, `.`, and raw body |
| Tests pass, production fails | Body or secret changed on the way in | Use original bytes and the shown secret |
| Failures start at rotation | A still-valid secret is missing | Try current and previous for 24 hours |
| Same event again | A retry, a replay, or another copy | Dedupe on `X-Orbit-Event`; return `2xx` |
| Newer event applied first | Overlapping retries | Use your own sequence |
| One `4xx`, then silence | Not `408`, `425`, or `429` | Fix the handler; replay within 7 days |
| More tries near 1m / 5m / 30m / 2h / 12h | Timeout, network error, `408`, `425`, `429`, or `5xx` | Store the id; `2xx` within 10 seconds |
| Replay does nothing | Id already complete | Reprocess only unfinished ids |
| Redirect target is quiet | Redirects are unconfirmed | Return `2xx` on the registered URL |
| Edge rejects the body | Buffer under 512 KiB | Allow at least 524,288 bytes |

## Needs product confirmation

- Redirect following, and whether `3xx` is retried. Security believes redirects are not followed; implementation has not confirmed it.
- Clock skew, hex case, secret encoding, and whether replay keeps `X-Orbit-Timestamp`.
- Which secret signs during the 24-hour overlap.
- Whether schedule numbers are gaps or offsets from the first attempt.
- Policy after the fifth retry, and events larger than 512 KiB.
- JSON schema, `X-Orbit-Type` values, and any ordering field.
- Whether the URL must be HTTPS.

Until those are answered, verify `v1` (timestamp, dot, and raw body), return `2xx` quickly, dedupe on `X-Orbit-Event`, and accept both secrets for 24 hours.
