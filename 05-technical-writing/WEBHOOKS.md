# Receiving Orbit Webhooks

This guide covers how to verify, acknowledge, and process Orbit webhook deliveries. Statements are labelled:

- **Guarantee**: current delivery behavior you can build on.
- **Recommendation**: our advice. Orbit does not enforce it.
- **Unconfirmed**: an open question. Don't depend on either answer.

## The request

**Guarantee.** Each delivery is a `POST` with a JSON body of at most 512 KiB, carrying these headers:

| Header | Contents |
|---|---|
| `X-Orbit-Event` | Event ID. Retries and manual replays of an event reuse it. |
| `X-Orbit-Type` | Event type |
| `X-Orbit-Timestamp` | Unix time in seconds, part of the signed content |
| `X-Orbit-Signature` | `v1=<hex>`: an HMAC-SHA256 signature |
| `User-Agent` | `Orbit-Hooks/2` |

**Recommendation.** Every layer in front of your handler (load balancer, proxy, framework) should accept bodies of at least 512 KiB. Don't treat `User-Agent` as authentication.

## Verifying the signature

**Guarantee.** Orbit computes HMAC-SHA256 using your endpoint's signing secret over:

```
<X-Orbit-Timestamp value> + "." + <raw request body bytes>
```

It sends the hex digest as `X-Orbit-Signature: v1=<hex>`.

> **Conflicting older documentation.** Documentation from the previous system says the signature covers the *parsed* JSON. That is out of date. Re-serializing JSON changes key order and whitespace, so verification will fail.

A minimal verifier in Python, using only the standard library:

```python
import hashlib
import hmac

def verify_orbit_signature(raw_body: bytes, headers, secrets: list[str]) -> bool:
    """headers: a case-insensitive mapping. secrets: every currently valid secret."""
    timestamp = headers.get("X-Orbit-Timestamp", "")
    signature = headers.get("X-Orbit-Signature", "")
    if not timestamp or not signature.startswith("v1="):
        return False
    received = signature[3:].strip().lower().encode("utf-8")
    signed = timestamp.encode("utf-8") + b"." + raw_body
    for secret in secrets:
        expected = hmac.new(secret.encode("utf-8"), signed, hashlib.sha256).hexdigest()
        if hmac.compare_digest(expected.encode("ascii"), received):  # constant-time
            return True
    return False
```

**Recommendations:**

- Read the raw body before any JSON middleware runs, and verify before you act on the payload.
- Compare in constant time, never with `==`.
- Reject failures with `401`. That status isn't retried, so alert on failures: a wrong secret silently drops events until you replay them.
- Never log the secret or the signature header.

**Unconfirmed: timestamp freshness.** Whether retries and replays get a fresh timestamp is unconfirmed. Retries can arrive about 15 hours after the first attempt and replays up to 7 days later, so a short freshness window could reject legitimate deliveries permanently. Until Orbit confirms, log timestamp age instead of rejecting on it. `X-Orbit-Event` is **not** signed, so event-ID deduplication alone won't stop a captured request being replayed.

## Responding

**Guarantee.** Return any `2xx` status within **10 seconds**. Orbit ignores the response body.

**Recommendation.** Verify the signature, store or enqueue the event, return `200`, and then process it asynchronously. Slow inline processing causes timeouts and duplicates.

## Delivery and retries

**Guarantees:**

| Outcome of an attempt | Retried? |
|---|---|
| Timeout (no 2xx within 10 s) or network error | Yes |
| `408`, `425`, `429`, any `5xx` | Yes |
| Any other `4xx` | **No** |
| `2xx` | Delivered, not retried |

- Orbit makes up to **five retries** after the initial attempt (six attempts in total).
- Retries follow an **approximate** schedule of 1 min, 5 min, 30 min, 2 h, and 12 h.

**Recommendations.** Use `4xx` only for requests that will never succeed. For temporary problems, such as a database outage, return `503`.

**Unconfirmed:**

- Whether each interval is measured from the previous attempt (about 14.6 h in total) or from the first attempt.
- Whether `Retry-After` is honored on `429`/`503`.
- What happens after the last retry fails (endpoint disabled? notification?).
- **Redirects.** Security believes they aren't followed; the implementation owner hasn't confirmed. Register the exact final HTTPS URL.

## Ordering and idempotency

**Guarantees:**

- **Duplicates are possible.**
- **Order is not guaranteed.** Deliveries usually arrive in the order the events were created, but concurrent retries can reorder them.

**Recommendations:**

- **Deduplicate on the event ID.** Keep processed IDs for longer than the 7-day replay window.
- **Record an ID only after processing succeeds**, ideally in the same transaction as your side effects, so a failed delivery can still be retried or replayed.
- Replays reuse the event ID, so deduplication skips already-processed events. To reprocess one deliberately, clear its record first.
- Don't infer order from arrival time or from `X-Orbit-Timestamp`. Whether it reflects event creation or signing time is unconfirmed. Check your own current state before applying a change.

## Rotating the signing secret

**Guarantees:**

- A secret is displayed **only once**. Copy it to your secret store immediately.
- After you rotate, the new secret (labelled *current*) and the old one (*previous*) are both valid for **24 hours**.

**Unconfirmed:** during that overlap, which secret Orbit signs with, and whether a header can carry more than one signature. The following procedure works in every case:

1. Rotate in the dashboard and store the new secret.
2. Deploy immediately with **both** secrets in `secrets`.
3. Confirm that deliveries verify.
4. After 24 hours, remove the previous secret.

Replay any deliveries rejected between steps 1 and 2.

## Operations

- **Replay:** the dashboard can resend an event for up to **7 days** (guarantee).
- **Transport:** use HTTPS (recommendation).
- **Logging:** log event ID, type, status, and latency. Don't log secrets, signatures, or full payloads that may contain sensitive data.
- **Monitoring:** alert on signature failures, non-2xx rates, and handler latency approaching 10 seconds.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Every signature fails | Verifying re-serialized JSON, omitting the timestamp, or using the wrong secret | HMAC `timestamp + "." + raw bytes` with the current secret |
| Failures start right after rotation | Only one secret configured | Accept both secrets for 24 hours, then replay the failed events |
| Same event processed twice | Duplicate delivery or retry | Deduplicate on the event ID |
| Retries arrive even though the handler succeeded | Response took longer than 10 s | Acknowledge first, then process asynchronously |
| Failed event never retried | Handler returned a non-retryable `4xx` | Return `503` for transient errors, then replay |
| Events arrive out of order | Expected: order isn't guaranteed | Make handlers order-independent |
| Large events rejected, e.g. with `413` | Body limit below 512 KiB | Raise the limit on every layer |
| Nothing arrives after the URL changed | Possibly a redirect that isn't followed | Register the final URL directly |
| Replayed event ignored | Deduplication matched the reused ID | Clear the ID's record before replaying |
