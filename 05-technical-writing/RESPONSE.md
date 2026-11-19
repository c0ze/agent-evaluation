# RESPONSE — editorial notes for WEBHOOKS.md

## Approach

The source notes are an engineer's shorthand: 20 lines covering protocol,
retry policy, ordering, rotation and limits, with one flagged internal
contradiction. The guide is written for a customer's backend developer who has
already registered an endpoint and now has to make it correct under failure, so
it is organised by the order in which they meet each problem: what arrives,
verify, respond, retries, ordering, duplicates, rotation, replay, operations,
troubleshooting. Reference-style material (headers, limits) is front-loaded;
narrative is kept out of the tables.

Length is 1,097 words by `wc -w`, against a 700–1,100 target. Excluding the code
block and tables the prose is closer to 800, so the guide is not padded by
markup.

## Guarantees versus recommendations

Every behavioural claim is labelled **Guarantee** or **Recommendation** at the
point of use, and the convention is defined in the first screen so a reader who
skips the intro still reads the labels correctly. This was the main structural
decision. Mixing the two is the failure mode that damages trust in webhook
documentation: a customer who builds deduplication on a suggestion that later
changes, or who assumes a documented retry schedule is exact, files a support
ticket. Labelling inline rather than in a separate "best practices" section also
forces each recommendation to sit next to the guarantee it qualifies.

Three items are deliberately downgraded to recommendations even though the notes
state them in declarative form:

- **Timestamp freshness.** The notes give the header but no tolerance window.
  Publishing "reject after 5 minutes" as a rule would invent a contract term, so
  the 300-second default is presented as the integrator's choice, with a note
  that Orbit publishes no window.
- **Approximate retry intervals.** "Roughly" is preserved verbatim in spirit:
  the schedule is given as approximate, with an explicit instruction not to
  depend on exact arrival times.
- **Dedupe retention of seven days.** Seven days is derived from the replay
  window, not stated for dedupe itself, so it is framed as a recommendation with
  the derivation visible.

## Resolving the contradiction

The notes contain one contradiction: old documentation says the signature covers
parsed JSON, while the current implementation signs `timestamp + "." + raw
body`. The guide follows the current implementation and says so explicitly,
including that the old note is stale. Two reasons: the implementation is
authoritative over documentation, and signing parsed JSON is not implementable
safely in general because re-serialisation does not reproduce original bytes.
Rather than silently dropping the old behaviour, the guide names it and explains
why it is wrong, so a customer who finds the old page in search results is not
left with two apparently valid answers. The example hashes raw bytes, and the
troubleshooting table's first row is the failure this contradiction produces in
the field.

The example was executed against seven cases — valid signature, lowercase header
names, tampered signature, tampered body, stale timestamp, missing headers,
malformed timestamp — and returns the expected result for each.

## Deliberate omissions

- **No event-type catalogue or payload schema.** The notes name no event types,
  and inventing plausible ones (`invoice.paid`) would create a contract the
  service does not have.
- **No `Retry-After` behaviour.** 429 is stated as retryable, but nothing says
  whether `Retry-After` is honoured. Mentioning it would imply support.
- **No claim of eventual delivery.** The notes describe retry mechanics, not a
  delivery guarantee, so the guide describes attempts and says the post-retry
  outcome is undocumented.
- **No HTTPS, IP allowlist or endpoint-registration detail.** Nothing in the
  notes covers provisioning; the guide opens where the notes open.

## Open questions for product

These are listed in the guide under "Needs product confirmation" with the
conservative reading, and repeated here with why each matters:

1. **Are 3xx responses followed?** Security believes no; the implementation
   owner has not confirmed. This changes whether a receiver behind a redirect
   silently loses events or fails loudly. Until confirmed, the guide tells
   readers to return a final status.
2. **What happens after the sixth attempt fails?** No retention, dead-letter,
   alerting or endpoint-disabling behaviour is documented. Customers need this
   to decide whether they must reconcile independently.
3. **Which secret signs during rotation, and can the header carry two `v1=`
   values?** The notes say two secrets are valid for 24 hours and that the UI
   labels them, but not what is sent. If only one signature is sent and it is
   the previous secret, a receiver that checks only "current" breaks mid-window.
4. **Do retries reuse the event id?** Replay is documented to reuse it; retries
   are only implied by "duplicates possible". If retries used new ids, dedupe on
   the event id would be unsound — this is the highest-impact unknown in the
   document.
5. **Is the 512 KiB limit enforced by truncation or by rejection?** The notes
   give the maximum but not the behaviour at the boundary. The guide avoids
   stating either.

Items 2, 3 and 4 need an answer from the implementation owner before the guide
can lose its "Needs product confirmation" section; item 1 needs a security
decision; item 5 is a documentation gap that probably resolves to "rejected".
