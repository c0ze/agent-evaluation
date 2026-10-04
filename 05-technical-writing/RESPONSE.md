# Editorial notes — `WEBHOOKS.md`

## Structure

Ordered around the integration lifecycle rather than the raw note order:
overview → verify → respond → retries → ordering/idempotency → rotation →
operations → troubleshooting. A developer wires the endpoint in that sequence, and
it keeps every claim about request handling ahead of the advice built on top of it.

The verification example uses Node.js (`node:crypto` only) because the notes call
out raw-body handling as the main failure mode, and that is easiest to show
concretely there. The algorithm is language-agnostic; only the example is not.

## Guarantee vs. recommendation

Every behavioral statement is tagged **[Guarantee]** or **[Recommendation]**.
The mapping I used:

- **Guarantees** are anything the notes state as system behavior: headers, signing
  scheme, 10-second budget, retryable status codes and schedule, at-least-once
  delivery, non-guaranteed ordering, 7-day replay, 24-hour dual-secret window,
  512 KiB limit, `Orbit-Hooks/2`.
- **Recommendations** are the customer-side practices the notes imply rather than
  state: timestamp tolerance, dedupe store sizing, branch on `X-Orbit-Type`,
  rotate-then-deploy-then-remove, async processing, logging redaction, alerting.

Two inferences I promoted to recommendation rather than leaving implicit:

- **7-day dedupe retention** is derived from the replay window plus retry
  schedule, not from a stated guarantee. Framed as advice.
- **Non-retryable `4xx` as a discard mechanism** is a direct reading of "do not
  retry other 4xx." It is stated as a guarantee, but it is an inference — flagged
  below.

## Contradictions resolved

1. **Signed payload: parsed JSON vs. raw body.** The notes explicitly call the
   "sign parsed JSON" documentation stale. I resolved in favor of the current
   implementation (`timestamp + "." + raw body`) and stated the conflict inline
   rather than deleting the old behavior, with a migration note to keep accepting
   the legacy scheme during transition. This is the conservative direction: it
   documents the live scheme while not leaving integrators with a silent
   verification break.

2. **Redirects.** Security's position (do not follow) is the only documented
   intent, and the implementation owner has not confirmed. I wrote the behavior
   as a guarantee *with* an explicit parenthetical pointing to the open question,
   and gave the actionable advice (treat `3xx` as failure, use a final URL), which
   is correct under either answer. Flagged for confirmation rather than hedged
   into vagueness.

3. **Ordering.** "Usually follows creation order, but not guaranteed" is stated as
   an unordered guarantee rather than as partial ordering, so integrators do not
   build sequencing logic on it.

## Unresolved — needs product or implementation confirmation

1. **Redirect following (open).** Whether Orbit follows `3xx`. Security says no;
   the implementation owner has not confirmed. Needs a definitive answer before
   the guarantee wording is final. The doc currently carries the caveat.
2. **Legacy signature scheme.** Is the parsed-JSON scheme formally deprecated with
   an end-of-life date, and does Orbit still emit it for any endpoint type? The
   guide currently tells migrating integrators to dual-accept without a deadline.
3. **Timestamp tolerance.** Orbit does not reject stale deliveries, and the notes
   give no recommended window. I used five minutes, which is conventional but is
   my choice, not Orbit policy. If Orbit wants to state a supported window, it
   should replace this number.
4. **`4xx` as a deliberate discard.** Confirm that returning a non-retryable `4xx`
   is an intended pattern before it is documented as a guarantee.
5. **Retry schedule precision.** "Roughly" 1m/5m/30m/2h/12h is documented as
   approximate. Whether a tolerance is specified is unknown.
6. **Terminal failure visibility.** No notes cover whether dropped deliveries are
   queryable or alerted. The troubleshooting table therefore stops at "never
   retried" with no path for recovering a permanently dropped event. If a
   dead-letter view or failure log exists, it should be documented.
7. **Multiple signature versions.** The header shape (`v1=`) implies a version
   prefix; whether a `v2=` scheme is planned affects whether the parsing example
   should be version-aware now.
8. **Idempotency key support.** No idempotency header is documented. If Orbit ever
   adds one, the dedupe guidance should be revised.
