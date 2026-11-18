# Receive Orbit webhooks

Orbit sends an HTTP POST with a JSON body of up to 512 KiB. The `X-Orbit-Event` header carries the event ID, and `X-Orbit-Type` identifies the event type. Requests use the user agent `Orbit-Hooks/2`. Use the event ID to recognize a delivery you have already accepted, including one an operator resends from the replay UI.

## Verify the request

Orbit uses HMAC-SHA-256. The signed message consists of the `X-Orbit-Timestamp` header value (Unix seconds), one literal period, and the exact request body bytes, in that order. Orbit sends the digest as `v1=<hex>` in `X-Orbit-Signature`. Older documentation describes signing parsed JSON. The current implementation signs the timestamp and raw body. Even an extra space introduced by serializing the JSON again changes the digest.

Capture the body before JSON middleware transforms it. This Python example takes the raw bytes, the framework’s case-insensitive request headers, and a list of active signing keys as bytes. Reject a request that fails verification before dispatching any work.

```python
import hmac
import re


def verified(raw_body, headers, active_keys):
    timestamp = headers.get("X-Orbit-Timestamp", "")
    signature = headers.get("X-Orbit-Signature", "")
    match = re.fullmatch(r"v1=([0-9a-fA-F]{64})", signature)
    if match is None or not re.fullmatch(r"[0-9]+", timestamp):
        return False

    received = bytes.fromhex(match.group(1))
    message = timestamp.encode("ascii") + b"." + raw_body
    return any(
        hmac.compare_digest(hmac.digest(key, message, "sha256"), received)
        for key in active_keys
    )
```

The example uses a constant-time digest comparison. A request can pass signature verification more than once, so keep the duplicate check in your handler. Whether Orbit refreshes the timestamp on retries and UI replays still needs confirmation before you rely on a fixed age cutoff.

## Delivery guarantees and retry limits

Orbit allows 10 seconds for your endpoint to return any 2xx status. That status acknowledges delivery, and Orbit ignores the response body. Orbit retries timeouts, network errors, HTTP 408, 425, 429, and all 5xx responses. Other 4xx responses receive no automatic retry.

There are up to five retries after the initial attempt, for a maximum of six automatic attempts. The retry schedule is approximately 1 minute, 5 minutes, 30 minutes, 2 hours, and 12 hours. Treat those times as estimates. An operator can also replay an event through the UI for seven days. A replay carries the same event ID as the original delivery.

**Pending product confirmation.** Orbit’s handling of redirects is unconfirmed. Configure the final HTTPS URL directly so delivery does not depend on a 3xx response.

## Recommended handling for duplicates and ordering

After verification, parse and validate the JSON. In one database transaction, store the event ID and payload as a pending work item, with a unique constraint on the ID. Return a 2xx once the transaction commits. If a concurrent delivery already committed a row for that ID, acknowledge the duplicate with a 2xx as well. If the write fails because storage is temporarily unavailable, return a 503 so Orbit can retry. This sequence also covers a lost acknowledgment after a successful commit.

Have a worker process pending items and record completion. For external side effects, pass the event ID as an idempotency key where the downstream service supports it. This protects against a worker repeating an operation after a crash between the side effect and the completion update. Retain processed IDs through at least the seven-day replay window and longer while related deliveries or work remain outstanding.

Events usually arrive in creation order, but concurrent retries can deliver an older event after a newer one. Deduplicating by ID still leaves two distinct events free to arrive in either order. If a late event could overwrite newer state, reconcile against the current record in your system of record before applying the update.

## Rotate keys and monitor delivery

Orbit shows each secret once. Save it in your secret store when it appears. During rotation, the UI labels the two valid secrets **current** and **previous**. Both are valid for 24 hours. Deploy the current secret to every receiver during that overlap, verify with either active key, and retire the previous one when the overlap ends.

Allow a 512 KiB request body through both your proxy and your application. Monitor response latency against the 10-second deadline and track worker failures separately so an acknowledged event cannot sit unnoticed. For diagnosis, log the event ID, event type, response status, and elapsed time. Keep secrets and full sensitive payloads out of logs.

## Troubleshooting

| Symptom | What to check or do |
| --- | --- |
| Signature check fails | Check that the proxy forwards both signature and timestamp headers. Use the original timestamp text and capture body bytes before parsing. During rotation, check the keys loaded on the failing instance. |
| The same ID arrives twice | Check for a timeout or a manual replay. Look up the committed work item before issuing the side effect again. |
| Deliveries time out | Measure time to the 2xx, including the database commit. Move slow downstream calls to the worker. |
| A large event receives 413 | Check body limits at each hop. After correcting the limit, use the replay UI within the seven-day window. A 413 ends automatic attempts. |
| A replay receives 2xx but changes nothing | Inspect the work item for that ID. A receiver that already accepted it may acknowledge the duplicate. If processing failed, recover the pending or failed work item. |
