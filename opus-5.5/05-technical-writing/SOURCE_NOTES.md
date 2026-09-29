# Raw webhook notes

- POST JSON. Event id in `X-Orbit-Event`; event type `X-Orbit-Type`.
- signature header `X-Orbit-Signature`: `v1=<hex>` using HMAC SHA-256 over raw
  bytes. Secret shown once. Comparison constant-time.
- docs from old system say sign parsed JSON; this is probably stale. Current
  implementation signs timestamp + dot + raw body. Timestamp header is
  `X-Orbit-Timestamp` Unix seconds. Need state that old note conflicts.
- retry on timeout, network error, 408, 425, 429, and 5xx. Do not retry other
  4xx. Schedule roughly 1m, 5m, 30m, 2h, 12h. Five retries after initial try.
- receiver has 10 seconds to return any 2xx. Response body ignored.
- duplicates possible. Delivery order usually follows creation but concurrent
  retries mean it is not guaranteed.
- secret rotation: two secrets valid for 24 hours; UI labels current/previous.
- replay UI can resend an event for 7 days and uses same event id.
- payload max 512 KiB. User-Agent `Orbit-Hooks/2`.
- uncertain: are redirects followed? Security thinks no, implementation owner
  has not confirmed.
- examples should warn against logging secrets or full sensitive payloads.

