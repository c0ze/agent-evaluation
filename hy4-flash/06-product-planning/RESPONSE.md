# Response — Three riskiest assumptions

The plan is grounded only in `BRIEF.md`; below are the three assumptions whose
failure would most damage correctness or compliance, drawn from §1 of `PLAN.md`.

1. **A4 — The server REST API can support the sync primitives (D3).** The entire
   design depends on reads returning an integer version, conditional writes that
   return 409 on mismatch, idempotency keys, incremental pulls, audit ingestion, and
   blob upload. The brief only says APIs are REST with integer versions; it does not
   promise conditionals, idempotency, or blob endpoints. If these are absent, we must
   build a thin sync wrapper service (a separate project with its own rollout), and
   the optimistic-concurrency/replay-safety design changes substantially. This is a
   hard dependency for the sync milestone, so it must be validated first.

2. **A1/A2 — How "accepted" and the 24 h deletion clock are defined for offline
   devices (D2).** Regulations require local customer data removed within 24 h of an
   inspection being accepted, but an offline tablet cannot observe a server-side
   acceptance event. The plan assumes an authoritative acceptance timestamp and
   compensates with a capture-time backstop; if compliance does not accept that
   interpretation, or defines "customer data" more broadly, the deletion architecture
   and the proof-of-purge ledger are wrong, with direct regulatory exposure. This
   needs explicit compliance sign-off before implementation.

3. **A8 — The existing SQLite cache holds only derived, read-through data with no
   unsaved user edits.** The brief says SQLite is currently a read-through cache, but
   if inspectors have meaningful unsaved drafts in it when the durable store ships,
   treating cached rows as read-only base data would silently discard real work —
   reproducing the very data-loss problem this feature exists to fix. This must be
   verified against the current app before migration begins; the backup plan is a
   one-time draft-capture step.
