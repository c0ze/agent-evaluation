# Orbit Webhooks Developer Guide

Orbit webhooks deliver real-time HTTP POST notifications when account events occur. This guide details payload specifications, signature verification, delivery and retry semantics, idempotency, and operational best practices.

---

## 1. Protocol Specifications & Core Headers

Orbit delivers events as HTTP POST requests with JSON payloads (`Content-Type: application/json`). Every request includes:

| Header | Description | Example |
| :--- | :--- | :--- |
| `X-Orbit-Event` | Unique event ID | `evt_01H8X9A7BC4D` |
| `X-Orbit-Type` | Event type | `order.created` |
| `X-Orbit-Timestamp` | Dispatch timestamp (Unix epoch seconds) | `1773342000` |
| `X-Orbit-Signature` | HMAC-SHA256 signature (`v1=<hex>`) | `v1=7f83b165...` |
| `User-Agent` | Webhook client identifier | `Orbit-Hooks/2` |

### Guarantees vs. Recommendations

* **Guarantees (Sender Contract):**
  * Maximum payload size is **512 KiB**.
  * Any HTTP `2xx` response returned within **10 seconds** confirms delivery; response bodies are ignored.
  * Payloads are signed with HMAC-SHA256 computed over `${timestamp}.${rawBody}`.
  * Automated retries and manual dashboard replays preserve the original `X-Orbit-Event` ID.
* **Recommendations (Receiver Contract):**
  * Return `200 OK` immediately and process events asynchronously.
  * Store processed `X-Orbit-Event` IDs to ignore duplicate deliveries.
  * Reject requests where `X-Orbit-Timestamp` drifts beyond 5 minutes to prevent replays.
  * Configure canonical URLs directly; avoid HTTP `3xx` redirects.

---

## 2. Signature Verification

Requests are signed using a shared secret generated in the Orbit dashboard. The secret is revealed only once; store it in a secure secret store.

### Canonical Signing Format

Signatures are computed as HMAC-SHA256 over:
```
canonical_string = `${X-Orbit-Timestamp}.${raw_request_body}`
```

> **Legacy Documentation Conflict:** Older documentation suggested signing parsed JSON. This is obsolete. The active dispatcher computes signatures over exact, unparsed request bytes preceded by `${timestamp}.`. Capture raw request bytes before JSON body parsers alter formatting, key order, or whitespace.

### Verification Example (Node.js)

```javascript
const crypto = require('crypto');

function verifyOrbitWebhook(rawBody, signatureHeader, timestampHeader, secret, toleranceSec = 300) {
  const timestamp = parseInt(timestampHeader, 10);
  if (Number.isNaN(timestamp) || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > toleranceSec) {
    throw new Error('Timestamp outside tolerance window');
  }

  const [version, expectedSig] = (signatureHeader || '').split('=');
  if (version !== 'v1' || !expectedSig) {
    throw new Error('Invalid signature format');
  }

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`${timestamp}.`);
  hmac.update(rawBody);
  const computedSig = hmac.digest('hex');

  const expectedBuf = Buffer.from(expectedSig, 'hex');
  const computedBuf = Buffer.from(computedSig, 'hex');
  if (expectedBuf.length !== computedBuf.length || !crypto.timingSafeEqual(expectedBuf, computedBuf)) {
    throw new Error('Signature mismatch');
  }
  return true;
}
```

> **Security Warning:** Never log webhook secrets or unmasked request payloads in application logs.

---

## 3. Delivery and Retry Semantics

### Timeout and Acknowledgement

Endpoints must return HTTP `2xx` within **10 seconds**. Requests that time out, fail at the network layer, or return retryable status codes fail delivery. Response bodies are ignored.

### Retry Schedule and Triggers

Orbit retries failed deliveries up to **5 times** (6 attempts total) over ~14 hours:
* Initial attempt
* Retry 1: ~1 minute
* Retry 2: ~5 minutes
* Retry 3: ~30 minutes
* Retry 4: ~2 hours
* Retry 5: ~12 hours

Retry behavior is governed by the HTTP response:
* **Retryable:** Timeouts (>10s), network errors, HTTP `408`, `425`, `429`, and all `5xx` errors.
* **Non-Retryable:** Other `4xx` client errors (`400`, `401`, `403`, `404`, `422`) immediately terminate delivery.

> **Pending Product Confirmation (Redirects):** Security policy discourages following redirects, but dispatcher behavior on `3xx` codes is unconfirmed by engineering. Do not redirect webhook endpoints; configure canonical URLs directly.

---

## 4. Ordering and Idempotency

* **At-Least-Once Delivery:** Network retries can cause duplicate deliveries.
* **Out-of-Order Delivery:** Events dispatch in creation order, but concurrent retries may deliver later events (e.g., `order.updated`) before earlier ones (e.g., `order.created`).
* **Idempotency Guidance:** Store processed `X-Orbit-Event` IDs in an atomic store (e.g., relational unique index or Redis). If an ID was previously processed, return `200 OK` and skip business logic.
* **Event Replays:** The dashboard allows manual event replays for up to **7 days** using the original `X-Orbit-Event` ID.

---

## 5. Secret Key Rotation

To rotate secrets without downtime:
1. **Dual-Key Window:** During rotation, two keys remain valid concurrently for **24 hours**, labeled **Current** and **Previous** in the dashboard.
2. **Verification Logic:** Test signatures against the Current secret first. If verification fails during active rotation, test against the Previous secret. Reject requests that fail both with HTTP `401`.
3. **Revocation:** After 24 hours, the previous secret expires permanently.

---

## 6. Operational Advice

* **Asynchronous Ingestion:** Buffer payloads into a message queue (SQS, Kafka, RabbitMQ) and acknowledge with HTTP `200` immediately to stay within the 10-second limit.
* **Payload Size Limits:** Max payload size is guaranteed to be 512 KiB. Ensure proxies and web servers allow request bodies of this size.
* **Traffic Inspection:** Inspect `User-Agent: Orbit-Hooks/2` to identify and route webhook traffic.

---

## 7. Troubleshooting Guide

| Symptom | Probable Cause | Recommended Action |
| :--- | :--- | :--- |
| Signature verification fails (HTTP 401) | Payload parsed before verification, or secret mismatch | Compute HMAC over `${timestamp}.${rawBody}` using raw bytes before JSON parsing; verify secret key. |
| Verification fails during key rotation | Handler only checks retired key | Test signature against Current secret, then Previous secret during the 24h transition. |
| Repeated delivery retries / timeouts | Synchronous handling exceeded 10s limit | Return `200 OK` immediately; process events asynchronously via background worker. |
| Delivery halted after single failure | Endpoint returned non-retryable 4xx | Inspect logs for 400/401/403/404; ensure handler returns 2xx or retryable 5xx. |
| Duplicate actions processed | Retries or manual UI replays received | Deduplicate processing using `X-Orbit-Event` in persistent storage. |
| Delivery fails on redirected URL | Endpoint returned HTTP 3xx redirect | Configure canonical target URL directly; redirects are unconfirmed and discouraged. |
| HTTP 413 / Request too large | Server limit below 512 KiB | Configure server and reverse proxy body limits to accept up to 512 KiB. |
