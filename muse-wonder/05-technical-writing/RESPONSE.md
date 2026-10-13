# Editorial response — Task 05

## Deliverables

- `WEBHOOKS.md` — customer-facing webhook delivery guide (954 words by `wc -w`, within the 700–1,100-word target).
- `RESPONSE.md` — this file.

## Editorial choices

**Audience and structure.** I wrote for an external developer integrating a receiver, ordered by the path they follow: verify first, then delivery/retry behaviour, then correctness concerns (ordering/idempotency/replay), key rotation, operations, and troubleshooting. Headers, limits, and deadlines are summarised in an opening table so implementers can check configuration without reading the full prose.

**Guarantees vs. recommendations.** I labelled statements inline as **Guaranteed**, **Recommended**, or **Not guaranteed**/**Not confirmed** throughout, and defined those terms in the introduction, rather than confining the distinction to one section. Where the notes use hedged language ("usually", "roughly"), I preserved the hedge by downgrading the claim: ordering is "usually follows creation" but *Not guaranteed*; five retries is guaranteed but exact timing is not; constant-time comparison and raw-body handling are recommendations built on a guaranteed header/format. This avoids turning observed behaviour into a promise.

**Resolving the signature contradiction conservatively.** The notes contain two incompatible signing definitions: old-system docs say the parsed JSON is signed; notes on the current implementation say `timestamp + "." + raw body`. I treated the current-implementation note as authoritative — it is explicitly flagged "probably stale" for the old docs — and made the guide specify `timestamp + "." + raw_body` over raw bytes everywhere. I also called out the conflict explicitly in a blockquote in `WEBHOOKS.md`, rather than silently picking one, so readers migrating from old docs understand why re-serialised JSON verification fails and can diagnose it (also covered in the troubleshooting table). I did not invent details the notes omit, such as character encoding beyond using the header value verbatim, hex casing, or whitespace handling.

**Verification example.** I kept the example minimal, single-language (Python, standard library only), and focused on the two traps that matter: using raw bytes (not parsed JSON) and constant-time comparison via `hmac.compare_digest`. It strips the `v1=` prefix and includes the timestamp exactly as signed. It deliberately omits framework boilerplate, routing, and storage so it stays portable. Per the notes, both the example and the prose warn against logging secrets or full sensitive payloads.

**Delivery semantics.** I described delivery as at-least-once, inferred directly from "duplicates possible" plus retries and replay reusing the same ID, and stated exactly-once as *Not guaranteed* rather than asserting a formal delivery guarantee the notes do not name. Retryable vs. non-retryable statuses, the 10-second/`2xx` rule, ignored response body, and the five-retry schedule are stated as guarantees; the load-shedding preference for fast `2xx` + queueing is marked as advice. I did not specify what happens after retries are exhausted (dead-letter, UI state, alerting) because the notes do not say.

**What I did not invent.** I did not add a timestamp tolerance/replay window, a redirect/status-code policy for `3xx`, post-retry-exhaustion behaviour, payload-too-large handling, event-type catalogue, or schema/versioning — none are in the notes. Where a gap affects integration (notably timestamps), I gave only a hedged recommendation ("choose and monitor your own window") and flagged it as unconfirmed, instead of picking a conventional number such as five minutes.

## Unresolved questions (need product/implementation confirmation)

1. **Redirects — explicitly uncertain in the notes.** Are `3xx` responses followed, treated as success, treated as retryable, or treated as non-retryable failure? Security expects "not followed" but the owner has not confirmed. The guide tells readers to use a direct `2xx` URL until confirmed. This is the only item I carried into `WEBHOOKS.md` as **Not confirmed** in two places (operational advice and troubleshooting), plus a closing "Pending confirmation" section.
2. **Timestamp tolerance.** Is there a server-enforced or recommended window for rejecting old `X-Orbit-Timestamp` values? Without it, replay protection is left to each receiver.
3. **Signed-payload encoding details.** Confirm the timestamp is signed as the exact header string (ASCII/UTF-8, no normalisation) and that the dot is a single literal `.` byte with the raw body appended unmodified — the guide assumes this from "timestamp + dot + raw body" but the notes do not spell out encoding.
4. **Behaviour after retries are exhausted.** Are exhausted events surfaced in a UI/API, dead-lettered, or silently dropped, and can they still be replayed within the 7-day window?
5. **`3xx` and other edge statuses for retry.** Aside from redirects, how are `3xx` responses classified against the retry list (only `408`, `425`, `429`, `5xx`, timeout, and network error retry)?
6. **Replay mechanics.** Does a replay get a fresh timestamp/signature, count against the retry schedule, and is it rate-limited? The notes confirm only the 7-day window and ID reuse.
7. **Oversize payloads.** What happens above 512 KiB — is the event rejected at creation, truncated, or never emitted? The guide states the maximum but not the enforcement behaviour.
8. **Secret shown once.** If a secret is lost, is creating a new one the only recovery, and does that immediately start a 24-hour two-secret overlap like rotation? The guide assumes yes for the recovery path; please confirm.

None of the open items above are specified as fact in `WEBHOOKS.md`; item 1 is flagged in the guide itself, and items 2–8 are either omitted or hedged as recommendations there and listed here for follow-up.
