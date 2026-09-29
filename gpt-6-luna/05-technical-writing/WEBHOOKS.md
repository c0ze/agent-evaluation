# Webhook delivery and verification

Orbit sends event notifications as JSON `POST` requests. Each request includes `X-Orbit-Event` (event ID), `X-Orbit-Type` (event type), `X-Orbit-Timestamp` (Unix seconds), and `X-Orbit-Signature`. The request body is limited to 512 KiB, and the sender identifies itself with the `Orbit-Hooks/2` User-Agent.

This guide labels documented service behavior as **Guarantee** and implementation advice as **Recommendation**. “Guarantee” reflects the current product notes; where those notes are unclear, the limit is called out.

## Verify the signature

**Guarantee:** The signature is `v1=<hex>` and uses HMAC-SHA-256 over the timestamp, a period, and the exact raw request-body bytes:

```text
HMAC-SHA-256(secret, timestamp + "." + raw_body)
```

An older note says to sign parsed JSON. That description conflicts with the current implementation and should be treated as stale. Parsing and re-serializing JSON can change whitespace, escaping, or key order, so verify the original bytes. Compare signatures in constant time. Orbit shows a secret only once; store it in a secret manager or protected environment variable and never log it.

**Product confirmation needed:** The documented HMAC input includes the timestamp and body, but not the event ID or event type headers. As documented, the signature does not bind those headers. Use them for routing and duplicate suppression, but do not treat them as authenticated authorization data until Orbit confirms the intended signing contract.

**Minimal Node.js/Express example:** install the raw-body handler on this route before any JSON parser, and replace the queue call with your durable queue or database operation.

```js
import express from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';

const app = express();
const secret = process.env.ORBIT_WEBHOOK_SECRET;

app.post('/webhooks/orbit', express.raw({
  type: 'application/json', limit: 512 * 1024,
}), async (req, res) => {
  const timestamp = req.get('X-Orbit-Timestamp');
  const signature = req.get('X-Orbit-Signature') ?? '';
  if (!secret || !timestamp || !/^v1=[0-9a-fA-F]{64}$/.test(signature)) {
    return res.sendStatus(400);
  }

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.`).update(req.body).digest();
  const supplied = Buffer.from(signature.slice(3), 'hex');
  if (supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)) return res.sendStatus(401);

  const eventId = req.get('X-Orbit-Event');
  const eventType = req.get('X-Orbit-Type');
  await enqueueDurably({ eventId, eventType, rawBody: req.body });
  return res.sendStatus(204);
});
```

This example checks the HMAC only. **Product confirmation needed:** the notes do not define a timestamp freshness window, so do not invent an age limit and reject requests based on one without confirming the policy. The timestamp is part of the signed input; it is not itself proof that a request is recent.

## Delivery, retries, and acknowledgments

**Guarantee:** Orbit considers any `2xx` response an acknowledgment, waits at most 10 seconds for it, and ignores the response body. It retries timeouts, network errors, `408`, `425`, `429`, and `5xx` responses. Other `4xx` responses are not retried. The approximate retry delays are 1 minute, 5 minutes, 30 minutes, 2 hours, and 12 hours. The notes do not say whether each delay is measured from the preceding attempt or from the initial attempt. That is five retries after the initial delivery, or at most six attempts when every attempt needs a retry.

**Recommendation:** Validate and durably enqueue a verified event, then return `2xx` promptly; do slow work asynchronously. Acknowledge only after the event is safely recorded, because Orbit will not use the response body to learn whether your application accepted it. Return a non-`2xx` when you cannot safely accept it. Do not rely on redirects: the notes do not say whether Orbit follows them, and redirect behavior needs product confirmation. Configure the final HTTPS endpoint directly.

## Ordering and idempotency

**Guarantee:** Duplicate deliveries can occur. Delivery generally follows event creation order, but concurrent retries mean order is not guaranteed. A replay from the UI is available for seven days and uses the same event ID as the original event.

**Recommendation:** Make processing idempotent. Persist `X-Orbit-Event` with the processing result and use it to prevent duplicate side effects. Do not use arrival order as event order. If an event type carries an authoritative version or sequence in its payload, apply updates using that value; otherwise reconcile with your source of truth when order matters. Since a manual replay retains the event ID, your deduplication policy may treat it as already processed; decide how operators should recover or reprocess an event. The notes do not specify a global uniqueness scope or a separate replay identifier.

## Rotate signing keys

**Guarantee:** During rotation, the current and previous secrets are both valid for 24 hours; the UI labels them “current” and “previous.”

**Recommendation:** On rotation, securely store the new current secret and keep the previous secret available during the overlap. If you cannot identify which key signed a request from another header, verify against each active secret using the same constant-time comparison. Remove the previous key after the 24-hour overlap ends and update the secret manager promptly. Never write either key to application logs, tickets, or shell history.

## Operate and troubleshoot

**Recommendation:** Track delivery outcomes, acknowledgment latency, event IDs and types, and processing failures. Keep logs useful but limited: redact credentials and avoid logging full payloads, which may contain sensitive data. Alert on a growing backlog or repeated verification failures. Ensure the endpoint can accept payloads up to 512 KiB and respond within the 10-second acknowledgment window.

| Symptom | What to check |
| --- | --- |
| Signature verification fails | Capture the raw bytes before JSON middleware; concatenate the timestamp, period, and those bytes; check the active secret(s) and `v1=` hex header. Do not sign parsed JSON. |
| The sender reports timeouts or repeats events | Keep synchronous work short; durably enqueue before returning any `2xx`, and make downstream effects idempotent by event ID. |
| Events appear out of order | Retries can race. Do not process by arrival order; use an authoritative payload version if available or reconcile state. |
| Delivery stops after an error | Check the HTTP status. Only the listed statuses and network/timeout failures are retried; other `4xx` responses are not. The automatic schedule has five retries. |
| Redirected endpoint does not receive events | Point Orbit directly at the final endpoint. Redirect-following behavior is unconfirmed; ask the product team before depending on it. |
| A large request is rejected | Check that your server and middleware allow bodies up to 512 KiB and preserve the raw bytes for verification. |
