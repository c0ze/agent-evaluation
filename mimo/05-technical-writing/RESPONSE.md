# RESPONSE.md — editorial choices and unresolved questions

## Editorial choices

1. **Signature contradiction resolved toward the current implementation.**
   `SOURCE_NOTES.md` contains three related claims: HMAC SHA-256 "over raw
   bytes"; legacy docs signing parsed JSON; and the current implementation
   signing `timestamp + "." + raw body`. I documented
   `HMAC-SHA256(secret, "<timestamp>.<raw body>")` as the guarantee, flagged the
   legacy parsed-JSON description as stale/conflicting, and did not invent a
   compatibility path. Product confirmation is requested in the guide.

2. **Guarantees vs recommendations labeled explicitly.** Every normative
   statement carries a `**Guarantee**` or `**Recommendation**` marker so
   customers can tell product behavior from operational advice.

3. **Retry semantics taken literally.** Retry on timeout, network error, 408,
   425, 429, 5xx; all other 4xx terminal; five retries after the initial
   attempt at roughly 1m/5m/30m/2h/12h. The schedule is marked approximate
   because the notes say "roughly."

4. **Success criterion stated tightly.** Any `2xx` within 10 seconds; response
   body ignored. The 10-second timeout is presented as what triggers a retry on
   timeout (interpretation; see questions).

5. **Ordering kept weak.** "Usually follows creation" is preserved as a soft
   observation, with an explicit statement that order is not guaranteed and
   duplicates are possible. Idempotency on `X-Orbit-Event` is a recommendation,
   not a claim that the platform deduplicates.

6. **Key rotation and replay documented with concrete windows.** Two secrets
   for 24 hours with UI labels current/previous; replay UI for 7 days reusing
   the same event id. Verification against both secrets during overlap is a
   recommendation.

7. **Redirects left as unknown.** Security's "no" is reported as a belief, not
   a guarantee, because the implementation owner has not confirmed. I invented
   no behavior and advised against relying on redirects for migration.

8. **Operational safety wording from the notes is included** as required:
   examples warn against logging secrets or full sensitive payloads. HTTPS is
   framed as a recommendation only — the notes never state it is required.

9. **Nothing invented beyond the notes.** No IP allowlists, content-type rules,
   signature-scheme version negotiation, or contractual clock-skew windows.
   Clock-skew rejection appears only as a recommendation whose threshold is
   left to the customer.

10. **Target length and shape.** The guide is structured for skimming (request
    format, verification, retries, ordering, rotation, replay, operations,
    troubleshooting table, open questions) and kept within the 700–1,100 word
    band.

## Unresolved questions (need product confirmation)

1. **Signature input.** Is the signed message `timestamp + "." + raw body`
   (current implementation) or parsed JSON (legacy docs)? Please confirm and
   retire the stale documentation.
2. **Redirects.** Are HTTP redirects followed on delivery? Security believes
   not; the implementation owner has not confirmed.
3. **HTTPS requirement.** Must customer endpoints be HTTPS, or is HTTP
   acceptable? Documented as a recommendation pending confirmation.
4. **Retry schedule precision.** Are 1m/5m/30m/2h/12h contractual or
   best-effort? Stated as approximate.
5. **10-second timeout semantics.** Is a `2xx` arriving after 10 seconds
   treated as failure (and retried)? Assumed yes via "retry on timeout."
6. **Secret scope and labeling.** Is the secret shown once per endpoint or per
   workspace, and how does the current/previous labeling behave with multiple
   endpoints?
