# RESPONSE — Three riskiest assumptions

The three riskiest assumptions in PLAN.md are:

1. **The REST/integer-version API can be extended additively without breaking
   existing clients (A4, decision D4).** The entire sync protocol depends on
   server capabilities the brief does not confirm: version preconditions on
   writes, a 409 payload rich enough for field-level conflict resolution,
   idempotent photo uploads, and an incremental-pull cursor. If the server
   team cannot or will not add these, conflict handling degrades to
   record-level last-writer-wins (risking exactly the data loss the brief
   wants to eliminate) and push/pull becomes far chattier. This is why the
   API contract is gated in milestone M0 before any client or server build.

2. **Device storage and SQLite reliability are sufficient for worst-case
   offline loads (A3).** The plan assumes roughly 200 MB per inspection (40
   photos at up to ~5 MB) multiplied by the pre-download window, on
   company-managed tablets whose actual free space, OS background-execution
   limits, and database behavior under low storage are unverified. If wrong,
   the failure mode is severe: failed captures or corrupted outbox state in
   exactly the offline environments (basements) the feature targets. The
   plan mitigates this with compression defaults, a configurable storage
   floor (D8/D9), and explicit pilot verification in M1/M5, but it remains a
   physical constraint that no software design can fully remove.

3. **"Accepted" is a single, observable server-side transition that starts a
   purge clock the client can reliably honor (A5, decision D1).** The 24-hour
   regulatory deletion requirement hinges on the client learning of
   acceptance in time and purging even when devices are offline for long
   stretches. If acceptance is ambiguous (multiple review states), or if
   devices routinely stay offline past the deadline, the compliance
   guarantee fails silently. The plan therefore treats purge-overdue
   detection as a server-side alert on missing receipts rather than trusting
   the client, and requires legal/compliance confirmation of the accepted
   definition and of any retroactive-purge expectations (D7) before
   implementation.
