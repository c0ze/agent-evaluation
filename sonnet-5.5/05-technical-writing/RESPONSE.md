# RESPONSE: editorial choices and unresolved questions

Deliverable: `WEBHOOKS.md` (1,066 words by `wc -w`, 1,004 excluding the code block; the 700-1,100 target holds either way). The Python example was executed against a synthetic signature and passed with the previous secret, failed without it, and failed on a re-serialized body.

## Editorial choices

**Labeling.** Every claim is tagged Guarantee, Recommendation, or Unconfirmed, with a legend at the top. Anything in the notes stated as fact is a Guarantee. Advice I derived is a Recommendation. Anything the notes flag as uncertain, or that I would have had to infer, is Unconfirmed and repeated in an "Open items" list.

**Signing contradiction (resolved conservatively).** The notes say the old docs sign parsed JSON and that this is "probably stale", while the current implementation signs `timestamp + "." + raw body`. The guide documents the current scheme as the only scheme, states explicitly that the older docs conflict, and tells readers not to add a parsed-JSON fallback (it would accept a scheme we do not claim to support). The first bullet's "HMAC SHA-256 over raw bytes" is read as the raw-body part of the same scheme, not a separate one. The example uses the `X-Orbit-Timestamp` header string verbatim, which avoids inventing a timestamp format.

**"Comparison constant-time."** The senders do not compare anything, so I read this as a receiver instruction and made it a Recommendation, implemented with `hmac.compare_digest`.

**Retry arithmetic.** "Five retries after initial try" and five listed intervals agree (six attempts total). "Roughly" is preserved as "approximate". The roughly 14.5-hour span is my sum of the intervals and is marked Unconfirmed, because the notes do not say whether intervals run from the previous attempt.

**Delivery is not guaranteed.** The notes support at-least-once attempts with duplicates, not guaranteed delivery, so the guide says outright that retries can be exhausted and that recovery is manual replay.

**Redirects.** Marked Unconfirmed. Security's belief ("no") and the implementation owner's silence are both reported. The reader instruction (register the final URL, never redirect) is safe under either answer, and the guide makes no promise about what Orbit does on a 3xx.

**Rotation.** The notes say two secrets are "valid for 24 hours" without saying which signs. I made the example accept a list of secrets, and made "accept both" the recommendation, since that is correct whichever secret signs.

**Ordering advice.** The notes do not describe the payload schema, so I did not invent a sequence or version field. The guide says not to overwrite newer state with older events and not to order by `X-Orbit-Timestamp`.

**Idempotency details.** Atomic insert-if-absent and "mark done only after commit" are derived from the notes' facts (concurrent retries, replay with the same event id). They are labeled Recommendations.

**Conservative omissions.** The guide does not state a timestamp freshness window, a Content-Type, HTTPS enforcement, IP allowlists, `Retry-After` handling, or which 3xx codes count as failures, because none are in the notes.

**Naming.** I called the product "Orbit", inferred from the `X-Orbit-*` headers and the `Orbit-Hooks/2` User-Agent. Please confirm.

**Support channel.** The guide says "contact us" once (early revocation after a suspected compromise) without naming a channel, because the notes name none.

## Unresolved questions for product/engineering

1. **Redirects.** Does the delivery client follow them? Does a 3xx count as a failure, and is it retried?
2. **Key format.** Is the HMAC key the displayed secret as UTF-8 bytes, or is there a prefix or encoding to strip?
3. **Signature header.** Can it carry multiple `v1=` values (for example during rotation)? What happens when a `v2` scheme is introduced?
4. **Rotation.** Which secret signs during the 24-hour overlap? Can the previous secret be revoked early after a compromise? Can rotation be repeated during the overlap?
5. **Timestamp semantics.** Is `X-Orbit-Timestamp` regenerated per attempt and per replay, or fixed at event creation? What tolerance, if any, do we recommend for replay protection?
6. **Event ID stability.** The notes confirm replays keep the event id. Do automatic retries also keep it? The dedupe advice assumes yes.
7. **Retry exhaustion.** What happens to an event after the sixth failed attempt? Is it marked failed, visible in the dashboard, or does the endpoint get disabled?
8. **Replay window.** Is the 7 days measured from event creation or from the last attempt? Does a replay get a fresh signature and timestamp, and which secret signs it?
9. **Timeout scope.** Does the 10-second limit cover connection setup and the full response, or only time to first byte?
10. **429 handling.** Is `Retry-After` honored, or does the fixed schedule apply?
11. **Oversize events.** What happens to an event whose payload would exceed 512 KiB (rejected, truncated, or sent by reference)?
12. **Are the retry intervals jittered**, and are intervals measured from the previous attempt?
13. **Support channel** to reference for compromise or replay issues, and source IP ranges for customers who allowlist.
