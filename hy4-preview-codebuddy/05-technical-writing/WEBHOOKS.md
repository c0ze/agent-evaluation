# Receiving Orbit Webhooks

This guide covers verifying, handling, and operating an endpoint that receives
Orbit webhooks. Each section separates **Guarantees** (behavior the service
commits to) from **Recommendations** (what we advise you to do). Anything
contradictory or unconfirmed in our source material is marked
**Unconfirmed** and repeated at the end — do not design around those points
without product confirmation.

## Delivery basics

Orbit delivers events as `POST` requests with a JSON body and `User-Agent:
Orbit-Hooks/2`:

| Header | Meaning |
| --- | --- |
| `X-Orbit-Event` | Stable identifier for this event |
| `X-Orbit-Type` | Event type |
| `X-Orbit-Timestamp` | Unix seconds at send time; signed |
| `X-Orbit-Signature` | `v1=<hex>` HMAC-SHA-256 signature |

**Guarantees**

- Requests are `POST` with a JSON body capped at 512 KiB.
- Any `2xx` returned within **10 seconds** counts as success.
- The response body is ignored; you cannot report partial failure through it.

**Recommendations**

- Return `2xx` once the event is durably persisted; do real work
  asynchronously.

## Verifying the signature

The signature is HMAC-SHA-256 over **`X-Orbit-Timestamp` + `.` + the raw
request body**, hex-encoded and prefixed with `v1=`.

> **Stale documentation warning.** Older docs say Orbit signs the *parsed* JSON
> object. That is wrong for the current implementation. Signing covers raw
> bytes, so re-serialization, key reordering, or whitespace changes introduced
> by your framework will break verification.

**Guarantees**

- The signed material is `timestamp + "." + raw body`.
- Secrets are shown once at creation and cannot be retrieved later.
- The service compares signatures in constant time.

**Recommendations**

- Verify the raw bytes, before parsing JSON.
- Use a constant-time comparison; never `==` the hex string.
- Reject timestamps far from your clock (a few minutes of tolerance is
  typical) to limit replay of captured requests.
- Accept either secret while rotating.
- Never log the secret or full payloads, which may contain customer data. Log
  `X-Orbit-Event` and `X-Orbit-Type` instead.

```js
import crypto from "node:crypto";

const secret = process.env.ORBIT_WEBHOOK_SECRET; // shown once at creation

// rawBody must be the untouched request body (Buffer or string), captured
// before any JSON parsing or body-transform middleware runs.
export function verifySignature(headers, rawBody) {
  const timestamp = headers["x-orbit-timestamp"];
  const signature = headers["x-orbit-signature"];
  if (!timestamp || !signature) return false;

  const expected =
    "v1=" +
    crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
```

Use your framework's raw-body option — for example Express's
`express.raw({ type: "application/json" })` rather than `express.json()`.

## Delivery and retry semantics

Orbit retries a failed delivery **five times** after the initial attempt, at
roughly **1 minute, 5 minutes, 30 minutes, 2 hours, and 12 hours**; the final
attempt lands about 14 hours after the first. Intervals are approximate.

**Guarantees**

- Retried: timeouts, network errors, and responses `408`, `425`, `429`, and
  any `5xx`.
- Not retried: every other `4xx` (`400`, `401`, `403`, `404`, …).
- The 10-second budget applies per attempt; exceeding it is a timeout.

**Recommendations**

- Acknowledge first, process later.
- Use `429` for backpressure — it is retried, unlike most `4xx` codes.
- Never return `4xx` for transient internal faults; you would lose the event.

**Unconfirmed:** what happens after the fifth retry (dead-letter, alert, manual
redelivery) is undocumented. Assume the event is dropped and add your own
reconciliation.

**Unconfirmed:** whether Orbit follows `3xx` redirects. Security believes it
does not. Serve your endpoint at one canonical URL that returns `2xx`
directly.

## Ordering and idempotency

**Guarantees**

- **No ordering guarantee.** Delivery usually follows creation order, but
  concurrent retries make it non-guaranteed.
- **Duplicates are possible**; the same event can arrive more than once.
- Replayed events reuse the original `X-Orbit-Event` value.

**Recommendations**

- Deduplicate on `X-Orbit-Event` and treat repeats as no-ops. This also makes
  replay safe. Keep the dedupe window longer than 7 days.
- Never assume causal order; if order matters, fetch current state from the API
  or compare a version field inside the payload.

## Key rotation

**Guarantees**

- During rotation, **two secrets are valid for 24 hours**; the UI labels them
  *current* and *previous*.
- The replay UI can resend an event for **7 days**, reusing its event id.

**Recommendations**

- Verify against both secrets until the 24-hour overlap ends, then retire the
  previous one.
- Store secrets in a secret manager, never in source control or logs.
- Rotation is also your leak-recovery path: create a secret, deploy it, retire
  the old one.

**Unconfirmed:** whether the 24-hour overlap starts when the new secret is
created or first used, and whether expiry is automatic. Confirm before
automating rotation.

## Operational advice

- **Alert on retry volume and sustained non-`2xx` rates.** Repeated `401`s
  usually mean a rotated secret; repeated timeouts mean too much inline work.
- **Reconcile periodically.** Since post-retry behavior is unconfirmed, poll
  the API for missed changes as a backstop.
- **Test with replay** to exercise failure paths against real traffic shapes.
- **Branch on `X-Orbit-Type`** and acknowledge unknown types with `2xx` so new
  event types do not trigger retries.
- **Keep logs lean:** event id, type, status, duration, verified flag.

## Troubleshooting

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| Every signature check fails | Verifying re-serialized JSON, not raw bytes | Capture the raw body before parsing |
| Signatures fail after rotation | Endpoint still on the previous secret | Accept current *and* previous during overlap |
| All deliveries time out | Work done before responding | Acknowledge, then queue |
| Events processed twice | No dedupe layer | Deduplicate on `X-Orbit-Event` |
| Events applied out of order | No ordering guarantee | Read state from the API; use payload versions |
| `4xx` returned, no retry | Non-retryable by design | Fix the endpoint, resend via replay |
| Signature valid but request stale | Clock skew or captured replay | Check NTP; enforce tolerance |
| Endpoint returns `3xx` | Redirect handling unconfirmed | Return `2xx` from one canonical URL |
| Nothing after 14 hours | Retries exhausted | Confirm dead-letter behavior; reconcile via API |

## Open items requiring product confirmation

1. Are `3xx` redirects followed?
2. What happens after the fifth retry — dead-letter, alert, or manual
   redelivery?
3. When does the 24-hour two-secret overlap start and end?
4. Is there a documented maximum clock skew for `X-Orbit-Timestamp`?
5. Are deliveries concurrent per endpoint or strictly serial?
