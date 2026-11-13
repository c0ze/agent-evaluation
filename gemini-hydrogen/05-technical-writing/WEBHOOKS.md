# Orbit Webhooks Integration Guide

Orbit delivers event notifications to your HTTPS endpoint via HTTP `POST` requests with JSON payloads (up to **512 KiB**) and `User-Agent: Orbit-Hooks/2`.

## Request Headers

- `X-Orbit-Event`: Event identifier (reused across retries and manual replays).
- `X-Orbit-Type`: Event type string.
- `X-Orbit-Timestamp`: Unix timestamp in seconds.
- `X-Orbit-Signature`: HMAC-SHA256 digest formatted as `v1=<hex>`.
- `User-Agent`: `Orbit-Hooks/2`.

## Guarantees vs. Recommendations

Distinguish between contracted behavior, unconfirmed/best-effort behavior, and recommended integration practices:

- **Contracted guarantees:**
  - `X-Orbit-Signature` (`v1=<hex>`) signs `<X-Orbit-Timestamp>.<raw_body_bytes>` with HMAC-SHA256.
  - Signing secrets are displayed **once** at creation; during rotation, `current` and `previous` secrets remain valid together for **24 hours**.
  - Endpoints have **10 seconds** to return any `2xx` status; response bodies are ignored.
  - Failed deliveries retry up to **5 times** on timeouts, network errors, `408`, `425`, `429`, and `5xx`; other `4xx` codes are **not** retried.
  - UI replays work for **7 days** using the original `X-Orbit-Event`.
  - Payloads have a **512 KiB** maximum size.
- **Best-effort or unconfirmed (requires product confirmation):**
  - **Retry intervals** (~1m, ~5m, ~30m, ~2h, ~12h) are approximate.
  - **Ordering** usually follows creation order, **but is not guaranteed**; duplicates are possible.
  - **Redirects (`3xx`):** **Unconfirmed.** Security expects redirects are not followed, pending implementation-owner confirmation.
  - **Timestamp updates on retries/replays:** **Unconfirmed** whether `X-Orbit-Timestamp` refreshes per attempt or retains creation time.
- **Recommended practices:**
  - Verify raw request bytes in constant time against active secret(s) (`current`, plus `previous` during rotation).
  - Acknowledge quickly (`2xx`) and process asynchronously.
  - Deduplicate using `X-Orbit-Event` and avoid redirect URLs.

## Signature Verification

> [!WARNING]
> **Conflicting Legacy Note:** Older documentation describes signing parsed JSON. That conflicts with the current `v1` implementation and breaks verification when JSON whitespace or key order differs. Always compute the HMAC over `<X-Orbit-Timestamp>.<raw_body_bytes>` using the exact raw bytes received.

Compute `HMAC-SHA256(secret, f"{timestamp}.".encode("utf-8") + raw_body)` and compare in constant time. **Never log signing secrets, raw signature headers, or full sensitive payloads.**

```python
import hashlib
import hmac
import logging
from collections.abc import Mapping

logger = logging.getLogger(__name__)


def verify_webhook(headers: Mapping[str, str], raw_body: bytes, secrets: list[str]) -> bool:
    """Verify v1=<hex> HMAC-SHA256 over '<timestamp>.<raw_body>' in constant time."""
    norm = {k.lower(): v for k, v in headers.items()}
    timestamp = norm.get("x-orbit-timestamp", "")
    scheme, sep, sig_hex = norm.get("x-orbit-signature", "").partition("=")
    if not timestamp or sep != "=" or scheme != "v1" or not sig_hex:
        return False

    # Sign raw bytes, never parsed/re-serialized JSON.
    payload = f"{timestamp}.".encode("utf-8") + raw_body
    provided = sig_hex.lower()
    for secret in secrets:
        if not secret:
            continue
        expected = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
        if hmac.compare_digest(expected, provided):
            return True
    return False


def handle_webhook(headers: Mapping[str, str], raw_body: bytes, secrets: list[str], enqueue) -> int:
    # WARNING: Never log secrets, raw signatures, or full sensitive payloads.
    norm = {k.lower(): v for k, v in headers.items()}
    event_id = norm.get("x-orbit-event", "")
    if not verify_webhook(norm, raw_body, secrets):
        logger.warning("Invalid webhook signature event_id=%s", event_id)
        return 401
    enqueue(event_id, norm.get("x-orbit-type", ""), raw_body)
    return 200
```

