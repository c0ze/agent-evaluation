# RESPONSE — editorial choices and unresolved questions

## Editorial choices

1. **Audience and structure.** Wrote `WEBHOOKS.md` as a customer-facing
   developer guide, ordered by integration workflow: request format →
   signature verification → delivery/retries → ordering/idempotency →
   rotation → operations → troubleshooting → open questions. Length is
   ~1,000 words (`wc -w`), inside the 700–1,100 target.

2. **Guarantees vs. recommendations.** Every behavioral claim is explicitly
   labeled **Guaranteed** only when the source notes state it as service
   behavior. Everything derived, advisory, or defensive (dedup retention,
   timestamp-freshness checks, ack-fast/queue processing, alerting, secret
   storage) is labeled **Recommended**. The intro explains the convention.

3. **Signing conflict resolved conservatively.** The notes contain a direct
   contradiction: old-system docs say the signature covers parsed JSON; the
   current implementation signs `timestamp + "." + raw body`. Per the source's
   own instruction ("need state that old note conflicts"), I documented the
   current scheme as the guaranteed behavior and kept a visible callout that
   the old note is stale, rather than silently dropping it. I also emphasized
   raw-bytes handling (and used `express.raw` in the example) because
   re-serialized JSON is the most likely failure mode this conflict causes.

4. **Redirects not invented.** The notes say security believes redirects are
   not followed but the implementation owner has not confirmed. I did not
   document either behavior; instead the guide flags it as an open question
   and gives the conservative interim guidance (point webhooks at a URL that
   returns 2xx directly, no redirect).

5. **Retry semantics phrasing.** Kept the source's hedge ("roughly 1m, 5m,
   30m, 2h, 12h") and framed it as "five retries after the initial attempt,"
   i.e., up to six delivery attempts spanning roughly 15.5 hours. The 15.5h
   figure is simple arithmetic on the documented schedule, used only to warn
   about timestamp-freshness windows. Retryable triggers (timeout, network
   error, 408/425/429/5xx) and the non-retry of other 4xx are stated as
   guarantees, exactly as sourced.

6. **Verification example.** Chose Node.js for compactness and because the
   standard library provides constant-time comparison (`timingSafeEqual`),
   which the notes call for. The example is rotation-aware (accepts current
   and previous secrets) so it doubles as the key-rotation guidance, verifies
   over `timestamp + "." + rawBody`, strips the `v1=` prefix defensively, and
   shows the ack-then-queue pattern. I did not invent payload fields, event
   type names, or SDKs — the guide stays schema-agnostic and says so.

7. **Derived recommendations, marked as such.** The "keep dedup records for
   at least 7 days" advice is derived from the documented 7-day replay window
   and replay's reuse of the original event id; it is labeled Recommended,
   not Guaranteed. Same for durable idempotency (unique constraint) advice.

8. **Troubleshooting table.** Each row maps a symptom to a cause that is
   stated or directly implied by the source notes. I deliberately omitted a
   row for payloads exceeding 512 KiB because the notes state the cap but not
   what happens when it is exceeded; inventing a failure mode would violate
   the conservative-resolution rule. The cap itself is documented in the
   request-format section.

9. **Naming.** "Orbit" was inferred from the `X-Orbit-*` headers and the
   `Orbit-Hooks/2` User-Agent; no other product branding was invented. The
   guide refers to the dashboard/UI generically, since the notes mention a UI
   for rotation labels and replay but not its name or URLs.

10. **Security hygiene.** Per the notes, the guide warns against logging
    secrets or full sensitive payloads and suggests logging event id/type
    instead; it also recommends constant-time comparison and secret-manager
    storage for the shown-once secret.

## Unresolved questions (need product/implementation confirmation)

1. **Redirects:** Does the sender follow HTTP redirects? Security believes
   no; implementation owner has not confirmed. Documented as an open question
   with conservative interim guidance.
2. **Timestamp regeneration:** Are `X-Orbit-Timestamp` and the signature
   recomputed on each retry attempt? The notes are silent. This determines
   whether receivers can enforce a tight freshness window (minutes) or must
   tolerate ~15.5 hours of skew for legitimate retries. Flagged in both the
   verification section and the open-questions list.
3. **Terminal failure semantics:** After a non-retryable 4xx (or exhausted
   retries), is the event permanently dead except for the 7-day manual
   replay? The notes imply this but never state it; the guide phrases it as
   "the only recovery is a manual replay," which should be verified.
4. **512 KiB cap enforcement:** What happens to events whose payload exceeds
   the cap — send-time rejection, truncation, or delivery failure? Unknown;
   intentionally not documented.
5. **Retry schedule precision:** Are the delays exact, jittered, or
   best-effort? "Roughly" suggests approximate; kept the hedge.
6. **Signature versioning:** Will `v1=` remain the only prefix, and how will
   future algorithm versions coexist? Not addressed in the notes; the example
   only strips `v1=` and does not promise multi-version support.
7. **Stale docs cleanup:** The old "signs parsed JSON" documentation should
   be corrected or retired; the guide flags the conflict but the source docs
   themselves are outside this task.

## Deliverables

- `WEBHOOKS.md` — customer-facing webhook integration guide (~1,000 words).
- `RESPONSE.md` — this file.
- No other files were created or modified; work stayed inside this directory.
