# Orbit Webhook Delivery Guide

Orbit webhooks notify your application of events over HTTPS. Because webhook delivery involves network timeouts, retries, and concurrent processing, this guide separates **Service Guarantees** (behaviors Orbit enforces) from **Integration Recommendations** (practices your endpoint should implement). Details awaiting engineering sign-off are marked **Pending Product Confirmation**.

## 1. Request Format and Delivery Guarantees

### Service Guarantees
* **Method and Format:** Orbit sends HTTP `POST` requests with a JSON payload (`Content-Type: application/json`) up to a maximum size of **512 KiB**.
* **Request Headers:**
  * `User-Agent`: `Orbit-Hooks/2`
  * `X-Orbit-Event`: Unique event ID, preserved across automatic retries and manual UI replays.
  * `X-Orbit-Type`: Event type identifier.
  * `X-Orbit-Timestamp`: Unix timestamp (in seconds) when the signature was generated.
  * `X-Orbit-Signature`: HMAC-SHA256 signature formatted as `v1=<hex>`.
* **Response Timeout:** Your endpoint has **10 seconds** to return any `2xx` HTTP status code. Orbit ignores the response body.

### Integration Recommendations
* **Payload Limits:** Configure your reverse proxy and web framework to accept request bodies up to at least **512 KiB**.
* **Do Not Rely on Redirects (Pending Product Confirmation):** Security expects `Orbit-Hooks/2` not to follow HTTP `3xx` redirects, but the implementation owner has not yet confirmed redirect behavior. Point your webhook URL directly to the final HTTPS endpoint rather than returning `3xx` redirects.

## 2. Signature Verification

### Service Guarantees
* **One-Time Secret Display:** Your signing secret is shown **only once** in the UI when created.
* **Signature Construction:** Orbit computes an **HMAC-SHA256** digest using your secret over the `X-Orbit-Timestamp` string, a literal period (`.`), and the raw request body bytes:
  ```text
  <X-Orbit-Timestamp>.<raw_request_body_bytes>
  ```
  The hex-encoded digest is sent in `X-Orbit-Signature` as `v1=<hex>`.

> **Legacy Documentation Conflict (Pending Product Confirmation):** Legacy documentation states that Orbit signs parsed JSON, while a summary engineering note mentions signing raw bytes without the timestamp prefix. Both conflict with the active `Orbit-Hooks/2` implementation (`timestamp + "." + raw_body`). Never parse and re-serialize JSON before verifying, as whitespace or key reordering breaks the signature.

### Integration Recommendations
* **Verify Raw Bytes with Constant-Time Comparison:** Read the raw HTTP body bytes before JSON parsing and compare `X-Orbit-Signature` using a constant-time digest comparison function.
* **Never Log Secrets or Sensitive Payloads:** Do not write signing secrets or full raw webhook payloads to logs or error trackers. Log only safe metadata (`X-Orbit-Event`, `X-Orbit-Type`, `X-Orbit-Timestamp`).

### Minimal Verification Example (Python)

```python
import hashlib
import hmac
from typing import Iterable


def verify_orbit_webhook(
    raw_body: bytes,
    signature_header: str,
    timestamp_header: str,
    active_secrets: Iterable[str],
) -> bool:
    # WARNING: Never log active_secrets or full raw_body payloads.
    if not signature_header or not timestamp_header:
        return False

    signed_payload = timestamp_header.encode("utf-8") + b"." + raw_body

    for secret in active_secrets:
        if not secret:
            continue
        digest = hmac.new(
            secret.encode("utf-8"), signed_payload, hashlib.sha256
        ).hexdigest()
        if hmac.compare_digest(f"v1={digest}", signature_header):
            return True

    return False
```

## 3. Delivery, Retries, and Replays

