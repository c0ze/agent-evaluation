# Webhook delivery guide

Orbit notifies your endpoint about events with an HTTP `POST`
and a JSON body. This guide covers verifying those requests, how
delivery and retries work, and how to stay correct when events are
duplicated or arrive out of order.

**Guarantee** is behavior you may rely on. **Recommendation** is advice
for your receiver. **Pending confirmation** is unconfirmed behavior —
do not build on it.

## Request format

**Guarantee.** Each delivery has user agent `Orbit-Hooks/2`, a JSON
body of at most 512 KiB, and these headers:

| Header | Meaning |
| --- | --- |
| `X-Orbit-Event` | Event ID; retries and replays reuse it |
| `X-Orbit-Type` | Event type |
| `X-Orbit-Timestamp` | Signing time, Unix seconds |
| `X-Orbit-Signature` | `v1=<hex>`, see below |

## Verify the signature

**Guarantee.** `X-Orbit-Signature` is hex-encoded HMAC-SHA-256 over
`<timestamp>.<raw body>` — the `X-Orbit-Timestamp` value, a dot, then
the exact bytes received — keyed with your endpoint secret. The secret
is shown only once at creation; store it in a secret manager then.

> Old documentation said the signature covered parsed JSON. That is
> stale. Verify the raw bytes before parsing: re-serialized JSON may
> differ in whitespace, key order, or number formatting and will fail
> verification intermittently.

**Recommendation.** Compare in constant time, reject mismatches, and
check the timestamp is near your clock so captured requests cannot be
replayed forever. Orbit publishes no required tolerance window, so
choose one that fits your clock accuracy and allows for retries and
replays. Never log secrets, signatures, or full sensitive payloads.

Minimal Python (standard library only). Pass two secrets during
rotation, one otherwise:

```python
import hashlib, hmac

def is_valid(timestamp, signature_header, raw_body, secrets):
    if not signature_header.startswith("v1="):
        return False
    received = signature_header[3:]
    signed = timestamp.encode() + b"." + raw_body
    valid = False
    for secret in secrets:
        expected = hmac.new(secret.encode(), signed,
                            hashlib.sha256).hexdigest()
        valid = hmac.compare_digest(expected, received) or valid
    return valid
# Read the RAW body first; if invalid, return 401.
# Only then parse JSON and process the event.
```

## Acknowledge, retries, and failure

**Guarantee.** Your endpoint has 10 seconds to respond. Any `2xx`
is success; the response body is ignored. Delivery is at-least-once:
an initial attempt plus up to five retries at roughly 1 minute,
5 minutes, 30 minutes, 2 hours, and 12 hours. Timing is approximate.

Retries happen only on timeouts, network errors, and HTTP `408`,
`425`, `429`, or `5xx`. Other `4xx` responses are not retried. After
the last retry there are no further automatic attempts.

**Recommendation.** Verify, durably store or enqueue, return `2xx`,
and do slow work afterwards. Processing before responding risks a
timeout, a retry, and duplicate work. Return `5xx` only for transient
faults; return another `4xx` when retrying the same request cannot
help. Beware a mis-deployed route returning `404`: it silently stops
delivery. Whether `Retry-After` on `429` is honored is **pending
confirmation** — do not rely on it.

**Pending confirmation — redirects.** Whether Orbit follows `3xx`
redirects is unconfirmed; security expects it does not. Assume it
does not: register the final URL directly.

## Ordering, duplicates, and idempotency

**Guarantee.** Duplicates are possible and ordering is not
guaranteed. Events usually arrive in creation order, but a retry of
an older event can overtake — or follow — newer events. “Usually”
is not a promise.

**Recommendation:**

- Deduplicate on `X-Orbit-Event`. Store processed IDs, ideally in the
  same transaction as the resulting state change; acknowledge repeats
  with `2xx` and do nothing. Keep records at least 7 days (see replay).
- Do not assume “created” precedes “updated.” Upsert by the object's
  identity, prefer latest state over blind increments, and make
  handlers safe to run twice (“set status to X,” not “add one”).
- Decide from each event's contents, not from arrival order.

## Key rotation

**Guarantee.** For 24 hours during rotation, two secrets are valid;
the UI labels them *current* and *previous*.

**Recommendation.** Save the new secret as soon as it is shown.
Deploy a receiver accepting both secrets, confirm deliveries verify,
then remove the previous secret after 24 hours. Accepting only the
new secret too early, or the old one forever, both cause outages or
risk. Sudden universal verification failure usually means your stored
secret is no longer the current one.

## Replay

**Guarantee.** The replay UI can resend an event for up to 7 days,
reusing the same event ID.

**Recommendation.** Handle a replay like a retry: verify it, then let
deduplication decide. Replaying an already-processed event should be
a no-op returning `2xx`.

## Operational advice

**Recommendation:**

- Log event ID, type, timestamp, status, and outcome only — never
  secrets, signatures, or full sensitive payloads; redact if you must
  inspect a payload.
- Alert on sustained signature failures, rising timeouts or `5xx`
  from your endpoint, and any non-retryable `4xx` (dropped events).
  Track processing-queue lag separately from receipt.
- Keep clocks synchronized if you enforce timestamp freshness.
- Before go-live, test: bad signature, duplicate ID, out-of-order
  pair, slow handler past 10 seconds, and two-secret rotation.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| All signatures fail | Wrong secret, or signing parsed JSON | Verify raw `<ts>.<body>`; check current/previous secret |
| Intermittent failures | Middleware altered the body | Capture raw bytes before parsing |
| Failures begin at rotation | Only one secret trusted | Accept both for the 24-hour overlap |
| Event applied twice | No deduplication | Key on `X-Orbit-Event`; no-op repeats |
| Newer state overwritten | Assumed ordering | Upsert latest state; ignore arrival order |
| Same event redelivered | Slower than 10 s, or `5xx` | Return `2xx` fast; work asynchronously |
| Event never redelivered | Non-retryable `4xx`, or retries exhausted | Fix endpoint; replay within 7 days |
| Nothing after URL change | Redirect or `404` at new URL | Register the final URL directly |
| Replay “does nothing” | Already processed — correct | Confirm original processing; expect no-op `2xx` |

## Pending confirmation

Do not rely on the following until Orbit confirms them; this guide
already assumes the conservative answer:

- Redirect following (assumed: none), and final `3xx` classification.
- Any required timestamp-tolerance window.
- Whether `Retry-After` is honored.

If your design needs one of these, confirm it with Orbit before
shipping instead of assuming the favorable answer.
