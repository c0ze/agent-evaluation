# Task 05 response

`WEBHOOKS.md` is written and covers every required element. Eleven questions need a product answer before it is published; the first three change what the guide tells customers to do.

## Checks

- **Length**: 1,068 words by `wc -w`, which counts code and table pipes. The target was 700–1,100.
- **Example**: I extracted the Python block from the guide and ran it against 12 cases, all passing. They cover a valid signature under either secret, upper-case hex, a wrong secret, a tampered body or timestamp, missing headers, a wrong or absent `v1=` prefix, non-ASCII input and an empty secret list.
- **Not checked**: the example against a real Orbit delivery. No test vector exists in the notes, so the key encoding and message layout rest on the notes alone.

## Editorial choices

- **Three labels.** Each section marks statements as Guaranteed, Recommended or Unconfirmed, and a closing "Open questions" section collects the unconfirmed items. I added "Not guaranteed" for ordering, exactly-once delivery and retry timing, because readers tend to assume those.
- **"Guaranteed" means "stated flatly in the notes".** The notes are raw, so product should confirm that each of those items is a real commitment.
- **Product name.** I called the service "Orbit", inferred from the `X-Orbit-*` headers and the `Orbit-Hooks/2` user agent. The notes never name it.
- **Python for the example.** It uses the standard library only and accepts a list of secrets, so the same function serves rotation.
- **Nothing on payload schema, event types, source IPs or endpoint setup.** The notes do not cover them.

## Contradictions and how I resolved them

| Issue | Resolution |
|---|---|
| Old docs say the signature covers parsed JSON; the current implementation signs timestamp, `.`, raw body | Documented the current implementation, labelled it "Current implementation" rather than "Guaranteed", and added a visible conflict note. It is also open question 1. |
| One note says HMAC "over raw bytes", another says timestamp, `.`, raw body | Treated the second as the more specific statement of the same thing. |
| Redirects: security says no, the owner has not confirmed | Stated as unconfirmed. The advice is to register the final URL, which is safe under either answer. |
| Retry schedule is "roughly" 1m, 5m, 30m, 2h, 12h | Listed the retry count and triggers as guaranteed and the delays as not guaranteed. I gave no total retry duration, because the notes do not say what each delay is measured from. |

## Conservative calls that go beyond the notes

- **No timestamp tolerance check.** Most webhook guides recommend rejecting old timestamps. I advise against it for now: if the timestamp is the event's creation time, a five-minute window would reject every retry after the second. Deduplication on the event ID covers replayed requests in the meantime.
- **Rotation steps assume the new secret signs immediately.** That is the worse case for the customer. It leaves a gap between rotating and deploying in which deliveries fail verification, so the last step tells them to replay those.
- **`401` on a bad signature is not retried.** The guide says so explicitly, because a misconfigured secret then loses events until someone replays them.
- **Retries carry the same event ID.** The notes say this only for replays. I assumed it for retries because the ID identifies the event, and the header table states it only for replays.
- **HTTPS and a 7-day retention for processed IDs** are my recommendations, not Orbit requirements.

## Unresolved questions for product

1. Is the parsed-JSON signing description definitely stale, and does any live system still sign that way?
2. Are redirects followed? If not, is a `3xx` treated as a failure, and is it retried?
3. Is `X-Orbit-Timestamp` the event's creation time or the attempt's send time? Should receivers enforce a tolerance, and what value?
4. During the 24-hour overlap, which secret signs deliveries? Does the 24 hours start at rotation? Are retries and replays re-signed at send time?
5. What happens after the sixth failed attempt: is the event dropped, is the endpoint disabled, is the customer notified?
6. Is `Retry-After` honoured on `429` and `503`?
7. Are the retry delays measured from the previous attempt, and is there jitter?
8. Is the signing key the UTF-8 bytes of the displayed secret, or a decoded form? Is the hex always lower case?
9. What happens to an event whose payload would exceed 512 KiB? Does the limit apply to the body alone?
10. When do the 7 days of replay start: event creation or the last attempt? Are replays themselves retried?
11. Is the 10-second limit for the whole response, or are there separate connect and read timeouts?
