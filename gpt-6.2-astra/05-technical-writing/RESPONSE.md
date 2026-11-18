# Editorial choices

- I used the current implementation’s signing input and called out the conflict with the older parsed-JSON instructions. The Python example preserves the timestamp text and body bytes, validates the v1 digest format, and uses a constant-time digest comparison with either active key.
- I separated Orbit’s acknowledgment and retry rules from receiver design advice. The six-attempt limit covers automatic delivery. The five scheduled times are approximate, and a manual replay preserves the event ID.
- I used a durable work item with a unique event ID to explain when a 2xx is safe, including when concurrent requests race or a response is lost. The worker guidance covers a separate failure point after an external side effect. The ordering guidance also works for events that carry no sequence or version field.
- I kept replay and key rotation distinct. The seven-day replay window informs ID retention. The 24-hour overlap determines when to deploy and retire verification keys.

## Questions for product confirmation

- Does Orbit follow redirects, and how does a 3xx affect the remaining attempts? Security expects redirects to be ignored, but the implementation owner has yet to confirm. The guide advises configuring the final URL directly.
- Are the approximate retry times delays after each failure or offsets from the initial attempt? The guide lists the supplied schedule without calculating a last-attempt deadline.
- Which timestamp does Orbit send on automatic retries and UI replays? The guide does not prescribe a timestamp-age cutoff that could reject a legitimate redelivery.
