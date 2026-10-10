# Editorial choices — WEBHOOKS.md

## Resolutions to source-note contradictions

- **Signature scheme (raw bytes vs parsed JSON).** The notes flagged an unresolved conflict between older documentation and the current implementation. I treated the current behavior as authoritative (`HMAC SHA-256` over `timestamp + "." + raw_body`, hex-encoded, prefixed `v1=`) and called out the old "sign parsed JSON" guidance as stale in both the headers section and the open-questions section. I did not invent an answer that blends the two.
- **Retry schedule is approximate.** The notes used the word "roughly" for the 1m/5m/30m/2h/12h intervals. I described them as approximate and told readers not to depend on a fixed wall-clock gap. This is conservative without inventing behavior.
- **Ordering.** The notes say order "usually follows creation but concurrent retries mean it is not guaranteed." I preserved that language and added idempotency-key guidance.
- **Redirects.** The notes say security thinks "no," implementation owner has not confirmed. I did not assert either answer; I documented it as best-effort until product confirms, in the open-questions section.

## How guarantees vs. recommendations are marked

- Phrasing like "Orbit attempts," "is set to," "stay valid for," and the named retry status codes are framed as guarantees.
- The 5-minute clock-skew tolerance is labeled a *recommendation*. Orbit does not enforce it; rejecting stale timestamps is a customer-side defense against replay.
- The "treat the retry schedule as approximate" line marks scheduling as non-guaranteed.
- The 24-hour previous-secret window, the 512 KiB cap, the 7-day replay window, and the 10-second response deadline are framed as Orbit's enforced rules.

## Verification example

Chose Python because it is the most universally readable language in a developer guide and because `hmac.compare_digest` makes the constant-time requirement obvious. The example computes the signature over `f"{ts}.".encode() + raw_body`, matching the spec exactly. I added an explicit comment warning against `JSON.parse`-before-hash because that is the most common foot-gun and matches the troubleshooting table.

## What I deliberately omitted

- No made-up dashboard URLs, exact replay-UI labels, or API hostnames — the notes did not provide them.
- No asserted behavior on redirect-following, since it is unresolved.
- No specific status code for replayed-event timestamp drift (left as a question for product).

## Unresolved questions for product

1. **Redirects**: confirm whether deliveries follow `3xx` redirects. Security recommends no; engineering has not confirmed.
2. **Replay timestamp**: confirm whether a replay reuses the original `X-Orbit-Timestamp` or mints a fresh one. This affects customer replay-window tolerances.
3. **Old-doc cleanup**: confirm that the stale "sign parsed JSON" guidance in older customer-facing docs can be retracted, and route any necessary customer notifications.
4. **Tolerance enforcement**: confirm whether Orbit intends to enforce a maximum timestamp drift on the server side, or whether the 5-minute window is purely a customer-side convention.