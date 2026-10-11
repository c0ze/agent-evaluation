# RESPONSE.md — Editorial choices and unresolved questions

## Editorial choices

1. **Signature scheme conflict (resolved conservatively, but called out).**
   The source notes say old documentation describes signing parsed JSON, while
   the current implementation signs `timestamp + "." + raw body` and calls the
   old note "probably stale." I documented the current implementation as
   authoritative and added an explicit callout in the guide warning that older
   documentation exists and may mislead integrators, directing them to confirm
   with support if their integration predates the change. I did not silently
   pick a winner.

2. **Retry schedule presented as approximate.** The notes say "roughly 1m, 5m,
   30m, 2h, 12h." I listed the exact intervals but framed them as approximate
   ("treat it as 'over the course of about 12 hours,' not a precise backoff
   contract") rather than presenting an SLA the service has not committed to.

3. **Redirects left unconfirmed.** Security believes redirects are not
   followed, but the implementation owner has not confirmed. I documented no
   behavior either way: the guide marks this **Unconfirmed** and recommends
   returning `2xx` directly. I did not invent a guarantee.

4. **Timestamp freshness.** The notes specify the `X-Orbit-Timestamp` header
   but no service-side tolerance. The example includes a 300-second receiver-
   side check, explicitly labeled as a recommendation with the tolerance
   described as illustrative. No service-side replay window was invented.

5. **Rotation semantics interpreted from "two secrets valid for 24 hours."** I
   stated that both secrets are accepted for 24 hours after rotation and that
   only the current secret is accepted afterwards. The second clause is my
   interpretation of the natural reading; flagged below for confirmation.

6. **Idempotency model.** Because replays reuse the same event id (stated in
   the notes) and retries carry the same event id, I presented
   `X-Orbit-Event` as a safe idempotency key — this follows directly from the
   notes rather than being invented.

7. **Guarantee/Recommendation/Unconfirmed labels.** To keep guarantees
   distinct from advice, every load-bearing statement carries an explicit
   label, and the guide opens by defining the three labels.

8. **Example choice.** One minimal Python example (`hmac.compare_digest`,
   raw-body HMAC, timestamp prefix), since the task asked for a minimal
   verification example. Per the notes, the guide warns against logging
   secrets or full sensitive payloads.

9. **Security warnings from the notes** (secret shown once, don't log
   secrets/payloads) were placed both in the verification section and the
   operational checklist.

## Unresolved questions needing product/engineering confirmation

1. Are HTTP redirects followed on delivery? Security believes no; the
   implementation owner has not confirmed. The guide currently treats this as
   unsupported.
2. Is there a service-side tolerance for the `X-Orbit-Timestamp` value (e.g.,
   rejecting very old deliveries), or is replay protection entirely the
   receiver's responsibility?
3. Is the previous secret hard-revoked exactly when the 24-hour rotation
   window closes, and can a second rotation start while an overlap window is
   still active?
4. Is the retry schedule fixed or jittered, and does it interact with any
   per-endpoint rate limiting that could produce `429`s of its own?
5. Should the stale "sign parsed JSON" documentation be formally corrected or
   deprecated so external integrators stop finding it?
6. Is ordering guaranteed within any narrower scope (e.g., per event type or
   per source object), or is it fully unordered?
7. Is the 512 KiB limit enforced at event creation or at delivery time, and
   what failure does an oversized event produce?
8. Can replay be automated via API (the notes only mention a UI), and does a
   replay follow the same retry rules as an original delivery?

## Word count

`WEBHOOKS.md` is approximately 970 words including code, tables, and
headings, within the 700–1,100 target.
