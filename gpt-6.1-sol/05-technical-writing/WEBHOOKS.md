# Receiving Orbit webhooks

Orbit sends JSON events to your receiver using HTTP POST. Build the receiver to authenticate each request, durably accept work, and process duplicates safely. **Contract** identifies documented guarantees or behavior; **Recommendation** identifies receiver design choices. **Product confirmation** marks details that remain unresolved.

## Request format and verification

**Contract:** Requests include `X-Orbit-Event` (event ID), `X-Orbit-Type` (event type), `X-Orbit-Timestamp` (Unix seconds), and `X-Orbit-Signature` (`v1=<hex>`). Payloads are at most 512 KiB. The User-Agent is `Orbit-Hooks/2`; it is not an authentication mechanism.

The current implementation computes HMAC-SHA-256 over:

```text
timestamp_header_bytes + b"." + raw_request_body_bytes
```

Preserve the body exactly as received. Parsing JSON and serializing it again can change whitespace, key order, or encoding and invalidate the signature. Compare signatures in constant time.

Older documentation says to sign parsed JSON; another abbreviated note mentions only raw bytes. Both conflict with the explicit current implementation formula above. Follow that formula; **product confirmation** is required to establish it as the final published signing contract.

This minimal Python 3.9+ example uses only the standard library. Pass the unchanged body, the two header values, and securely loaded secret bytes. During rotation, pass both current and previous keys.

```python
import hashlib
import hmac
import re

def verify(raw_body: bytes, timestamp: str, signature: str,
           keys: tuple[bytes, ...]) -> bool:
    if not re.fullmatch(r"[0-9]+", timestamp):
        return False
    match = re.fullmatch(r"v1=([0-9a-fA-F]{64})", signature)
    if match is None:
        return False
    supplied = bytes.fromhex(match.group(1))
    message = timestamp.encode("ascii") + b"." + raw_body
    valid = False
    for key in keys:
        expected = hmac.new(key, message, hashlib.sha256).digest()
        valid |= hmac.compare_digest(expected, supplied)
    return valid
```

**Recommendation:** Verify before parsing or enqueueing. Reject malformed headers and failed signatures. The example authenticates the signed bytes but does not enforce timestamp freshness. Confirm how to convert the displayed secret into key bytes; do not assume it is hex or base64. The formula does not cover the event ID or type headers, so do not assume those headers are independently authenticated.

For replay protection, consider a configurable freshness window, such as five minutes, with synchronized clocks. **Product confirmation:** Do retries and manual replays receive fresh timestamps and signatures? Establish this before enabling strict freshness checks, which could otherwise reject legitimate deliveries.

## Delivery and retries

**Contract:** Your receiver has 10 seconds to return any `2xx` response. Orbit ignores the response body. A timeout, network error, HTTP `408`, `425`, `429`, or `5xx` triggers retry. Other `4xx` responses are not retried.

There are five retries after the initial attempt: at most six attempts in the automatic sequence. Listed retry timings are roughly one minute, five minutes, 30 minutes, two hours, and 12 hours. These are approximate, not scheduling guarantees. **Product confirmation:** The notes do not establish whether these timings are successive delays or offsets from the initial attempt, or whether `Retry-After` affects them. Do not derive an exact exhaustion deadline.

**Recommendation:** Return `2xx` only after persisting the event or durably enqueueing it. Complete business processing asynchronously. Return a retryable status when durable acceptance fails or the receiver is temporarily overloaded. Acknowledge an already accepted duplicate with `2xx`. A lost acknowledgment can cause another attempt even when your first attempt succeeded locally.

## Ordering, idempotency, and replay

**Contract:** Duplicates are possible. Delivery usually follows event creation, but concurrent retries mean order is not guaranteed. There is no exactly-once processing guarantee. The replay UI can resend an event for seven days and keeps the same event ID.

**Recommendation:** Use `X-Orbit-Event` as the deduplication identifier. Make the deduplication record and corresponding state change atomic, or use a durable inbox with unique IDs and idempotent workers. A check-then-write sequence without concurrency protection can process simultaneous duplicates twice. Ensure downstream side effects also tolerate retries.

Retain deduplication records through the seven-day replay period and allow additional margin for delayed processing. The notes do not define the replay period's starting point or event-ID uniqueness scope; confirm these before choosing a retention boundary or a cross-account deduplication key. Avoid assuming arrival order reflects current state; reconcile against authoritative state when available.

## Secret rotation and operations

**Contract:** A secret is shown once. During rotation, two secrets are valid for 24 hours; the UI labels them current and previous.

**Recommendation:** Store secrets in a secret manager. Deploy verification with both keys during the overlap, monitor acceptance with the current key, and retire the previous key when its validity ends. Do not infer a rotation start time or which key signs outbound requests; confirm the overlap anchor and signing-key transition with product.

Monitor response latency against the 10-second deadline, retryable failures, signature failures, duplicate rates, and queue backlog. Record event IDs, status codes, and timing for diagnosis. Never log secrets or full sensitive payloads. Use bounded request buffering for the 512 KiB limit. Test rotation, concurrent duplicates, slow responses, and durable queue failures before rollout.

## Troubleshooting

| Symptom | Check and action |
| --- | --- |
| Signature mismatch | Preserve raw bytes; use timestamp plus dot plus body; check key bytes and rotation overlap. |
| Legitimate event rejected as stale | Check clock skew and freshness policy; confirm retry/replay timestamp behavior. |
| Duplicate side effects | Make deduplication atomic and downstream actions idempotent. |
| Older event arrives later | Ordering is not guaranteed; reconcile state instead of trusting arrival order. |
| Repeated attempts | Check timeouts, retryable responses, queue availability, and acknowledgment latency. |
| No retry after a client error | Other `4xx` responses are terminal for automatic retries; fix the receiver and use replay if eligible. |
| Endpoint redirects | Redirect following is unconfirmed. Security expects no following; configure a directly reachable endpoint. |
