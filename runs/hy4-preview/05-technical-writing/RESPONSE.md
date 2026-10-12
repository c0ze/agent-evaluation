# Editorial notes — WEBHOOKS.md

## Editorial choices

**Structure.** Ordered by what an integrator does first: verify a signature →
delivery/retry semantics → ordering/idempotency → key rotation → operations →
troubleshooting → open questions. The signature section leads because a wrong
verification implementation is the most common and most costly integration
failure.

**Guarantees vs. recommendations.** Used explicit bold labels (**Guaranteed**,
**Recommended**, **Not guaranteed**, **Unconfirmed**) on every claim rather than
hedging with adverbs. Anything not sourced from the notes is marked
recommended — e.g. the 300-second timestamp skew window, acknowledge-then-queue
pattern, and the alerting advice.

**Verification example.** Node.js (`node:crypto`), because it can show a real
constant-time comparison in a few lines without third-party dependencies. It
covers the four things that go wrong in practice:

1. raw bytes (not reparsed JSON),
2. `timestamp + "." + body` as the signing string,
3. constant-time comparison,
4. multiple valid secrets, so the same function works during rotation.

I deliberately did **not** include a second language; two examples would have
pushed the document past the word budget without adding information.

**Conflict: what is signed.** The notes say old docs claim parsed-JSON signing
and that the current implementation signs `timestamp + "." + raw body`. I
treated the current implementation as authoritative, documented only that
scheme, and added a visible callout saying the legacy note is stale. I did **not**
tell readers to accept both schemes by default — that weakens security — but I
allowed dual acceptance only for anyone still supporting the old system, with a
"retire this path" instruction.

**Conflict/ambiguity: retry count.** "Schedule roughly 1m, 5m, 30m, 2h, 12h"
and "five retries after initial try" agree (five intervals = five retries), so I
stated it as six attempts total. Because the notes say "roughly", I explicitly
told readers not to build logic on exact spacing.

**Conservative reading of ordering.** The notes say order "usually follows
creation" but is not guaranteed. I classified ordering as **Not guaranteed**
rather than "usually ordered" — typical behavior is not a contract, and
encouraging developers to rely on it causes production bugs.

**`4xx` semantics.** I surfaced the operational consequence of non-retried
`4xx`: silent, unrecoverable data loss. This is the least obvious part of the
retry policy and the one most likely to bite a customer.

**Security guidance.** Added the warning against logging secrets, signatures,
or full payloads, and tied it to the rotation section (payloads may contain
customer data).

**Redirects.** Treated as unresolved. The notes record disagreement between
Security and an unconfirmed implementation owner, so I did **not** state a
behavior. Instead: a "do not rely on this" entry in the open-questions list, a
"register a final URL" recommendation, and a troubleshooting row. Inventing
either answer would have been worse than flagging it.

**Troubleshooting table.** Written symptom → cause → action, and seeded from
the failure modes implied by the semantics (raw-body mutation, rotation
mismatch, duplicates, out-of-order, abandoned `4xx`, timeout-under-load, 512 KiB
limit) so it diagnoses real problems rather than restating the spec.

## Unresolved questions for product

1. **Are `3xx` redirects followed?** Security says no; implementation owner
   unconfirmed. Blocks a definitive statement.
2. **How is a `3xx` response from the receiver treated** — success, permanent
   failure, or retryable? Not covered by the retry list at all.
3. **Is `Retry-After` honored on `429`?** Affects whether customers should send
   it; currently unmentioned.
4. **Exact retry timing / jitter.** "Roughly" is not specifiable for customers
   building alerting thresholds.
5. **Is any legacy traffic still using parsed-JSON signing?** Before we
   deprecate the note entirely.
6. **Is the 10-second timeout measured to first byte or to full response?**
   Assumed full response; matters for streaming endpoints.
7. **What happens after the fifth retry** — dead-letter, alert, or silent drop?
   Not stated; customers need to know whether they can detect exhaustion.
8. **Is the 24-hour two-secret overlap automatic on rotation**, or must it be
   triggered in the UI? The notes say "two secrets valid for 24 hours" without
   saying who starts the clock.
