# RESPONSE.md — Three riskiest assumptions

The plan (`PLAN.md` §2) lists all assumptions. These three carry the most risk:
if any is wrong, core parts of the design, schedule, or compliance posture must
be reworked. Each is a gating item in Milestone M0 and is validated in the pilot.

## 1. The existing REST + integer-version APIs can be extended to support offline sync (A1 / D1)

**Assumption.** Without a server redesign, the backend can add (or wrap) the
semantics offline sync needs: version-preconditioned writes, a **batch** sync
operation, client **idempotency keys** (`mutation_id`, `attachment_id`),
**client-generated UUIDs** for offline-created sub-records, **resumable**
attachment upload, and an **observable `accepted` status** with a server
timestamp.

**Why it's risky.** The brief fixes only "REST with integer record versions."
Everything downstream — the outbox/batch protocol (M4), field-level conflict
merge (M5), idempotent retries over flaky links, offline attachment creation
(M3), and the precise purge clock (M6) — depends on the server supporting these
additions. Integer versions give optimistic concurrency, but not batching,
idempotency, or an acceptance signal by themselves.

**Impact if wrong.** Sync degrades to sequential version-checked `PATCH` calls
(slow in short reconnect windows, higher battery/data cost); idempotency must be
bolted on client-side; conflict handling gets coarser; and the 24h purge loses its
precise `accepted_at` origin (compounding risk #3). Schedule slips because the
server contract, not just the client, changes.

**Mitigation.** Confirm the full API contract with the backend team in **M0**
before any client build; design a sequential-REST fallback (still idempotent) so
the client can proceed even if batching slips.

## 2. Inspector and supervisor edits are largely disjoint and forms have stable field keys (A3 / D2 / D10)

**Assumption.** Concurrency is mostly inspector-offline vs supervisor-online on
**different** fields/sections, and forms are normalized by stable `field_key`, so
a **field-level three-way merge** resolves nearly all conflicts without a
collaborative editor.

**Why it's risky.** The brief explicitly rules out a full collaborative editor
yet requires supervisors to edit the same inspection. If, in practice, both roles
edit the *same* fields (e.g., both adjust the same finding or note), or forms are
opaque/dynamic blobs without stable keys, field-level merge breaks down.

**Impact if wrong.** Conflicts collapse to record-level, and the "server wins"
policy would override inspector work frequently — technically not silent (audit
preserves it) but operationally a data-loss/redo problem and a poor experience.
At that point the "no collaborative editor" constraint is in tension with real
usage, forcing either accepted overrides or scope growth.

**Mitigation.** Pick a pilot form with genuinely disjoint inspector/supervisor
ownership (D7); measure the conflict rate and same-field-override rate in the
pilot (§11) as explicit evidence for A3 before broad rollout; make per-field
policy (inspector-wins / manual-review) configurable.

## 3. The 24-hour local purge can be guaranteed on tablets that may stay offline (A4 / D5)

**Assumption.** Local customer data can always be removed within 24 hours of
acceptance. Deletion itself is local and needs no connectivity, but the **deadline
depends on the client learning the server's `accepted` status and `accepted_at`
timestamp**.

**Why it's risky.** A tablet that goes into a basement and does not reconnect
again (or reconnects only after the window) may never observe `accepted`, so it
cannot compute the exact `accepted_at + 24h` deadline. This is a **regulatory**
requirement, so a miss is a compliance failure, not just a bug.

**Impact if wrong.** Devices could retain customer PII past the legal window,
creating regulatory exposure — precisely on the managed tablets used in the field,
which are also the most likely to be lost, wiped, or left offline.

**Mitigation.** Dual mechanism (D5): (a) status-driven purge at
`accepted_at + 24h` when `accepted` is observed; (b) a **conservative local TTL
backstop** that auto-purges customer data after a bounded time from last
sync/capture so the worst case still respects 24h even if `accepted` is never
seen; (c) **MDM remote wipe** as a last resort for never-returning devices. Purge
runs locally (no network needed) using **server-authoritative time** (D8),
retains a compliance receipt/tombstone, and its on-time rate is tracked as a pilot
KPI with an alert on any miss. This assumption is confirmed with
security/compliance in **M0** and stress-tested in **M6** (offline-at-deadline and
never-re-synced scenarios).
