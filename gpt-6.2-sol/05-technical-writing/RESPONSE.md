# Editorial choices and product questions

## Editorial choices

- Used the source note identified as current implementation for the signing input. The older parsed-JSON instruction conflicts with that note, and the shorter HMAC-over-raw-bytes description omits the timestamp prefix. The guide specifies the timestamp header value, a literal dot, and the original body bytes.
- Put Orbit's documented behavior alongside separate receiver actions. The retry schedule is approximate, and the observed creation order is described alongside the absence of an ordering guarantee. The guide gives durable acceptance, idempotency, safe logging, and direct endpoint configuration as integration recommendations.
- Made the Python verifier independent of a web framework. It accepts the documented single-signature shape, handles malformed headers, and compares the supplied digest with each configured key using constant-time comparison. It takes secret bytes so the example makes no assumption about how the displayed secret is encoded.
- Treated UI replay as another delivery of the same event because it preserves the event ID. The guide recommends using the same deduplication path for replay and automatic retries.

## Product confirmation needed

- **Redirects and other statuses.** Does Orbit follow any `3xx` response? How does it classify responses outside the specified success, retryable, and terminal categories?
- **Retry timing.** Are the five approximate delays measured from the initial attempt or from each preceding attempt? Does a `Retry-After` header affect the schedule?
- **Timestamps and replay.** Is the timestamp regenerated for each automatic retry and UI replay? When does the seven-day UI replay window start? Does a UI replay get its own retry schedule?
- **Rotation and secret format.** During the overlap, which secret signs new deliveries, pending retries, and UI replays? Confirm whether Orbit always emits exactly one `v1` signature and whether the displayed secret should be used literally or decoded into key bytes.
