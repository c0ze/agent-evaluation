# Receiving Orbit Webhooks

This guide explains how to accept, verify, and operate against webhook
deliveries from the Orbit service: HTTP `POST` requests with a JSON body, sent
to the endpoint you configure.

- **Guaranteed** behavior is part of the delivery contract; build against it.
- **Recommended** behavior is advice, not a guarantee.
- **Unconfirmed** items are listed at the end; do not rely on them.

## 1. Verifying a signature (start here)

Every delivery carries:

| Header              | Meaning                                  |
| ------------------- | ---------------------------------------- |
| `X-Orbit-Event`     | Unique event id (stable across replays)  |
| `X-Orbit-Type`      | Event type, e.g. `invoice.paid`          |
| `X-Orbit-Timestamp` | Unix seconds when the request was signed |
| `X-Orbit-Signature` | `v1=<hex>` HMAC-SHA256 signature         |

The signature is HMAC-SHA256 over **the raw request bytes**, not over reparsed
JSON. The signing string is `<X-Orbit-Timestamp> + "." + <raw body>`.

Your body parser must therefore preserve the raw payload before any JSON
decoding. Most frameworks (`express.json()`, ASP.NET model binding) replace the
raw stream; capture it first (e.g. `express.raw({ type: "application/json" })`)
or verification will fail intermittently.

```js
import crypto from "node:crypto";

const MAX_SKEW_SECONDS = 300; // recommended, not a service-enforced limit

// secrets: array of currently valid secrets (see "Key rotation")
export function verifyOrbitSignature(rawBody, headers, secrets) {
  const timestamp = headers["x-orbit-timestamp"];
  const signature = headers["x-orbit-signature"];
  if (!timestamp || !signature) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > MAX_SKEW_SECONDS) return false; // replay guard

  return secrets.some((secret) => {
    const expected =
      "v1=" +
      crypto
        .createHmac("sha256", secret)
        .update(`${timestamp}.${rawBody}`)
        .digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature, "utf8");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}
```

Compare with a constant-time function (`timingSafeEqual`, `hmac.compare_digest`)
— never `===`. Return `401` on failure.

> **Documentation conflict (resolved).** Legacy docs state the signature covers
> the *parsed JSON* body. That is stale: the current implementation signs
> `timestamp + "." + raw body`, as above. Accept the legacy scheme only if you
> must support the old system, and retire that path.

## 2. Delivery and retries

**Guaranteed.** Your endpoint has **10 seconds** to return any `2xx`; the
response body is ignored. Anything else — non-`2xx`, timeout, or network error —
is a failed attempt.

Orbit retries automatically after connection/timeout/network errors, and after
`408`, `425`, `429`, or any `5xx`. Other `4xx` responses are **not** retried and
the delivery is abandoned; treat them as permanent failures.

The schedule is approximately **1 min, 5 min, 30 min, 2 h, 12 h** after the
initial attempt — **five retries**, six attempts total. Intervals are
approximate; do not build logic that depends on exact spacing.

Requests use `User-Agent: Orbit-Hooks/2` and a maximum payload of **512 KiB**.
Do not rely on the webhook body for large content; fetch the resource from the
API instead.

**Recommended.** Acknowledge first, process later: verify, persist the event id,
enqueue, and return `200` within a few hundred milliseconds. Do the real work in
a background job. This keeps you inside the 10-second budget and avoids
cascading retries.

## 3. Ordering and idempotency

**Not guaranteed.** Deliveries *usually* follow event creation order, but
concurrent retries mean **order is not guaranteed**, and **duplicates are
possible** — a timeout after you processed the event produces a retry.

**Recommended.** Make handlers idempotent on `X-Orbit-Event`: store it with a
unique constraint, and on conflict return `200` without reprocessing. Never
assume event *N* precedes *N+1*; if ordering matters, re-read current state from
the API. This also covers the replay UI, which **guarantees** resends with the
**same event id** for **7 days**.

## 4. Key rotation

The signing secret is **shown once**; store it in a secret manager.

**Guaranteed.** During rotation **two secrets are valid for 24 hours**; the UI
labels them *current* and *previous*.

**Recommended procedure:** add the new secret to your verifier alongside the old
one (accepting either — see the array-based example above), deploy, promote the
new secret in the UI, then remove the previous secret after 24 hours.

Never log secrets, signatures, or full payloads — log the event id and type
only; payloads may contain customer data.

## 5. Operational advice

- Return `2xx` fast; alert on sustained non-`2xx` rates.
- Alert on abandoned (non-retried `4xx`) deliveries — silent data loss.
- Track lag via `X-Orbit-Timestamp`; a growing gap means you are behind.
- Keep an idempotency/dead-letter store for safe reprocessing.
- Use the replay UI (7 days) to recover from your own outages.

## 6. Troubleshooting

| Symptom                                   | Likely cause                                                   | Action                                                                     |
| ----------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Signature mismatch on every request       | Wrong secret, or signing over parsed JSON                       | Sign `timestamp + "." + raw body`; confirm you copied the secret correctly |
| Signature mismatch only on some requests  | Body parser mutated/normalized JSON before verification         | Capture raw bytes (`express.raw`, `verify` hook) before JSON parsing       |
| Signature mismatch after rotation         | Old secret removed too early                                    | Accept both secrets for the full 24-hour overlap                           |
| Repeated deliveries of the same event     | Timeout after successful processing (expected duplicates)       | Make handler idempotent on `X-Orbit-Event`; return `200` on conflict       |
| Events processed out of order             | Concurrent retries (order not guaranteed)                       | Don't depend on order; re-read state from the API                          |
| Event delivered once, never retried       | You returned a non-retried `4xx`, or a parsing error            | Return `5xx` for transient failures; reserve `4xx` for permanent ones      |
| Timeouts under load                       | Synchronous work inside the request handler                     | Acknowledge, enqueue, process asynchronously                               |
| Replay option unavailable for old event   | Outside the 7-day replay window                                 | Recover via the API                                                        |
| `413` / truncated payload                 | Payload approaches or exceeds the 512 KiB limit                 | Send references, not full content; fetch details from the API              |
| Redirect expected to work                 | Redirect handling is unconfirmed (see below)                    | Use a direct `https` URL that responds `2xx` without redirecting           |

## 7. Open questions (do not rely on these)

1. **Redirects.** Whether Orbit follows `3xx` redirects is **unconfirmed**:
   Security's position is no, the implementation owner has not confirmed. Assume
   redirects are not followed; register a final URL.
2. **How a `3xx` from your endpoint is treated** (success, failure, or
   retryable) is unspecified.
3. **Exact retry timing** — the schedule is "roughly" as listed; jitter is not
   specified.
4. **`Retry-After` on `429`** — whether Orbit honors it is unconfirmed.
5. **Legacy parsed-JSON signing** — assumed stale; confirm no production traffic
   still uses it before deprecating.

Confirm these with product before publishing externally.
