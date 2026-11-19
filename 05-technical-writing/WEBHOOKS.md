# Webhook Delivery Guide

A developer guide for integrating with Orbit's webhook service.

**How to read this guide.** Statements are labeled **Guarantee** (service behavior you may rely on), **Recommendation** (our advice, not a promise), or **Needs confirmation** (notes contradictory, approximate, or silent — we invent nothing). Hedged notes stay hedged; open points are at the end.

## Anatomy of a delivery

- **Guarantee:** `POST` with a JSON body of at most 512 KiB. Headers: `X-Orbit-Event` (event id), `X-Orbit-Type` (event type), `X-Orbit-Timestamp` (Unix seconds), `X-Orbit-Signature` (`v1=<hex>`), and `User-Agent: Orbit-Hooks/2`.
- **Guarantee:** A delivery succeeds only on any `2xx` returned within 10 seconds; the response body is ignored.
- **Recommendation:** Keep exact raw bytes before parsing (verification needs them). Return `2xx` promptly and process asynchronously; don't build a response body. Authenticate via the signature, never the User-Agent.

## Verifying signatures

- **Guarantee:** The signature is HMAC-SHA-256, hex-encoded with a `v1=` prefix, keyed by a secret shown only once at creation.
- **Needs confirmation (conservative resolution):** An older doc says the signature covers *parsed JSON*; this **conflicts** with the current implementation, which signs `<X-Orbit-Timestamp>.<raw body>` — timestamp, a `.`, then raw bytes, never a re-serialized value. The "over raw bytes" note is consistent with this (unparsed bytes plus timestamp prefix), not a second scheme. We treat the old note as stale and use the current implementation below, but the exact signed string is unconfirmed by the implementation owner. Validate against a live delivery before go-live; no JSON normalization will verify.
- **Recommendation:** Compare constant-time over the whole `v1=<hex>` value, using raw bytes; store the secret in a secrets manager immediately.

Minimal example (Python standard library):

```python
import hashlib, hmac

def verify(raw_body, headers, secret):
    signed = headers["X-Orbit-Timestamp"].encode() + b"." + raw_body
    expected = b"v1=" + hmac.new(secret, signed, hashlib.sha256).hexdigest().encode()
    return hmac.compare_digest(expected, headers["X-Orbit-Signature"].encode())
```

`raw_body` is the exact bytes received before JSON decoding; `secret` is the shared secret as bytes. The signed timestamp lets you enforce a freshness window. **Needs confirmation:** no server-side timestamp tolerance is specified, so any window is your policy, not service behavior.

## Delivery and retry semantics

- **Guarantee:** Retries occur on timeouts, network errors, and HTTP `408`, `425`, `429`, and `5xx`. Other `4xx` are not retried.
- **Guarantee:** Five retries after the initial attempt, at roughly 1m, 5m, 30m, 2h, and 12h. "Roughly" is intentional — treat these as approximate.
- **Guarantee:** Duplicates are possible.
- **Recommendation:** Timeouts are retryable, so a processed event can be redelivered if you answer slowly. Once durably accepted, return `2xx` and process off the request path. Use `5xx` for transient failures (they retry); reserve `4xx` for permanently invalid requests, e.g. a failed signature. Serve `2xx` from the registered URL directly, not via redirects (see below).

## Ordering and idempotency

- **Guarantee:** Order usually follows creation, but concurrent retries mean it is **not guaranteed**. Stated conservatively: assume no ordering at all.
- **Guarantee:** The replay UI can resend an event for up to 7 days and reuses the same event id.
- **Recommendation:** Make handlers idempotent and deduplicate on `X-Orbit-Event`; record processed ids, ignore repeats (replay reuses the id). Don't infer sequence from arrival order: `X-Orbit-Timestamp` has one-second resolution and is not a sequencing token; derive order from event data or your own sequence. Retain dedup state for at least 7 days.

## Key rotation

- **Guarantee:** Two secrets are valid for a 24-hour window during rotation; the UI labels them `current` and `previous`.
- **Recommendation:** Deploy the new secret to every verifier first, then rotate in the UI; during overlap, accept a match under either secret. Keep secrets only in a secrets manager.
- **Needs confirmation:** Which secret signs during overlap, whether `previous` is used for signing or only verification, and when the 24-hour clock starts are unspecified. Verify against both until clarified.
- **Needs confirmation:** A replay may be 7 days old while the overlap is 24 hours. Which secret signs an older replay — and whether the signature is preserved or regenerated — is unspecified. Retain older secrets across the replay window; don't assume a replay verifies under only the current secret.

## Operational advice

- **Recommendation:** Never log the secret or full bodies (payloads may hold sensitive data); log event id, type, verdict, and latency. Cap your reader at 512 KiB and reject oversized bodies. Answer within 10s: `2xx` now, work later. Monitor `429`/`5xx` responses, duplicate ids, and verification failures — a spike usually means rotation order was wrong or `previous` dropped too early. Keep your clock healthy if you enforce freshness.

## Troubleshooting

| Symptom | Likely cause | Recommended action |
| --- | --- | --- |
| Signatures never verify | Body re-serialized before hashing; wrong secret; stale "parsed JSON" assumption | Hash raw `<timestamp>.<raw body>`; confirm secret; see Needs confirmation |
| Failures spike after rotation | New secret not deployed first, or `previous` removed too early | Verify against both during overlap; roll out, then rotate |
| Same event processed twice | Expected duplicates from retries or replays | Deduplicate on `X-Orbit-Event`; make handler idempotent |
| Events arrive out of order | No ordering guarantee; concurrent retries | Don't rely on order; sequence from event data |
| Deliveries stop after a deploy | Endpoint not returning `2xx` within 10s | Return `2xx` promptly; move work off request path |
| Unexpected retries, or none | Only timeouts, network errors, `408`/`425`/`429`/`5xx` retry; other `4xx` don't | `5xx` for transient, `4xx` for permanently bad requests |
| URL returns `3xx`, nothing happens | Redirect behavior unconfirmed | Return `2xx` directly; don't depend on redirects |
| Replayed event won't verify | Secret rotated since original (unconfirmed) | Retain older secrets for 7 days; ask product |

## Needs product confirmation

This guide is written to not depend on the following open points:

1. **Signature scheme.** Parsed JSON (older doc) or `<timestamp>.<raw body>` (current)? Confirm the exact signed string and retire the stale note.
2. **Redirects.** Are `3xx` followed? Security believes no; the implementation owner has not confirmed. We assume nothing.
3. **Rotation semantics.** Which secret signs during overlap, is `previous` used for signing, when does the window start?
4. **Rotation vs replay.** Which secret signs a replay older than the window, and is the signature preserved or regenerated?
5. **Retry precision.** Offsets are "roughly"; exact values, jitter, whether relative to the initial attempt or last failure, and any total deadline are unspecified.
6. **Timestamp policy.** Any server-side tolerance or replay protection, or is freshness entirely the receiver's job?
7. **Event id scope.** Is `X-Orbit-Event` stable across all retry attempts (not just replays) and globally unique?
