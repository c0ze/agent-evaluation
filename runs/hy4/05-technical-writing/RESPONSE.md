# RESPONSE.md — Editorial choices and unresolved questions

## Deliverables

- `WEBHOOKS.md` — customer-facing developer guide, 1,100 words (the top of the 700–1,100 target). Includes a minimal verification example, delivery/retry semantics, ordering/idempotency guidance, key rotation, operational advice, and a troubleshooting table.
- `RESPONSE.md` — this file.

## Editorial choices

**Labeling system.** The task requires clearly distinguishing guarantees from recommendations. I used three explicit tags on every substantive bullet — **Guarantee**, **Recommendation**, **Needs confirmation** — and defined them up front. A third category was necessary because several notes are contradictory or hedge words; presenting those as guarantees would invent behavior. Anything marked "Needs confirmation" is also re-listed in a closing section so product can act on it.

**Conservative resolution of the signature contradiction.** The notes conflict: an old doc says "sign parsed JSON", while the current implementation "signs timestamp + dot + raw body". A third note says "HMAC SHA-256 over raw bytes". I resolved this as: old doc = stale; current implementation = authoritative working assumption; "over raw bytes" = consistent with that reading (unparsed bytes with a timestamp prefix), *not* a separate signature scheme. I did **not** claim the conflict is settled. The verification example and all guidance use the current implementation, but I flagged that the exact signed-string construction is unconfirmed by the implementation owner and told readers to validate against a live delivery before go-live. I deliberately avoided inventing a JSON canonicalization scheme. This is the most conservative path: it gives integrators something usable without asserting a false guarantee.

**Preserving hedges.** "Roughly" and "usually" were kept as hedges. The retry schedule is presented as approximate, not exact; "usually follows creation" is stated conservatively as "assume no ordering guarantee at all." Turning either into a precise promise would be fabrication.

**No invented behavior.** I did not specify redirect handling, timestamp-tolerance/replay-protection policy, which rotation secret signs, retry offset anchors/jitter, or a total delivery deadline. Where the notes were silent I either said so explicitly or gave receiver-side advice framed as a Recommendation.

**Deduced-but-flagged interactions.** Two points are my own conservative inferences, each surfaced rather than hidden as facts:
- A 7-day replay window exceeds the 24-hour rotation overlap, so replay/rotation interaction is genuinely ambiguous. I flagged it and advised retaining older secrets rather than assuming a replay verifies under only the current secret.
- `X-Orbit-Timestamp` has one-second resolution, so I advise against using it for sequencing and ask product to confirm event-id stability across all retry attempts (the notes only explicitly confirm id reuse for *replays*).

**Judgment calls written as recommendations.** The `4xx` vs `5xx` and "acknowledge fast, process async" advice are logical consequences of the retry rules plus the 10-second limit, not stated service behavior, so they are labeled Recommendation. The constant-time comparison is a Guarantee in the notes ("Comparison constant-time") but I also phrased it as a receiver recommendation since a customer cannot observe the server's internal comparison — using both framings is safe.

**Security guidance.** The example uses only the standard library and never logs the secret or body; the operational section explicitly warns against logging secrets or full sensitive payloads, per the notes.

**Word count.** First draft was 1,645 words; I tightened wording without dropping any required section, trimmed the intro, and compressed the operations bullet to land at 1,100.

## Unresolved questions — needs product confirmation

These are the points I refused to invent. They also appear in `WEBHOOKS.md`.

1. **Signature scheme (highest priority).** Which is authoritative: "sign parsed JSON" (old doc) or `<X-Orbit-Timestamp>.<raw body>` (current implementation)? Confirm the exact signed string — including the separator and whether the timestamp is the header value verbatim — and formally retire the stale note. The "over raw bytes" line needs to be reconciled explicitly.
2. **Redirects.** Are `3xx` responses followed? Security believes no; the implementation owner has not confirmed. Confirm; the guide currently assumes nothing and advises serving `2xx` directly.
3. **Rotation signing semantics.** During the 24-hour overlap, which secret signs a delivery? Is `previous` used for signing or retained only for verification? When does the 24-hour clock start (at generation, at first use, at UI rotation)?
4. **Rotation vs replay.** A replay can be up to 7 days old. Which secret signs it — the original or the current one — and is the original signature preserved or regenerated? This determines how long receivers must keep old secrets.
5. **Retry precision.** Are the offsets exact or approximate? Is there jitter? Are offsets relative to the initial attempt or to the previous failure? Is there a total delivery deadline beyond the five retries?
6. **Timestamp / replay policy.** Does the service enforce any timestamp tolerance or server-side replay protection? If not, freshness is entirely the receiver's responsibility — confirm.
7. **Event-id scope.** Is `X-Orbit-Event` stable across all retry attempts (not just replays), and is it globally unique? The notes only explicitly guarantee reuse for replays; the guide's dedup advice assumes stability across retries.
8. **Minor.** Confirm the response is truly any `2xx` (not only `200`), and that "five retries after initial try" means six total attempts. Both are stated as guarantees from the notes but are worth a quick sign-off.
