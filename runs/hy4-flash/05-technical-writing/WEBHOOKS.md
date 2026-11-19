# Orbit Webhooks — Customer Integration Guide

Orbit Hooks/2 delivers events to your HTTPS endpoint as HTTP `POST` requests with a JSON body. This guide covers verification, delivery and retries, and how to build a receiver that stays correct under duplicates and out-of-order delivery.

**Guarantee** means service behavior you can rely on, subject to the open items below. **Recommendation** is advice for your receiver, not a service promise. Where our notes conflicted, we chose the conservative interpretation and flagged it rather than inventing behavior.

## Receiving an event

**Guarantee** — Every delivery is a `POST` with a JSON body and these headers:

| Header | Meaning |
| --- | --- |
| `X-Orbit-Event` | Event ID; stays the same across retries and replays |
| `X-Orbit-Type` | Event type |
| `X-Orbit-Signature` | Signature in the form `v1=<hex>` |
| `X-Orbit-Timestamp` | Unix timestamp, in seconds |
| `User-Agent` | `Orbit-Hooks/2` |

**Guarantee** — Request bodies are at most 512 KiB.

**Guarantee** — Your endpoint has 10 seconds to return any 2xx status. The response body is ignored.

**Recommendation** — Treat `User-Agent` as a diagnostic hint, not a security control. Acknowledge with 2xx immediately and move slow work to a background job. Reject bodies larger than 512 KiB at the edge.

## Verifying signatures

**Guarantee (current implementation; see open items)** — The `v1` signature is `HMAC-SHA-256(secret, X-Orbit-Timestamp + "." + raw_body)`, hex-encoded and returned as `v1=<hex>`. The timestamp is a Unix timestamp in seconds. Each endpoint secret is shown to you once at creation; store it safely because it cannot be retrieved later.

> **Documentation conflict:** notes from the older system say the signature covers *parsed JSON* rather than the raw body. That note is believed stale. Until product confirms, sign the **raw bytes exactly as received** and confirm with a test event; do not rely on either interpretation without an end-to-end check.

**Recommendation** — Verify every request before trusting its contents:

- Use the **raw body bytes**. Many frameworks consume the stream when parsing JSON; cache the bytes first.
- Parse the `v1=` prefix and reject unknown versions.
- Compare digests with a **constant-time** comparison to avoid timing leaks.
- Check the timestamp against a bounded window of your clock. No window is specified by the service, so the value below is local policy, not a guarantee.
- Never log secrets or full sensitive payloads; log the event ID, type, and verification result instead.

Minimal Python 3 example (standard library only):

```python
import hashlib, hmac, time

SECRET = b"whsec_..."          # load from a secure store, never from source
TOLERANCE = 300                # seconds; local policy, not a service guarantee

def verify(raw_body: bytes, headers: dict) -> bool:
    ts = headers.get("X-Orbit-Timestamp", "")
    sig = headers.get("X-Orbit-Signature", "")
    try:
        if abs(int(ts) - int(time.time())) > TOLERANCE:
            return False
    except (TypeError, ValueError):
        return False
    version, sep, hexsig = sig.partition("=")
    if version != "v1" or not sep:
        return False
    expected = hmac.new(
        SECRET,
        ts.encode("ascii") + b"." + raw_body,   # raw bytes, not parsed JSON
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, hexsig)   # constant-time
```

Handle missing headers as authentication failures and keep `SECRET` out of logs and exception traces.

## Delivery and retries

**Guarantee** — A delivery is retried on timeout, network error, and HTTP `408`, `425`, `429`, or any `5xx` response. Other `4xx` responses are **not** retried.

**Guarantee** — There are five retries after the initial attempt.

**Guarantee** — Retry delays are *roughly* 1 minute, 5 minutes, 30 minutes, 2 hours, and 12 hours; they are approximate, not contractual timings.

**Recommendation** — Reserve `5xx`/`429` for genuine transient failures. A persistent `4xx` stops further attempts, so fix configuration or payload assumptions rather than returning a retryable status for a permanent problem.

## Ordering and idempotency

**Guarantee** — Duplicates can occur; a single event may be delivered more than once.

**Guarantee** — Delivery order *usually* follows event creation order, but it is **not guaranteed**, because concurrent retries can arrive out of sequence.

**Recommendation** — Treat `X-Orbit-Event` as the deduplication key: record processed IDs durably and skip any you have already handled. This also covers the replay UI, which can resend an event for up to 7 days **with the same event ID**. Make handlers safe to re-run and tolerant of out-of-order arrivals; never assume a later delivery supersedes an earlier one.

## Secret rotation

**Guarantee** — During rotation two secrets are valid for 24 hours. The UI labels them **current** and **previous**.

**Recommendation** — Verify with both secrets during the overlap window: try `current`, then `previous`. Deploy the new secret before the old one expires and keep accepting the previous secret for the full 24 hours.

## Operational advice

**Recommendation** — Monitor verification failures, response codes, and latency; alert on sustained `5xx` or a spike in duplicates. Use the 7-day replay UI to recover missed events. Store secrets in a managed secret store, restrict access, and rotate on a schedule and after any suspected exposure.

## Troubleshooting

| Symptom | Likely cause | Action |
| --- | --- | --- |
| Every signature fails | Signing parsed JSON, or body consumed | Verify over raw bytes; cache the body first |
| Failures after a deploy | Wrong secret or missed rotation | Try both current and previous secrets |
| Intermittent failures | Clock skew beyond your tolerance | Sync clocks; review timestamp window |
| Events arrive twice | Retry or UI replay | Deduplicate on `X-Orbit-Event` |
| Events out of order | Concurrent retries | Make handlers order-independent |
| Deliveries stopped after `4xx` | Non-retryable status returned | Fix endpoint; resend via replay UI |
| Timeouts or 10s breaches | Slow synchronous processing | Return 2xx first; background the work |
| Payload rejected | Body exceeds 512 KiB | Check payload size upstream |

## Open items requiring product confirmation

- **Signing formula:** confirm that the signature covers `timestamp + "." + raw body` and correct the stale parsed-JSON documentation.
- **Redirects:** whether redirects are followed is unresolved — security believes they are not, but the implementation owner has not confirmed. Until confirmed, treat a redirect as a delivery failure and use a final, non-redirecting URL.
- **Timestamp tolerance:** no official replay window is specified; the value above is a local recommendation only.
- **Retry schedule:** confirm whether the approximate delays are a service commitment or best-effort behavior.
- **Rotation overlap:** confirm the exact start/end of the 24-hour two-secret window.
