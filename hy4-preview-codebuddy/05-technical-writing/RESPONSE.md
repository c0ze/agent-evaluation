# RESPONSE — editorial choices and unresolved questions

## Editorial choices

**Audience and framing.** Written for a customer engineer standing up an
endpoint, so the document is ordered by the sequence they actually hit things:
receive → verify → handle retries → deduplicate → rotate → operate → debug.
Conceptual background is kept next to the decision it affects rather than in a
front-loaded overview.

**Guarantee vs. recommendation.** Every substantive section is split into
explicit **Guarantees** (service-committed behavior, phrased declaratively and
without hedging) and **Recommendations** (imperative advice). This is the only
reliable way for the reader to know what they can rely on contractually versus
what is merely good practice. I resisted the common doc habit of blurring the
two with "should" — recommendations are consistently addressed as "you".

**The verification example.** Minimal by design: one function, no framework
scaffolding, no retries or error handling that would distract from the two
things that actually go wrong (signing over parsed JSON, and non-constant-time
comparison). Node was chosen because Express's `express.json()` is the single
most common cause of raw-body breakage, so the example's caveat lands where
readers actually get burned. The example also carries the "don't log secrets or
full payloads" warning as a code comment, since that is where someone would
most plausibly add a `console.log`.

**Contradiction handling (old docs: sign parsed JSON vs. current: sign
timestamp + raw body).** Resolved in favor of the current implementation, and
flagged explicitly as a stale-documentation warning rather than silently
dropping the old claim. Silently fixing it would leave developers who
remembered the old docs confused about why their (correct, old-style) code
broke; stating the conflict lets them recognize their own situation. I did not
speculate about whether any tenant is still on the old signing scheme — that
would be inventing behavior.

**Implicitly resolved ambiguities (conservative readings).**

- *"Receiver has 10 seconds"* + *"retry on timeout"*: I treated the 10-second
  deadline as also being the timeout that triggers a retry, since no separate
  timeout value was given. I phrased it as a per-attempt budget rather than
  asserting a service-side timer, so the claim stays true under either reading.
- *Retry schedule*: the notes list five intervals and "five retries after
  initial try", which agree. I stated both and noted intervals are approximate,
  preserving "roughly" rather than presenting them as fixed.
- *512 KiB cap*: stated as a cap only. What happens to an event exceeding it is
  not documented, so I said nothing about it instead of inventing a rejection
  or truncation path.
- *Constant-time comparison*: the note is ambiguous about whose comparison it
  describes. I stated the service's behavior as a guarantee and mirrored it as
  a receiver recommendation, which is correct under either reading.

**Timestamp freshness.** The notes never give an accepted skew or say the
receiver *must* check timestamps, so I presented tolerance as a recommendation
("a few minutes is typical") rather than a required control, and listed the
absence of a documented skew as an open question.

**Unconfirmed items are surfaced, not smoothed over.** Rather than omitting
redirects or quietly picking the security team's position, I marked them
**Unconfirmed** inline *and* collected them in a closing list, so the doc is
honest in context and still gives a single checklist for the product owner.

**Length.** 1,080 words including the code block (~1,000 prose), inside the
700–1,100 target. I trimmed a second example language and fuller framework
scaffolding to stay there; the concepts most likely to need a second example
(ordering, rotation) are the ones least dependent on verbatim code.

## Unresolved questions requiring product confirmation

1. **Are `3xx` redirects followed?** Security believes not; the implementation
   owner has not confirmed. Blocking for anyone whose endpoint sits behind a
   redirect.
2. **What happens after the fifth retry?** No dead-letter queue, alert, or
   manual redelivery is documented. Without this, operators cannot know whether
   an exhausted event is recoverable at all; the guide currently tells them to
   assume it is dropped and reconcile by polling.
3. **When does the 24-hour two-secret overlap begin and end, and is expiry
   automatic?** "Two secrets valid for 24 hours" does not say whether the clock
   starts at creation or first use. This blocks safe automated rotation — the
   guide deliberately tells readers not to automate it yet.
4. **Is there a maximum accepted clock skew for `X-Orbit-Timestamp`?** Needed
   before I can state a tolerance as anything stronger than a recommendation.
5. **Are deliveries serialized per endpoint, or can attempts overlap?** This
   drives the concurrency-safety advice for deduplication and is the mechanism
   behind the "order is not guaranteed" caveat.
6. **Does any tenant or region still use the old parsed-JSON signing scheme?**
   If so, the stale-documentation warning needs to become a versioning note
   rather than a flat correction.

## Not resolved by omission (deliberate)

I did not invent: behavior for payloads over 512 KiB, a retry-after-exhaustion
path, an idempotency-key header, sandbox/test credentials, or SDKs. If Orbit
ships any of these, they belong in the "Delivery basics" and "Operational
advice" sections respectively.
