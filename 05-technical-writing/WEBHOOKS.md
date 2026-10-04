# Orbit webhooks

Orbit sends your endpoint an HTTP `POST` with a JSON body whenever a subscribed
event occurs. The request carries a `User-Agent` of `Orbit-Hooks/2`, a
`Content-Type` of `application/json`, and a body no larger than 512 KiB.

| Header | Meaning |
| --- | --- |
| `X-Orbit-Event` | Stable identifier for this event |
| `X-Orbit-Type` | Event type |
| `X-Orbit-Timestamp` | Unix time in seconds when the delivery was created |
| `X-Orbit-Signature` | `v1=<hex>` HMAC-SHA256 signature |

Sections below are labelled **[Guarantee]** when Orbit commits to the behavior and
**[Recommendation]** when it is advice we suggest but do not enforce.

## Verifying a delivery

Your signing secret is shown once, when you create the endpoint. Store it in your
secret manager, not in source control.

**[Guarantee]** The signature is an HMAC-SHA256, keyed with your endpoint secret,
computed over this exact byte string:

```
<X-Orbit-Timestamp> "." <raw request body>
```

Use the **raw body bytes exactly as received** — not a re-serialized parse of the
JSON. Parsing and re-serializing changes key order and whitespace and will break
the signature. Compare digests in constant time.

> **Note on conflicting documentation.** Older Orbit documentation said the
> signature covered the parsed JSON. That is stale; the current implementation
> signs timestamp + `.` + raw body as described above. If you are migrating from
> an older integration, keep verification accepting the previous scheme during
> the transition.

```js
import crypto from "node:crypto";

// body must be the raw buffer, e.g. express.raw({ type: "*/*" })
function verify(req, secret) {
  const parts = Object.fromEntries(
    req.headers["x-orbit-signature"]?.split(",").map((p) => p.trim().split("="))
  );
  const timestamp = req.headers["x-orbit-timestamp"];
  if (!parts.v1 || !timestamp) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.`)
    .update(req.rawBody)
    .digest();
  const received = Buffer.from(parts.v1, "hex");

  return received.length === expected.length &&
    crypto.timingSafeEqual(received, expected);
}
```

**[Recommendation]** Reject deliveries whose `X-Orbit-Timestamp` is more than five
minutes old. Orbit does not currently expire deliveries on your side, so this
tolerance window is your own control against replayed requests.

## Responding

**[Guarantee]** You have 10 seconds to return any `2xx` status. The response body
is ignored. Anything outside `2xx` is treated as a failure.

## Retries

**[Guarantee]** Orbit retries on timeouts, network errors, and responses with
status `408`, `425`, `429`, or any `5xx`. Other `4xx` responses are not retried —
returning `400` to stop a specific delivery is a supported way to discard an event
you cannot or should not process.

**[Guarantee]** There are five retries after the initial attempt, scheduled
approximately at 1 minute, 5 minutes, 30 minutes, 2 hours, and 12 hours. After
the final attempt the delivery is dropped.

## Ordering, duplicates, and idempotency

**[Guarantee]** At-least-once delivery: the same event can arrive more than once,
including from concurrent retries. Delivery usually follows event creation order,
but order is **not** guaranteed.

**[Guarantee]** Manual replay from the Orbit UI can resend any event for 7 days,
and a replay reuses the original `X-Orbit-Event` value.

**[Recommendation]** Make handlers idempotent before going live:

- Deduplicate on `X-Orbit-Event`, persisting ids long enough to cover your
  longest realistic replay window plus the retry schedule (7 days is the safe
  bound).
- Do not assume adjacent requests describe adjacent changes; if you need a
  consistent view, fetch current state on demand.
- Branch on `X-Orbit-Type` and ignore types you do not subscribe to, so a new
  event type cannot break processing of a known one.

## Key rotation

**[Guarantee]** During rotation, two secrets are valid at once for 24 hours. The
UI labels one current and one previous.

**[Recommendation]** Roll out the new secret first, then deploy verification that
accepts both for the full 24-hour window, then remove the previous secret.

## Operational guidance

- Return `2xx` as soon as the event is durably queued; do your real work
  asynchronously. Work done inline risks the 10-second deadline.
- **[Recommendation]** Never log the signing secret or full event bodies. Log
  `X-Orbit-Event`, `X-Orbit-Type`, and delivery outcome instead, and redact
  sensitive fields before logging any payload excerpt.
- Alert on sustained `4xx`/`5xx` rates, which indicate a broken handler rather
  than a transient failure.
- **[Guarantee]** Orbit does not follow redirects. Treat a `3xx` response as a
  failure, and point the endpoint at a final URL. *(See open questions — this
  behavior is not yet confirmed by the implementation owner.)*

## Troubleshooting

| Symptom | Likely cause | Action |
| --- | --- | --- |
| Signature mismatch on all deliveries | Body was re-serialized before verification | Verify against the raw bytes |
| Signature mismatch only after an upgrade | Verifier still uses the legacy parsed-JSON scheme | Support both schemes during migration |
| Signature fails intermittently | Only the current secret is accepted during rotation | Accept both secrets for 24 hours |
| Events processed twice | Retry or 7-day replay, both expected | Deduplicate on `X-Orbit-Event` |
| Later events missing older ones | Order is not guaranteed | Reconcile against current state on demand |
| Endpoint sees timeouts, no retries logged | Work exceeded the 10-second budget | Acknowledge first, process asynchronously |
| Event never retried | Response was a non-retryable `4xx` | Return a `5xx` to trigger a retry |
| Handler works locally, fails in production | Body already parsed by framework middleware | Mount the raw-body parser first |
