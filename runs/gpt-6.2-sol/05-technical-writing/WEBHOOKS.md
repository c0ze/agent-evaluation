# Orbit webhook delivery guide

Orbit sends webhook events as HTTP POST requests with JSON bodies up to 512 KiB. Use an HTTPS endpoint and keep the raw request body available so your handler can verify the signature before it parses the JSON.

## Request format and verification

| Header | Value |
| --- | --- |
| `X-Orbit-Event` | Event ID. Use this value to recognize repeat deliveries. |
| `X-Orbit-Type` | Event type. |
| `X-Orbit-Timestamp` | Unix timestamp in seconds. |
| `X-Orbit-Signature` | `v1=<hex>`, a hex-encoded HMAC-SHA-256 digest. |
| `User-Agent` | `Orbit-Hooks/2`. |

Orbit computes the HMAC using the webhook secret as the key. The signed message is the timestamp header value as received, followed by a literal dot (`.`) and the raw request body bytes. Capture those bytes before JSON parsing so that whitespace, encoding, and line endings stay intact. The event and type headers sit outside the signed message.

Older Orbit documentation described signing parsed JSON. Update any verifier built from that documentation to use the current signing format.

### Minimal Python example

Pass the raw body as bytes, the timestamp and signature header values as strings, and a collection of webhook secrets as byte strings. The example accepts a single `v1` signature and uses a constant-time digest comparison for each configured secret.

```python
import hmac
import re


def verify_webhook(raw_body, timestamp_header, signature_header, secrets):
    timestamp = timestamp_header or ""
    signature = re.fullmatch(r"v1=([0-9a-fA-F]{64})", signature_header or "")
    if not re.fullmatch(r"[0-9]+", timestamp) or signature is None:
        return False

    signed_message = timestamp.encode("ascii") + b"." + raw_body
    received = bytes.fromhex(signature.group(1))
    verified = False
    for secret in secrets:
        expected = hmac.digest(secret, signed_message, "sha256")
        verified |= hmac.compare_digest(expected, received)
    return verified
```

If verification fails, reject the request with a status such as `400` before processing it. If you enforce timestamp freshness, confirm how Orbit sets timestamps on retries and UI replays before choosing a cutoff. If Orbit reuses the original timestamp, a short cutoff could reject legitimate later attempts.

## Delivery and retry behavior

Your endpoint has 10 seconds to return any HTTP `2xx` response. Orbit treats that response as a successful delivery and ignores the response body.

Orbit retries on timeouts, network errors, HTTP `408`, `425`, `429`, and `5xx` responses. Other `4xx` responses end automatic retries for that delivery. Orbit can make up to five retries after the initial attempt. The approximate retry schedule lists 1 minute, 5 minutes, 30 minutes, 2 hours, and 12 hours. The reference point for those times still needs product confirmation.

Redirect handling also requires product confirmation. Register the final endpoint URL directly and check that your proxy and application serve that path without a redirect.

## Ordering and idempotency

Deliveries usually follow creation order. Orbit provides no ordering guarantee, and concurrent retries can deliver an older event after a newer one. Duplicate deliveries are possible, including when your handler records an event but Orbit times out before receiving the acknowledgment. The replay UI can resend an event for seven days and preserves the event ID.

Use a durable record keyed by `X-Orbit-Event` to deduplicate concurrent attempts, retries, and UI replays. For example, insert the event and its pending work into a database in one transaction, using a unique constraint on the event ID. Acknowledge with `2xx` once the work is durable. Return `2xx` for a verified duplicate once you know the event is already recorded. Keep deduplication records through the retry and replay windows.

Process the pending work asynchronously and make its side effects idempotent. For example, pass the event ID as an idempotency key to downstream APIs that support it. If processing depends on the latest state, use a version check or reconcile with the source of truth before applying an update.

## Key rotation

Orbit shows each webhook secret once. Store it in your secret manager when it is displayed. After rotation, the current and previous secrets are both valid during a 24-hour overlap. The UI labels them **Current** and **Previous**.

Prepare your verifier to accept either configured secret during the overlap. Add the new secret to the receiver as soon as it is available and check that verified deliveries continue. Remove the previous secret from the receiver once the overlap ends.

## Operating your endpoint

Configure your proxy and application to accept webhook bodies up to 512 KiB. Keep the acknowledgment path fast by verifying and recording the event before handing off longer work. Return a retryable status such as `503` if a temporary failure prevents durable acceptance. Monitor response codes, acknowledgment latency, verification failures, and processing backlog. Log event IDs and enough context to diagnose failures while keeping secrets and full sensitive payloads out of logs.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Signatures fail after a handler or proxy change | Ensure the verifier receives the original body bytes and uses the timestamp header, dot, and body in that order. |
| Verification failures start after rotation | Check that the receiver has the new secret and still accepts the previous secret during the overlap. |
| Orbit retries an event you already processed | Check whether a `2xx` reached Orbit within 10 seconds and whether the event ID was recorded before acknowledgment. |
| A delivery ends after one attempt | Check whether the endpoint returned a `4xx` other than `408`, `425`, or `429`. |
| The endpoint returns a redirect | Check the registered URL and route directly to the handler. |
| Replaying an event does not repeat a side effect | Check the deduplication record. UI replays preserve the event ID. |
