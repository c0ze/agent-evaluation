# Editorial Notes and Unresolved Questions

## Editorial Choices

1. **Scope, audience, and length**
   - Written for customer developers integrating an HTTP receiver with Orbit webhooks, structured in implementation order: request format, signature verification, delivery/retry semantics, ordering/idempotency/replays, secret rotation, operational advice, and troubleshooting.
   - Kept `WEBHOOKS.md` at **942 words** (`wc -w`; 844 words excluding the code block), squarely within the 700–1,100 word target.

2. **Explicit separation of guarantees vs. recommendations**
   - Added an upfront legend and labeled subsections (**Guarantees**, **Not guaranteed / Pending confirmation**, **Recommendations**) across the guide so integrators can tell what Orbit commits to versus what is best-practice receiver design or unconfirmed behavior.
   - Framed the retry schedule (`1m`, `5m`, `30m`, `2h`, `12h`) as approximate rather than an SLA, matching the source notes ("roughly").

3. **Conservative resolution of contradictions and gaps**
   - **Signing payload contradiction:** `SOURCE_NOTES.md` contained three partially conflicting descriptions ("over raw bytes", stale legacy docs saying "sign parsed JSON", and the current implementation signing `timestamp + "." + raw body`). The guide documents `<X-Orbit-Timestamp>.<raw_request_body>` as the active verification rule, explicitly calls out the conflicting legacy notes so integrators do not parse and re-serialize JSON, and flags legacy compatibility and hex casing for confirmation.
   - **Redirects (`3xx`):** Because security believes redirects are not followed while the implementation owner has not confirmed, the guide marks redirect behavior as pending confirmation and conservatively advises pointing Orbit directly at the final HTTPS URL with no redirects.
   - **Secret rotation wire behavior:** Rather than inventing a multi-signature `X-Orbit-Signature` header syntax, the guide recommends configuring receivers to validate incoming signatures against both `current` and `previous` secrets during the 24-hour overlap, and flags the exact wire format for confirmation.
   - **Timestamp tolerance vs. manual replays:** Replay-window validation is presented as a recommendation with a caveat because it is unconfirmed whether 7-day manual UI replays refresh `X-Orbit-Timestamp` or reuse the original timestamp (which would cause strict replay-window checks to reject valid manual replays).

4. **Minimal verification example choices**
   - Used dependency-free Python standard library code (`hmac`, `hashlib`, `time`) so it is concise, immediately runnable, and easy to port to other languages.
   - Converted both hex digests to UTF-8 bytes before calling `hmac.compare_digest` to prevent `TypeError` on malformed non-ASCII header values while maintaining constant-time comparison.
   - Normalized received hex casing with `.lower()` as a conservative safeguard until exact casing is confirmed.
   - Included explicit warnings against logging signing secrets or full sensitive payloads both in surrounding guidance and in the function docstring.

## Unresolved Questions (Requiring Product / Engineering Confirmation)

1. **Signing format and legacy endpoints**
   - Is `<X-Orbit-Timestamp>.<raw_request_body>` the sole active signing format across all customer endpoints, or do any legacy endpoints still omit the timestamp prefix or sign parsed JSON?
   - Is `<hex>` in `X-Orbit-Signature: v1=<hex>` guaranteed to be lowercase hexadecimal?

2. **Redirect (`3xx`) handling**
   - Does the Orbit delivery client follow HTTP redirects (`301`, `302`, `307`, `308`), fail immediately without retry, or retry them?

3. **Secret rotation wire behavior and timing**
   - During the 24-hour overlap when both `current` and `previous` are valid, does Orbit sign requests with only one secret (and if so, when does signing switch to `current`?), or does `X-Orbit-Signature` contain multiple signatures?
   - Does secret rotation take effect immediately or after a propagation delay?

4. **Timestamp and signature behavior on retries and replays**
   - On automatic retries and manual 7-day UI replays, does Orbit generate a fresh `X-Orbit-Timestamp` and re-sign the request, or resend the original timestamp and signature?

5. **Retry and failure edge cases**
   - Does Orbit honor `Retry-After` headers on `429` or `503` responses, and is jitter applied to the `1m`, `5m`, `30m`, `2h`, `12h` schedule?
   - What happens after the 5th retry fails (e.g., alerting, dead-letter visibility, or automatic endpoint disabling)?

6. **Transport, headers, and replay UI constraints**
   - What exact `Content-Type` header is sent (e.g., `application/json` vs. `application/json; charset=utf-8`), is HTTPS strictly required (and with what minimum TLS version), and does the `512 KiB` limit measure uncompressed payload bytes?
   - Can the Replay UI resend events that previously returned `2xx`, and does a manual replay trigger another 5-retry schedule if it fails?
