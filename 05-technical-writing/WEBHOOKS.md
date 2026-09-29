# Receiving Orbit webhooks

Orbit sends event notifications as HTTP POST requests containing JSON. Build your receiver to verify each request, durably accept the event, and process it safely when deliveries repeat or arrive out of order.

**Contract and uncertainty:** “Documented behavior” below describes the supplied service contract and current implementation. “Recommended” identifies receiver design advice. Items marked “Product confirmation required” are unresolved; do not depend on them as guarantees.

## Request format

**Documented behavior:** Payloads have a maximum size of 512 KiB. Requests use `User-Agent: Orbit-Hooks/2` and these headers:

| Header | Meaning |
| --- | --- |
| `X-Orbit-Event` | Event ID; also reused by manual replay |
| `X-Orbit-Type` | Event type |
| `X-Orbit-Timestamp` | Timestamp in Unix seconds |
| `X-Orbit-Signature` | HMAC SHA-256 digest, formatted as `v1=<hex>` |

The user agent identifies traffic but does not authenticate it. Configure request limits to accommodate the documented payload size.

## Verify before processing

**Current implementation:** The signed message is the timestamp header value, followed by a literal dot (`.`), followed by the exact raw request body bytes. Compute HMAC SHA-256 with the webhook secret and compare digests in constant time.

**Source conflict:** Older documentation says to sign parsed JSON; another note mentions raw bytes without the timestamp prefix. The current implementation description specifies `timestamp + "." + raw body`, so this guide uses that format. Parsing and reserializing JSON can change the bytes and break verification. Product should confirm the format as the authoritative contract and retire the conflicting guidance.

This minimal Python example uses only the standard library. Supply the unchanged timestamp and signature header values, the raw body, and the exact secret bytes from secure configuration:

```python
import hashlib
import hmac
import re


def verify(raw_body: bytes, timestamp: str, signature: str,
           secrets: tuple[bytes, ...]) -> bool:
    if not re.fullmatch(r"[0-9]+", timestamp):
        return False
    match = re.fullmatch(r"v1=([0-9a-fA-F]{64})", signature)
    if match is None:
        return False

    supplied = bytes.fromhex(match.group(1))
    message = timestamp.encode("ascii") + b"." + raw_body
    valid = False
    for secret in secrets:
        expected = hmac.new(secret, message, hashlib.sha256).digest()
        valid |= hmac.compare_digest(expected, supplied)
    return valid
```

**Recommended:** Reject missing required headers before calling this function; reject failed verification before parsing or acting on JSON. Pass the current secret and, during rotation, the previous secret. Keep framework middleware from consuming or transforming the body first. The example accepts one `v1` digest; it does not define behavior for duplicate headers or multiple signatures.

The example verifies authenticity, not freshness. **Product confirmation required:** Whether retries and manual replays receive new timestamps is unspecified, as is an accepted clock-skew window. Agree on a freshness policy before enforcing an age limit that could reject legitimate deliveries. A timestamp alone does not prevent replay, and the documented signed message does not include the event ID or type headers; their authenticated binding needs confirmation.

## Acknowledgment and retries

**Documented behavior:** Your receiver has 10 seconds to return any `2xx` response. Orbit ignores the response body. Orbit retries timeouts, network errors, HTTP `408`, `425`, `429`, and `5xx` responses. Other `4xx` responses are not retried.

There are five retries after the initial attempt: at most six attempts in that automatic retry sequence. The listed retry schedule is approximately 1 minute, 5 minutes, 30 minutes, 2 hours, and 12 hours. These are approximate timings, not deadlines. **Product confirmation required:** The notes do not say whether those values are delays between attempts or offsets from the first attempt; no total retry duration is promised here.

**Recommended:** Verify and durably enqueue the event, then acknowledge within 10 seconds. Process expensive work asynchronously. If durable acceptance fails temporarily, return a retryable status instead of acknowledging work you could lose. An acknowledgment may be lost in transit, so successful processing does not rule out another delivery. Finite retries do not guarantee eventual receipt.

**Product confirmation required:** Redirect handling is unknown. Security expects redirects not to be followed, but implementation ownership has not confirmed this. Configure a directly reachable final endpoint and avoid depending on `3xx` behavior.

## Duplicates, ordering, and recovery

**Documented behavior:** Duplicates are possible. Delivery usually follows creation order, but concurrent retries mean ordering is not guaranteed. The replay UI can resend an event for seven days and preserves its event ID.

**Recommended:** Use `X-Orbit-Event` as the deduplication key within your integration. Persist processing state and coordinate deduplication with business updates or use idempotent downstream operations. An in-memory cache or an uncoordinated “check, then write” can allow duplicate effects under concurrency. Acknowledge an already durably accepted duplicate with `2xx`.

Retain deduplication records through the seven-day replay window, with additional allowance for in-flight deliveries and your recovery process; the exact retention horizon needs confirmation. Manual replay is a redelivery, not a request to repeat completed business effects. Avoid letting late events blindly overwrite newer state; reconcile against authoritative state when your application has that capability.

## Secret rotation and operations

**Documented behavior:** The secret is shown once. During rotation, two secrets are valid for 24 hours, labeled current and previous in the UI.

**Recommended:** Store secrets securely when revealed. During the overlap, deploy verification with both keys to every receiver instance. Confirm the rollout before retiring the previous key after the overlap. Product must confirm the precise overlap start and signing-key switch behavior.

Monitor acknowledgment latency, response codes, signature failures, duplicate rates, and queue backlog. Log event IDs, attempt outcomes, and timings; do not log secrets or full sensitive payloads. Use the replay UI to recover missed events within its seven-day window while preserving deduplication.

## Troubleshooting

| Symptom | Check and action |
| --- | --- |
| Signature fails | Preserve raw bytes and timestamp text; include the dot; check current/previous keys. |
| Repeated delivery | Check for timeouts or retryable responses; acknowledge promptly and deduplicate. |
| Failed request is not retried | Check for a non-retryable `4xx` or exhausted attempts; consider eligible replay. |
| State appears to regress | Check arrival order; prevent stale updates and reconcile state. |
| Failure after rotation | Check all receiver instances have the current secret and overlap has not expired. |
| Redirected endpoint misses events | Use the final URL directly; redirect handling remains unconfirmed. |
