# Orbit webhooks: integration guide

Orbit delivers events to your service as signed HTTP POST requests. This guide
covers the request format, signature verification, delivery and retry
semantics, ordering and idempotency, key rotation, and day-2 operations.
Throughout, **Guaranteed** marks behavior Orbit commits to, and
**Recommended** marks advice for a robust integration that Orbit does not
enforce. Anything not fully confirmed by the product team is flagged under
**Open questions** instead of guessed at.

## Request format

**Guaranteed.** Every delivery is an HTTP POST with a JSON body of at most
512 KiB, sent as `User-Agent: Orbit-Hooks/2` with these headers:

| Header | Value |
|---|---|
| `X-Orbit-Event` | Event id; manual replays reuse the original id |
| `X-Orbit-Type` | Event type |
| `X-Orbit-Timestamp` | Unix seconds used when signing |
| `X-Orbit-Signature` | `v1=<hex>`, an HMAC-SHA256 signature |

The payload schema is out of scope for this guide. Parse the body only after
verification succeeds.

## Signature verification

**Guaranteed.** The signature is hex-encoded HMAC-SHA256, prefixed with `v1=`.
The signed message is the timestamp header value, a dot, and the raw body
bytes:

```text
HMAC-SHA256(secret, "<X-Orbit-Timestamp>.<raw-body>")
```

> **Conflict with older docs.** Documentation from the previous system says
> the signature covers the parsed JSON. That note is stale: the current
> implementation signs `timestamp + "." + raw body`. Verify against the exact
> bytes you received — not a parsed and re-serialized object, which rarely
> reproduces identical bytes.

**Recommended.**

- Compare signatures with a constant-time equality function, never `==`.
- The signing secret is shown once at creation; copy it into a secret manager
  immediately.
- Never log the secret or full sensitive payloads; log `X-Orbit-Event` and
  `X-Orbit-Type` instead.
- Consider rejecting deliveries whose `X-Orbit-Timestamp` is far in the past
  to limit replay abuse. If you do, size the tolerance window against the
  retry schedule — a retry can arrive roughly 15.5 hours after the first
  attempt — because it is not documented whether the timestamp is regenerated
  per attempt (see **Open questions**).

### Minimal verification example (Node.js)

```js
const crypto = require("node:crypto");

// secrets: [current, previous]; previous is empty outside a rotation window.
function verified(rawBody, timestamp, header, secrets) {
  const given = Buffer.from(String(header ?? "").replace(/^v1=/, ""));
  return secrets.filter(Boolean).some((secret) => {
    const expected = Buffer.from(
      crypto.createHmac("sha256", secret)
            .update(`${timestamp}.${rawBody}`)
            .digest("hex"));
    return given.length === expected.length &&
           crypto.timingSafeEqual(given, expected);
  });
}

// express.raw() hands us the untouched body bytes the HMAC requires.
app.post("/hooks", express.raw({ type: "application/json" }), (req, res) => {
  if (!verified(req.body, req.get("X-Orbit-Timestamp"),
                req.get("X-Orbit-Signature"),
                [SECRET_CURRENT, SECRET_PREVIOUS])) {
    return res.status(401).end();
  }
  res.status(200).end();   // ack first,
  queue.push(req.body);    // then parse and process asynchronously
});
```

## Delivery and retries

**Guaranteed.**

- Your endpoint has 10 seconds to return any 2xx; the response body is
  ignored.
- A delivery is retried after a timeout, a network error, or a `408`, `425`,
  `429`, or any `5xx` response.
- Any other `4xx` (for example `400`, `401`, `404`) is not retried.
- After the initial attempt there are five retries, scheduled at roughly
  1 minute, 5 minutes, 30 minutes, 2 hours, and 12 hours. Treat these delays
  as approximate.

**Open question: redirects.** Whether the sender follows HTTP redirects is
unconfirmed; security believes it does not, but the implementation owner has
not verified this. Until it is confirmed, point webhooks at a URL that returns
2xx directly, with no redirect.

## Ordering and idempotency

**Guaranteed.**

- Duplicate deliveries are possible.
- Delivery order usually follows event creation order but is **not**
  guaranteed, because concurrent retries can land later events first.

**Recommended.**

- Deduplicate on `X-Orbit-Event`. The replay UI can resend an event for
  7 days and reuses the original event id, so keep deduplication records for
  at least 7 days.
- Make processing durably idempotent — for example, a unique constraint on
  the event id — rather than relying on a cache that may be cleared between
  duplicate deliveries.
- Never depend on arrival order; derive sequencing from the event data itself.

## Key rotation

**Guaranteed.** During rotation, two secrets are valid simultaneously for
24 hours; the UI labels them *current* and *previous*.

**Recommended.**

- Verify against both secrets for the whole 24-hour window (the example above
  already does).
- Roll the new secret out to every receiver instance before the window closes,
  so no instance is left holding only the retired secret.

## Operational advice

**Recommended.**

- Acknowledge within the 10-second budget and process from a queue. Doing work
  in the request path is the most common source of timeouts and retry storms.
- Capture the raw body. Most frameworks parse JSON by default, which breaks
  signature verification.
- Alert on any non-2xx your endpoint returns. A non-retryable 4xx ends
  delivery for that event; the only recovery is a manual replay within 7 days.
- After fixing an outage, replay missed events from the UI instead of waiting
  for users to re-trigger actions.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Signature never verifies | Verifying parsed/re-serialized JSON, or following the stale old signing note | HMAC over `timestamp + "." + raw body bytes` |
| Signature fails intermittently | Mid-rotation and verifying with only one secret | Accept current and previous secrets for 24h |
| Same event arrives repeatedly | Retries or manual replays; expected | Deduplicate on `X-Orbit-Event` |
| Events out of order | Concurrent retries; expected | Make processing order-independent |
| Event never arrives again | You returned a non-retryable 4xx | Return 2xx and process async; replay within 7 days |
| Deliveries time out | Endpoint takes longer than 10s | Ack immediately, queue the work |

## Open questions (product confirmation needed)

1. **Redirect following.** Security believes redirects are not followed; the
   implementation owner has not confirmed.
2. **Timestamp regeneration.** It is not documented whether
   `X-Orbit-Timestamp` and the signature are recomputed on each retry, which
   determines how strict a freshness window receivers can safely enforce.
3. **Stale documentation.** The old "signs parsed JSON" note should be
   corrected or retired to prevent integration bugs.
