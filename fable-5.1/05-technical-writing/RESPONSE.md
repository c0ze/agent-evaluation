# Task 05 response: editorial choices and open questions

## Deliverables

- `WEBHOOKS.md`: 1,076 words by `wc -w` (about 1,025 excluding table pipes; about 795 prose only, excluding the code block and table rows). Sections: request format, verification with a minimal Python example, delivery/timeout/retry semantics, ordering and idempotency, secret rotation, operating a receiver, a troubleshooting table, and an "Unconfirmed" list.
- `RESPONSE.md`: this file.

The Python example was extracted from the guide and run against a small self-test (valid signature accepted; previous secret accepted during rotation; wrong secret, modified body, stale timestamp and malformed header rejected). The test script lives in the session scratchpad, not in this directory.

## Editorial choices

1. **Three-way labelling.** Every section is tagged *Guarantee*, *Recommendation* or *Unconfirmed*, with the three terms defined once at the top. Guarantees are limited to behaviour the notes state as fact about the service. Everything about how the receiver should behave is a recommendation, even when strongly advised. The notes list "comparison constant-time" as a fact, but it is receiver-side behaviour the service cannot enforce, so it appears as a recommendation.

2. **Signature scheme: current implementation only, no fallback.** The notes say older docs describe signing the parsed JSON and that this is "probably stale", while the current implementation signs `timestamp + "." + raw body`. I documented only the current scheme, described the old one as "believed stale", and listed it under Unconfirmed. I deliberately did not suggest "try the old scheme if verification fails": a receiver that accepts two schemes is weaker, and a stale scheme should be retired rather than kept alive in customer code. I read "HMAC over raw bytes" and "timestamp + dot + raw body" as consistent: the raw bytes are the body portion of the signed message.

3. **Timestamp tolerance: included as a recommendation, with a caveat.** The timestamp exists to bound replay attacks, so the example enforces a 300-second tolerance. The notes do not say whether a manual replay (up to 7 days later) carries a fresh timestamp; if it reuses the original, a tolerance check rejects replays. I kept the check as the secure default and flagged the caveat in the example comment, the troubleshooting table and the Unconfirmed list, with "widen the tolerance while replaying" as the interim workaround.

4. **Rotation procedure derived from "shown once".** Because a new secret is visible only after it is generated, the receiver cannot pre-load it. The safe order is generate, add, deploy, confirm, remove the old secret within 24 hours. Verifying against a list of secrets works whether the sender signs with the new secret only, the old one until switch-over, or both; which of these it actually does is unconfirmed. I advised replaying any deliveries rejected in the generate-to-deploy gap.

5. **`401` for failed verification.** Non-listed 4xx responses are not retried. A bad signature will not fix itself on retry, so a final status is correct, and replay covers the rotation-gap case. I rejected the alternative of returning 5xx to force retries because it would mask misconfiguration and burn the retry budget.

6. **Retry schedule wording.** "Roughly 1m, 5m, 30m, 2h, 12h" could mean gaps between attempts (last retry about 14.6 hours after the first attempt) or offsets from the first attempt (about 12 hours). I wrote "expect the last retry 12–15 hours after the first attempt", which holds under either reading, and kept "roughly".

7. **3xx and redirects.** 3xx appears in neither the retry list nor the do-not-retry list, and redirect-following is unconfirmed (security believes no). The guide tells customers to use a URL that answers directly, says a 3xx "may count as a failed delivery", and does not state whether it is retried.

8. **Deduplication retention of "8 days or more"** is derived from the 7-day replay window plus up to roughly 15 hours of retries for a replayed delivery.

9. **`413` advice** is derived from the 512 KiB maximum plus "other 4xx not retried". Default body-size limits in many frameworks are far below 512 KiB, which would silently turn large events into final failures.

10. **Ordering advice** ("treat the event as a signal and re-read the resource from your source of truth") is deliberately generic. The notes describe neither a read API nor the payload schema, so I did not invent one.

11. **Logging warning** appears next to the example (where it will be copied from) and again under operations, covering secrets, signature values and full payloads.

12. **Python, standard library only.** It is the shortest correct expression of HMAC, constant-time comparison and a multi-secret loop. The example uses the secret's UTF-8 bytes as the HMAC key; that is an assumption (question 2 below).

13. **Left out for lack of source material:** payload schema, event type catalogue, IP allowlist, endpoint pausing after sustained failures, and any signing version other than `v1`. Nothing was invented to fill these gaps.

## Unresolved questions for product and the implementation owner

1. **Signed message.** Confirm it is exactly the `X-Orbit-Timestamp` value, a `.`, and the raw body bytes; confirm the "parsed JSON" description is retired everywhere it appears; confirm the hex digest is lowercase. The guide documents the current implementation.
2. **Secret encoding.** Is the secret used as its literal UTF-8 bytes, or must it be decoded from hex or base64 before use as the HMAC key? The example assumes UTF-8 bytes.
3. **Redirects.** Does the sender follow them? Is a 3xx response retried, treated as final, or followed? The guide says not to rely on redirects.
4. **Rotation window.** During the 24 hours, does each delivery carry one signature (signed with which secret?) or two? If two, what is the separator in `X-Orbit-Signature`? The guide verifies against both secrets; the example checks a single `v1=` value and would need to split the header if it can carry several.
5. **Replay.** Does a replayed event carry a fresh `X-Orbit-Timestamp` and signature? Does a replay go through the normal retry schedule? Does the 7-day window count from event creation or from the last failed attempt?
6. **Retry schedule.** Are the delays gaps between attempts or offsets from the first attempt? Is there jitter? Is the schedule a commitment or best effort?
7. **Oversize payloads.** What happens to an event whose payload would exceed 512 KiB: not generated, truncated, or sent with a reference? The guide states only the maximum.
8. **Timeout definition.** Is the 10-second budget measured to the first response byte or to the complete response, and is there a separate connect timeout?
9. **Not in the notes but customers will ask:** does the service pause or disable an endpoint after sustained failures, and is there a source IP range to allowlist?
