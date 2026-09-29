# Response: Webhook Delivery Guide

## Deliverable

`WEBHOOKS.md` is 1,094 words by `wc -w`, or about 1,030 without table pipes, so it falls inside the 700–1,100 target. It covers every required element:

- a request/header reference
- a minimal verification example
- response rules
- retry semantics
- ordering and idempotency
- key rotation
- operations advice
- a troubleshooting table

I ran the Python verifier locally against these cases:

- A valid signature made with the second of two secrets is accepted.
- A signature made with the wrong secret is rejected.
- A body changed by a single byte is rejected.
- A non-ASCII signature header is rejected; it does not raise an exception.

## Editorial choices

1. **Three explicit labels.** Every section separates **Guarantee** (behavior stated in the notes), **Recommendation** (our advice), and **Unconfirmed** (open questions). Readers can then tell what they may build on.
2. **Signature conflict resolved toward the current implementation.** The guide documents `timestamp + "." + raw body` as current behavior. A callout says the older "parsed JSON" description is stale. I did not describe the old scheme as a supported alternative.
3. **Conservative stance on timestamp freshness.** The notes give no tolerance window. Retries can arrive up to about 15 h late and replays up to 7 days late. Rejections return a non-retried 4xx. For those reasons I did not recommend a typical 5-minute window, which could silently drop legitimate events. The guide tells readers to log timestamp age until behavior is confirmed.
4. **Unsigned event ID pointed out.** The signature covers only the timestamp and body. The `X-Orbit-Event` header can therefore be altered, and the guide says so.
5. **Consequences drawn from stated facts, not new behavior.** Some advice follows directly from the notes; none of it describes new behavior:
   - Signature failures return 401, which is not retried, so readers should alert and replay.
   - Deduplication will swallow manual replays, because replays reuse the event ID.
   - Readers should return 503 for transient errors.
   - The rotation procedure is robust to either signing behavior during the overlap.
6. **"Roughly" kept as "approximate".** Retry times are not presented as exact. The count is stated precisely: 5 retries, 6 attempts in total.
7. **Redirects** are treated as unconfirmed. The advice to register the final URL is safe whatever the answer turns out to be.
8. **HTTPS** is given only as a recommendation, because the notes don't say whether plain HTTP is allowed.
9. **Payload schema omitted.** The notes don't describe body fields, so the guide invents none. That includes an in-body event ID or a creation time for ordering.
10. **Logging warning.** The guide warns against logging secrets, signature headers, or full sensitive payloads, as the notes request.

## Unresolved questions for product/engineering

1. **Signing scheme.** Confirm that the old "sign parsed JSON" scheme is gone for every endpoint, including legacy ones. Confirm that the hex is lowercase.
2. **Timestamp on retries and replays.** Is the request signed again with a new `X-Orbit-Timestamp`? What freshness window should we recommend?
3. **Does `X-Orbit-Timestamp` reflect event creation or send time?**
4. **Event ID in the body.** Does the signed body contain the event ID, so that deduplication can rely on a signed value?
5. **Retries and the event ID.** Confirm that retries reuse the event ID. The notes state this only for replays; the guide assumes it for retries.
6. **Retry intervals.** Are they relative to the previous attempt or to the first one? How much jitter is there? Is `Retry-After` honored?
7. **After the final retry.** Is the endpoint disabled or the customer notified? Can the event still be replayed?
8. **3xx and 1xx responses.** How are they classified: failure, retried, or not retried?
9. **Redirects.** Are they followed? Security says no; the implementation owner has not confirmed.
10. **Rotation overlap.** During the 24 h window, does Orbit sign with the current secret, the previous one, or both? Can `X-Orbit-Signature` contain multiple `v1=` values? Is the new secret shown once, like the original?
11. **Replay window.** Are the 7 days measured from event creation or from the first delivery? Are replays subject to the same retry policy?
12. **Oversized payloads.** What happens to events over 512 KiB: are they dropped, truncated, or sent as a reference?
13. **Plain HTTP endpoints.** Are they permitted?
14. **Content-Type.** What is the exact `Content-Type` header value?