**Timestamp Replay Caution:** Until product confirms whether `X-Orbit-Timestamp` updates on retries (~15 hours total) and 7-day UI replays, do not enforce a short timestamp expiration check that could reject legitimate retries or replays.

## Delivery and Retry Semantics

- **Acknowledgment:** Return any `2xx` within **10 seconds**. Orbit ignores response bodies.
- **Retries:** Orbit attempts an initial delivery plus up to **5 retries** (schedule roughly **1m, 5m, 30m, 2h, 12h**) on timeouts, network errors, `408`, `425`, `429`, and `5xx`. All other `4xx` statuses fail permanently without retry.
- **UI Replays:** Operators can resend events from the replay UI for **7 days**, keeping the original `X-Orbit-Event`.
- **Redirects:** Because `3xx` redirect handling is unconfirmed, configure your final HTTPS endpoint directly without redirects.

## Ordering and Idempotency

Because duplicate deliveries occur and concurrent retries can reorder events:

- **Deduplicate by `X-Orbit-Event`:** Retain processed event IDs for at least **7 days** so both retries and manual replays are covered.
- **Record completion after durable handoff:** Mark `X-Orbit-Event` processed only after safely persisting or enqueueing the event; otherwise, failed deliveries replayed from the UI will be skipped.
- **Guard state transitions:** Check resource versions or updated timestamps (when present in payloads or local state), or reconcile against authoritative state so stale deliveries cannot overwrite newer state.

## Key Rotation

Because each secret is shown **once** and both `current` and `previous` secrets stay valid for **24 hours** during rotation:

1. Create the new secret in the UI and immediately store it in your secrets manager.
2. Deploy your receiver with both `[current_secret, previous_secret]` enabled so signatures matching either key pass.
3. Wait at least **24 hours** (and confirm retries under the old key have drained) before removing `previous_secret`.

## Operational Advice

- **Acknowledge fast, work async:** Verify, durably enqueue `X-Orbit-Event` plus raw bytes, and return `2xx` well under 10 seconds.
- **Configure >= 512 KiB body limits:** Raise proxy/framework limits to at least 512 KiB; `413 Payload Too Large` is a non-retried `4xx`.
- **Minimize sensitive logs:** Log `X-Orbit-Event`, `X-Orbit-Type`, `X-Orbit-Timestamp`, status, and latency—never secrets or unredacted sensitive payloads.
- **Do not authenticate via `User-Agent`:** Treat `Orbit-Hooks/2` as diagnostic metadata only.

## Troubleshooting

| Symptom | Likely Cause | Resolution |
| --- | --- | --- |
| `401` signature mismatch | Verified parsed JSON (stale doc note), missed `<timestamp>.`, or stale secret. | Verify HMAC-SHA256 over `<X-Orbit-Timestamp>.<raw_body>` against `current` (and `previous` during rotation). |
| Timeouts and repeated retries | Slow synchronous work exceeding 10 seconds. | Verify, enqueue durably, return `2xx` fast, and process asynchronously. |
| Missing events after `4xx` | Endpoint returned non-retried `4xx` (`413`, `404`, `400`). | Fix routing or raise body limits to >= 512 KiB; replay from UI within 7 days. |
| `3xx` delivery failures | Redirects unconfirmed and likely not followed. | Point webhook URL directly to final HTTPS destination. |
| Duplicate side effects | Missing or short-lived `X-Orbit-Event` deduplication. | Deduplicate on `X-Orbit-Event` for >= 7 days after durable persistence. |
| Stale state overwrites | Out-of-order delivery from concurrent retries. | Check domain versions/timestamps or re-read current state before applying updates. |
| Retries/replays rejected as stale | Strict timestamp age check vs. unconfirmed `X-Orbit-Timestamp` lifecycle. | Confirm timestamp refresh behavior with product; rely on `X-Orbit-Event` deduplication. |
