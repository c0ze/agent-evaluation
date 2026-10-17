# Response — editorial choices and unresolved questions

## What I produced

`WEBHOOKS.md` is a customer-facing developer guide built only from
`SOURCE_NOTES.md`. It covers, in task order: a minimal verification
example, delivery and retry semantics, ordering/idempotency, key
rotation, operational advice, and a troubleshooting table. I put
verification and acknowledgement before retry detail, because a new
integrator's first two failure modes are “my signature never matches”
and “I process inline and time out.”

## Editorial choices

**Guarantee vs. recommendation labeling.** The task asked for this
distinction explicitly, so instead of relying on subtle verb choices
(“will” vs. “should”) I defined three labels in the introduction —
**Guarantee**, **Recommendation**, **Pending confirmation** — and
applied them in every section. Retry codes and windows, the 10-second
deadline, non-guaranteed ordering, the 24-hour rotation overlap, and
the 7-day replay window are labeled guarantees (including negative
guarantees, which matter as much as positive ones); receiver design
advice is labeled recommendation throughout.

**Conservative resolution of contradictions.**

- *Parsed JSON vs. raw body.* The notes say the old “sign parsed
  JSON” document is “probably stale” and the current implementation
  signs `timestamp + "." + raw body`. I followed the current
  implementation, but flagged the stale note in a callout rather than
  silently dropping it, because customers migrating from the old
  system are exactly who will hit this. The example verifies raw
  bytes before parsing.
- *“Usually in order” vs. “not guaranteed.”* Stated as a negative
  guarantee (ordering is *not* guaranteed) with “usually” demoted to
  an observation. All guidance assumes out-of-order arrival.
- *“Roughly” retry schedule.* Kept the word “roughly/approximate” and
  told readers not to depend on exact timing; I did not invent jitter
  bounds or an anchor point (from first attempt vs. previous attempt).
- *Redirects.* The notes mark this uncertain (security thinks no;
  owner unconfirmed). Rather than guessing, the guide says
  “assume not followed” and files it under Pending confirmation.

**The code example.** Python, standard library only, framework-
agnostic, so it ports easily and needs no dependencies. It signs
`timestamp.encode() + b"." + raw_body`, uses `hmac.compare_digest`,
requires the `v1=` prefix, and iterates over a secret list so the
same function works during rotation without a second example. It
deliberately does *not* implement a timestamp-freshness check: the
notes specify no tolerance, so the prose recommends a freshness check
and leaves the window to the integrator instead of embedding an
invented “5 minutes” in code readers would copy as gospel. Two
assumptions the notes leave implicit are baked into any example and
listed as questions below: the timestamp header string is used
verbatim, and the secret is a text string encoded as UTF-8 for the
HMAC key. I executed the snippet to check it accepts a correct
signature (including via the second, rotation secret) and rejects
tampered bodies, wrong secrets, and a bad version prefix.

**What I refused to invent.** The notes contain no event-type
catalog, payload schemas, endpoint-setup UI steps, TLS/IP-allowlist
requirements, `Retry-After` handling, timestamp tolerance, failure
notifications after retries are exhausted, or behavior for payloads
over 512 KiB. None of these appear in the guide as fact; where a
reader would naturally assume one (`Retry-After`, tolerance), the
guide explicitly says it is unconfirmed. Generic operational advice
(logging hygiene, alerting, test cases) is included only under the
Recommendation label, since it constrains the reader's system, not
Orbit's.

**Length.** `wc -w` counts the guide at about 1,050 words including
code and table markup (about 990 excluding the code block), inside
the 700–1,100 target under either counting method. Fitting that
budget is why operational advice and troubleshooting use terse
bullets/table cells rather than prose.

## Unresolved questions for product/engineering

Ordered by how much they could break a customer integration:

1. **Redirects (from the notes).** Are `3xx` responses followed? If
   not, is a `3xx` retryable or terminal? Guide assumes “not
   followed” and tells customers to register final URLs.
2. **Timestamps on retries and replays.** Is `X-Orbit-Timestamp`
   (and therefore the signature) regenerated on each attempt and on
   replay, or is the original reused? If reused, any freshness check
   will reject the 12-hour retry and 7-day replays — the guide's
   freshness advice depends on this answer. Relatedly, is there a
   recommended or enforced tolerance window?
3. **Signed-payload details.** Confirm the byte layout is exactly the
   header timestamp string, one ASCII dot, raw body. What is the
   secret format/encoding (plain text, hex, base64)? During rotation
   does the header ever carry two signatures, or must receivers try
   both secrets against one `v1=` value (as the example assumes)?
4. **Retry mechanics.** Are the 1m/5m/30m/2h/12h intervals measured
   from the previous attempt or the first? Is there jitter? Is
   `Retry-After` on `429`/`503` honored, capped, or ignored?
5. **After exhaustion.** Once the fifth retry fails, is the customer
   notified (dashboard state, email, event)? Is there any record
   beyond the 7-day replay window? The guide says only that automatic
   attempts stop, which is all the notes support.
6. **Rotation details.** When does the 24-hour overlap clock start?
   Can a customer rotate again during an overlap, or revoke the
   previous secret early? Does Orbit sign with the new secret
   immediately upon generation?
7. **Replay details.** Is the 7 days measured from event creation,
   first delivery, or last attempt? Does a replay get a fresh retry
   budget? Who can trigger one? (Same-ID reuse is confirmed and used
   in the guide.)
8. **Oversize payloads.** What happens above 512 KiB — publish-time
   error, dropped event, truncation? Guide states the cap only.
9. **Event ID semantics.** Is `X-Orbit-Event` unique globally or per
   endpoint, and for how long? The guide recommends retaining dedup
   records at least 7 days (the replay window); a confirmed retention
   bound would strengthen this.
10. **Missing reference material.** Event-type/payload-schema
    documentation and endpoint prerequisites (TLS, URL reachability,
    IP ranges if any) are absent from the notes and from the guide;
    both should be linked before publication. Also unspecified: any
    per-object ordering stronger than the global non-guarantee, and
    delivery concurrency/rate limits a receiver should expect.

Until items 1–3 are answered, the guide's conservative defaults
(assume no redirects, verify raw bytes, tolerate duplicates and
reordering) keep a customer safe under either eventual answer.