### Service Guarantees
* **Retry Conditions:** Orbit retries failed deliveries on network errors, timeouts, and HTTP `408`, `425`, `429`, and `5xx` responses.
* **Non-Retryable Codes:** Orbit does **not** retry any other `4xx` responses (such as `400`, `401`, `403`, `404`, or `422`).
* **Backoff Schedule:** Orbit makes up to **5 retries** after the initial attempt (6 total attempts) at approximate delays of **1 minute, 5 minutes, 30 minutes, 2 hours, and 12 hours**.
* **Manual Replays:** You can manually resend an event from the replay UI for up to **7 days**. Replayed deliveries reuse the original `X-Orbit-Event` ID.

### Integration Recommendations
* **Status Code Hygiene:** Return `2xx` only after safely persisting the event. Return `5xx` or `429` for temporary downstream failures so Orbit retries, and `400` or `401` for invalid requests.
* **Timestamp Tolerance (Pending Product Confirmation):** If you reject stale `X-Orbit-Timestamp` values to prevent replay attacks, note that product confirmation is pending on whether `X-Orbit-Timestamp` is refreshed on automatic retries and 7-day manual UI replays.

## 4. Ordering and Idempotency

### Service Guarantees
* **At-Least-Once Delivery:** Duplicate deliveries can occur due to retries, network drops after processing, or manual replays.
* **Unordered Delivery:** Events usually arrive in creation order, but concurrent retries mean strict ordering is **not guaranteed**.

### Integration Recommendations
* **Idempotent Consumers:** Deduplicate incoming events using `X-Orbit-Event`. Store processed event IDs for at least **7 days** (covering the manual replay window) and return `200 OK` immediately when a duplicate arrives.
* **Order-Independent Logic:** Do not assume sequential delivery (for example, an update event may arrive before a create event during retries). Reconcile out-of-order states using resource versions or API lookups.

## 5. Key Rotation

### Service Guarantees
* **24-Hour Dual Validity:** During secret rotation, two secrets remain valid for **24 hours**, labeled `current` and `previous` in the UI.

### Integration Recommendations
* **Accept Both Secrets During Rotation (Pending Product Confirmation):** Product confirmation is pending on whether Orbit signs requests only with `current` during rotation or includes signatures for both secrets. Configure your verifier with both `current` and `previous` secrets (as shown in the Python example) and accept requests matching either secret until the 24-hour window ends.

## 6. Operational Advice

* **Acknowledge Fast, Process Async:** Do not run slow business logic or external API calls inside the 10-second request window. Verify the signature, enqueue the payload into a background worker queue, and immediately return `202 Accepted` or `200 OK`.
* **Monitor Queue and Ingress Health:** Alert on elevated `5xx` rates or response latencies approaching 10 seconds, and verify that log scrubbers redact raw payloads and secrets.

## 7. Troubleshooting

| Symptom | Likely Cause | Resolution |
| :--- | :--- | :--- |
| All signature checks fail | JSON was parsed/re-serialized before hashing, or `<X-Orbit-Timestamp>.` prefix was omitted | Hash exact raw request bytes prefixed with `X-Orbit-Timestamp` and `.`. |
| Signatures fail during key rotation | Verifier checks only one secret while `current` and `previous` are active | Check `X-Orbit-Signature` against both `current` and `previous` secrets for 24 hours. |
| Duplicate events processed | Handler took over 10 seconds to respond, or event was replayed without deduplication | Deduplicate by `X-Orbit-Event` (7-day TTL) and offload processing to an async queue. |
| Failed events are not retried | Endpoint returned a non-retryable `4xx` (`400`, `404`) or a `3xx` redirect | Return `5xx` or `429` on transient failures and use a direct non-redirecting URL. |
| Large payloads rejected | Proxy or framework body limit is under `512 KiB` | Allow request bodies up to at least `512 KiB`. |
| Manual UI replays rejected | Timestamp freshness check rejects original event timestamp | Confirm whether replay timestamps refresh; relax timestamp tolerance for verified UI replays. |
