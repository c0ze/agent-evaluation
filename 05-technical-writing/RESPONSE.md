# Editorial notes

`WEBHOOKS.md` is a customer integration guide built only from `SOURCE_NOTES.md`. `wc -w` reports 1087 words, including headings, tables, and the code sample. That sits inside the 700–1,100 target.

## How the guide is labeled

Three labels separate contract from advice.

- **Guarantee** is behavior the notes state as current delivery behavior.
- **Recommendation** is what a receiver should do under those rules, including constant-time comparison and not logging secrets or sensitive bodies.
- **Unconfirmed** is a gap. The guide names it and does not fill it.

## Contradiction: what is signed

The notes disagree with themselves. Older docs sign parsed, re-serialized JSON. The current implementation signs `X-Orbit-Timestamp`, one `.`, and the raw body, with HMAC-SHA256, and sends `v1=` plus a hex digest.

I treated the current implementation as the contract and the older text as the conflicting, probably stale account the notes already flag. The guide tells readers to sign that byte string and says a parse-and-re-encode check will not match live traffic. I did not document dual acceptance. Nothing says a parsed-JSON signature still verifies, and claiming that it does would paper over the conflict instead of resolving it.

The first note says the MAC is “over raw bytes.” I read that as “do not re-encode,” and the later note as the actual input (timestamp, dot, raw body). Both sentences appear in the guide so a reader does not implement body-only signing.

## Other choices

**Order.** “Usually follows creation” stays as the common case. It is not a guarantee, because the same notes say concurrent retries can reorder deliveries. No per-entity order is promised. The JSON schema is absent, so no payload field is named as a cursor.

**Duplicates.** The notes say duplicates are possible. I did not upgrade that to a formal at-least-once promise that every event eventually arrives. A non-retryable `4xx`, or the end of the five retries, can stop automatic attempts. Receivers must tolerate repeats. They should not assume eventual success.

**Retries.** “Five retries after the initial try” is six attempts. The five approximate times are attached to those retries. “Roughly” is preserved: the clock is not an SLA. I did not decide whether each number is a gap after the previous attempt or an offset from the first failure.

**Ten seconds and “timeout.”** The notes list a 10-second budget to return any `2xx`, and separately say timeouts are retried. The guide joins them in one explicit sentence (“Read together…”). That join is an editorial reading of two adjacent notes, not a single quoted rule. It is also listed below as something product can still confirm.

**Status codes.** Retries follow the list given: timeout, network error, `408`, `425`, `429`, and `5xx`. Other `4xx` codes are not retried. Any `2xx` succeeds. Because the body is ignored, a `200` whose JSON reports failure still counts as success. I stated that so a handler does not ack with an error payload.

**Rotation.** Both the current and previous secrets are valid for 24 hours, and the UI labels them that way. The receiver is told to accept either match. The notes do not say which secret signs during the overlap, so the guide does not pick one. There is no immediate-revoke feature in the notes, so none is described.

**Show-once secret.** The secret is shown once. “If you lost it, rotate and store the new value” is operational advice inferred from show-once plus the rotation UI. It is not a documented recovery API.

**Event id on retry.** Replay reuses `X-Orbit-Event`; that sentence is explicit. The header table also says automatic retries reuse it. That half is an inference: the header is an event id, not a delivery-attempt id, and duplicates are expected. There is no separate attempt id in the notes. Worth a product confirmation.

**512 KiB.** Written as 524,288 bytes because KiB is 1024 bytes. That is unit conversion, not a new cap. What the producer does above the cap is not described.

**HTTPS.** Recommended only. The notes never require a URL scheme. Plain HTTP is called out because it would expose bodies, with a pointer to confirm policy.

**Redirects.** Not resolved. Security’s “do not follow” position is reported as Security’s position. The practical advice is to register a URL that itself returns `2xx`, which is safe whether or not redirects are followed.

**Example.** One Python 3 standard-library function. It encodes the displayed secret as UTF-8 and uses lowercase `hexdigest()`. The guide says letter case and any binary key format are unspecified and tells the reader to fail closed. I did not add base64 decoding, a secret prefix, extra signature versions, or whitespace trimming. The header format in the notes is `v1=<hex>` with nothing else.

## Left out on purpose

No event-type catalog, JSON schema, ordering field, jitter formula, endpoint auto-disable, customer alert, or dead-letter queue. No `Content-Type` value. No invented clock-skew window. No claim that replay refreshes `X-Orbit-Timestamp`. No claim about which rotation secret signs. No `3xx` retry class. No multi-value signature header.

## Unresolved questions

1. Are redirects followed? Security believes they are not. The implementation owner has not confirmed that. How is a `3xx` classified for retry?
2. Is the 10-second receiver budget the same timer as the retryable timeout, or is there a separate connect or read timeout?
3. What clock skew, if any, is allowed for `X-Orbit-Timestamp`?
4. On a replay inside 7 days, is `X-Orbit-Timestamp` the original value or a new one?
5. Is the hex digest lowercase, uppercase, or accepted in either case?
6. Is the signing key the exact displayed string (the sample uses UTF-8), or is there a binary or base64 step?
7. During the 24-hour overlap, which secret signs new deliveries, current or previous?
8. Are 1 minute, 5 minutes, 30 minutes, 2 hours, and 12 hours gaps between attempts or offsets from the first failure? Is there jitter?
9. After the fifth retry fails, does Orbit pause the endpoint, alert, dead-letter the event, or do nothing further?
10. What happens to an event that would exceed 512 KiB?
11. What is the JSON schema, the set of `X-Orbit-Type` values, and is there an official ordering or version field?
12. Must the endpoint URL be HTTPS?
13. Do automatic retries, not only the replay UI, send the same `X-Orbit-Event`?
