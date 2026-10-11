# Orbit Webhooks Developer Guide

Orbit delivers real-time notifications for platform events using HTTP POST requests containing JSON payloads. This guide explains how to receive, verify, and process these webhooks reliably.

---

## 1. Request Anatomy

Every webhook delivery includes the following HTTP headers:

| Header | Description | Example |
| :--- | :--- | :--- |
| `X-Orbit-Event` | Unique event identifier (UUID) | `evt_01H7ABC123` |
| `X-Orbit-Type` | Event type name | `order.created` |
| `X-Orbit-Timestamp` | Dispatch time (Unix epoch in seconds) | `1727654400` |
| `X-Orbit-Signature` | HMAC SHA-256 signature (`v1=<hex>`) | `v1=a3f89...` |
| `User-Agent` | Delivery user agent | `Orbit-Hooks/2` |

- **Method & Format**: HTTP `POST` with a valid JSON body.
- **Payload Size**: Up to 512 KiB. Receivers must configure body parsers accordingly.

---

## 2. Guarantees vs. Recommendations

### Service Guarantees
- **At-least-once delivery**: Every event is delivered at least once unless permanently dropped by a non-retryable response.
- **10-second response window**: Receivers have 10 seconds to respond before Orbit times out and retries.
- **2xx acceptance**: Any HTTP `2xx` status code is treated as success. The response body is ignored.
- **24-hour dual-secret validity**: During rotation, both `current` and `previous` secrets remain valid for 24 hours.
- **7-day replay window**: Events can be manually resent via the Orbit UI for 7 days with their original `X-Orbit-Event` ID.

### Recommendations
- **Idempotency**: Treat `X-Orbit-Event` as an idempotency key to prevent processing duplicates.
- **Unordered handling**: Delivery order is **not guaranteed**; concurrent retries can invert delivery sequence.
- **Immediate acknowledgement**: Return `200 OK` or `202 Accepted` immediately and process work asynchronously in a queue.
- **Replay prevention**: Reject requests whose `X-Orbit-Timestamp` differs from system time by more than 5 minutes.
- **Log sanitization**: Never log webhook secrets or full raw payloads containing sensitive data.

---

## 3. Signature Verification

Orbit signs payloads using HMAC SHA-256 to ensure authenticity.

### Algorithm
The signature is generated over the timestamp, a dot, and the raw payload bytes:
$$\text{HMAC-SHA256}(\text{secret}, \text{timestamp} + \text{"."} + \text{raw\_body})$$

> **Doc Conflict Note**: Older documentation referenced signing parsed JSON. This is obsolete. Verify signatures using raw request bytes; parsing JSON alters whitespace and key order, causing verification to fail.

### Minimal Verification Example (Node.js)

```javascript
const crypto = require('crypto');

function verifyOrbitWebhook(rawBody, headers, secrets, toleranceSec = 300) {
  const sig = headers['x-orbit-signature'];
  const ts = parseInt(headers['x-orbit-timestamp'], 10);
  if (!sig || !ts || Math.abs(Math.floor(Date.now() / 1000) - ts) > toleranceSec) {
    return false;
  }
  if (!sig.startsWith('v1=')) return false;
  const provided = Buffer.from(sig.slice(3), 'utf8');
  const payload = Buffer.concat([Buffer.from(`${ts}.`), Buffer.from(rawBody)]);
  const keys = Array.isArray(secrets) ? secrets : [secrets];

  return keys.some(key => {
    const expected = Buffer.from(
      crypto.createHmac('sha256', key).update(payload).digest('hex'),
      'utf8'
    );
    return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
  });
}
```

---

## 4. Delivery and Retry Semantics

Orbit implements an automated stepped retry policy when deliveries fail or exceed the 10-second timeout.

### Retry Triggers
- **Retried**: Connection timeouts, network errors, HTTP `408`, `425`, `429`, and all `5xx` statuses.
- **Never Retried**: Other `4xx` statuses (`400`, `401`, `403`, `404`, `422`). Unhandled client errors permanently drop the webhook.

### Retry Schedule
Orbit makes 1 initial attempt and up to 5 retries (6 total attempts) spaced approximately:
1. **Initial**: Immediate
2. **Retry 1**: ~1 minute
3. **Retry 2**: ~5 minutes
4. **Retry 3**: ~30 minutes
5. **Retry 4**: ~2 hours
6. **Retry 5**: ~12 hours

---

## 5. Ordering, Duplicates, and Idempotency

- **Duplicates**: Network interruptions during delivery acknowledgments can trigger retries for already processed events.
- **Ordering**: Delivery order usually follows creation, but concurrent retries mean chronological ordering is **not guaranteed**.

### Idempotency Best Practices
1. Store processed `X-Orbit-Event` IDs in a transactional database or cache.
2. If an event ID was already processed, return `200 OK` and ignore the payload.
3. Use domain entity timestamps or sequence numbers to ignore older updates arriving after newer ones.

### Manual Event Replay
The Orbit dashboard allows replaying events for up to 7 days. Replays reuse the original `X-Orbit-Event` ID. Configure receivers to permit re-execution when manual redelivery is desired.

> **Confirmation Needed**: Whether manual replays emit a fresh `X-Orbit-Timestamp` or the original timestamp is pending engineering confirmation. If original timestamps are preserved, receivers enforcing timestamp tolerance checks will reject manual replays unless configured to handle historical replays.

---

## 6. Secret Rotation

Orbit displays webhook secrets once upon creation. To rotate secrets without downtime:
1. In the Orbit dashboard, initiate rotation. Orbit generates a new secret and labels the existing one as `previous`. Both remain valid for 24 hours.
2. Configure your receiver with both secrets (supported by passing an array to `verifyOrbitWebhook`).
3. Deploy your receiver changes.
4. After 24 hours, remove the `previous` secret from your service configuration.

---

## 7. Operational Advice

- **Asynchronous Execution**: Acknowledge receipt within the 10-second limit and dispatch tasks to an asynchronous queue.
- **Buffer Sizing**: Ensure web servers (e.g., Express, Nginx) allow JSON payloads up to 512 KiB.
- **Network Filtering**: Identify requests using the `User-Agent: Orbit-Hooks/2` header.
- **Avoid Redirects**: Always provide canonical endpoint URLs. *(Confirmation Needed: Redirect behavior is unconfirmed; security advises that redirects may not be followed).*
- **Log Hygiene**: Do not log raw secrets or full request payloads to application logs.

---

## 8. Troubleshooting Guide

| Symptom | Probable Cause | Resolution |
| :--- | :--- | :--- |
| **`401` / Signature Failure** | Body parsed before verification or secret mismatch. | Verify over raw bytes (`${timestamp}.${raw_body}`). Check active secret in dashboard. |
| **10-Second Timeouts** | Synchronous heavy processing in the request path. | Return `200 OK` immediately; defer work to a background worker queue. |
| **Duplicate Processing** | At-least-once delivery retry after network blip. | Deduplicate atomically using the `X-Orbit-Event` header. |
| **Dropped Deliveries** | Receiver returned non-retryable `4xx` (`400`, `404`). | Fix endpoint routing or schema validation; Orbit does not retry non-retryable `4xx`. |
| **Out-of-Order Updates** | Retried earlier event arrived after a newer event. | Compare entity version or update timestamp before persisting changes. |
| **Silent Failures on `3xx`** | Endpoint responds with HTTP redirect. | Use the final canonical endpoint URL; avoid redirects. |
| **`413 Payload Too Large`** | Server body parser limit set below 512 KiB. | Configure request parser limits to at least 512 KiB. |
