# Response: webhook delivery guide

## Editorial choices

1. **Signed string.** SOURCE_NOTES says the signature covers "raw bytes" and also that the current implementation signs `timestamp + "." + raw body`. I read these as consistent: the HMAC input is the timestamp, a dot, and the raw body bytes. The guide documents that form, and the test vector pins it down.
2. **Old "parsed JSON" documentation.** The notes call this "probably stale" and say the conflict must be stated. The guide says older documentation conflicts with the current implementation and should not be followed. I did not verify the staleness claim (see Q1).
3. **Retry timing.** I read "schedule roughly 1m, 5m, 30m, 2h, 12h" as the gaps between consecutive attempts, giving six attempts in total. The guide says "roughly" and does not promise exact timing.
4. **Guarantees versus recommendations.** The guide uses bold **Guarantee**, **Recommendation**, and **Pending confirmation** labels. It does not claim at-least-once or exactly-once delivery. It states that duplicates are possible and that order is not guaranteed. It also says delivery after the final retry is not guaranteed. The notes imply this but do not state it, so this is the conservative reading.
5. **Seven-day deduplication retention.** Keeping processed event IDs for at least 7 days is my recommendation, derived from the replay window. It is not a service guarantee.
6. **Timestamp freshness.** The notes give no tolerance window. Rather than invent one, the guide tells receivers not to reject deliveries by timestamp age until product confirms what the timestamp means (Q2).
7. **Redirects.** Redirect handling is not stated as behavior. The guide advises responding directly at the registered URL. Security's view ("no redirects") is not written as policy because the implementation owner has not confirmed it.
8. **3xx responses.** The notes do not classify 3xx responses as success, failure, or retryable. The guide lists this in the troubleshooting table as pending rather than picking a behavior.
9. **Test vector.** The vector uses the made-up secret `test-secret` and the body `{"ok":true}`. I computed it with OpenSSL and checked it against the Python snippet, run with `python3 -I`. It is not a real Orbit value.
10. **Not invented.** The guide has no API endpoints, payload field names, event type names, delivery-log features, or Content-Type values. The only UI reference is "replay UI," which the notes mention.
11. **Length.** `WEBHOOKS.md` is 829 words by `wc -w`, including code and table markup. It is 769 words excluding table pipes and rules. Both counts are within 700–1,100.

## Unresolved questions for product and engineering

1. Is the old "sign parsed JSON" documentation stale? Was it ever live, and did any customer integrate against it? If so, those customers may be failing verification today and need a migration note.
2. Does `X-Orbit-Timestamp` reflect each attempt, or the original event creation time? This decides whether freshness checks are safe.
3. When does the 24-hour overlap start: at rotation, or when the new secret is created? Can the previous secret be revoked early? Does the service sign with the current secret only, or with both during overlap?
4. Are redirects followed? Security says no; the implementation owner has not confirmed. What happens to a 3xx response: success, failure, or retry?
5. Are retry gaps measured between attempts or from the first attempt? Is there jitter? Can customers rely on "roughly" as a bound?
6. Do retries reuse `X-Orbit-Event`? The notes say only that replays do. The deduplication advice depends on retries too.
7. After the fifth retry fails, is the event marked failed anywhere besides the replay UI? Is the 7-day replay window measured from creation or from the last attempt?
8. Does a 2xx that arrives after 10 seconds count as success? Does the 10-second limit cover connecting, sending, and the response, or only the response?
9. What happens to a payload over 512 KiB: is it truncated, dropped, or delivered without the body?
10. Are plain-HTTP endpoints accepted? The guide recommends responding directly but says nothing about scheme.
11. Is there a sequence number or version field that would help customers order events? Without one, the guide tells customers to reconcile against their own state.

Before the guide is released to customers, the items under **Pending confirmation** in `WEBHOOKS.md` (Q2, Q3, Q4, Q6, Q8) must be resolved or removed. Q1 should be settled first, because it decides whether customers need a correction notice.
