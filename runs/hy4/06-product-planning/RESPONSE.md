# RESPONSE.md — The three riskiest assumptions

The plan in `PLAN.md` records every assumption as `A*`, every unresolved decision
as `D*`, and every risk as `R*`. This file summarises the **three riskiest
assumptions** — the ones which, if wrong, invalidate the largest amount of the
design or create compliance exposure. They are ranked by (a) how much of the plan
depends on them and (b) how hard they are to verify before implementation.

---

## 1. The 24-hour purge deadline can be satisfied from the device

**Assumptions involved:** A18, A5, A10, A14, and the legal reading behind D5/D6 —
that "removal of local customer data within 24 hours after an inspection is
accepted" can be met by a device that may be offline for *longer* than 24 hours
and may not learn of acceptance until it reconnects.

**Why it is the riskiest.** The brief couples a hard regulatory deadline to a
**server-side event** (acceptance) while the data to be deleted lives on a
**device that is, by the brief's own description, frequently disconnected**. If
acceptance happens while the tablet is in a basement for two days, a design that
purges "when the device learns of acceptance" is non-compliant by construction.
Worse, the two obligations can collide: purging on schedule can destroy work that
was never synced (reproducing the brief's original "discard notes" defect), while
refusing to purge unsynced data can breach the deadline. A wrong assumption here is
not a bug but a compliance failure, and it is the hardest to test because it only
manifests in the field under prolonged offline conditions.

**How the plan handles it.** D5 recommends a **hybrid clock**: immediate purge on
learning acceptance *plus* a local hard cap of at most 24 hours from outbox drain
(or submission), so "by 24h after acceptance, no local customer data remains" holds
even without a check-in — because purge then occurs no later than sync completion +
24h. A **hard rule** forbids purging unsynced data; a deadline reached with an
undrained outbox raises a highest-severity alert, blocks new captures, forces a
check-in and logs the exception. The whole approach depends on **legal sign-off**
that deleting *earlier* than acceptance is compliant, and on A14's conservative
definition of what counts as customer data (including SQLite freed pages,
thumbnails, temp files and backups), with a residue-scan verification and a
reported purge proof.

**Cheapest early validation (M0):** legal/compliance interpretation of the clock
and of "local customer data"; a measurement of how long devices actually stay
offline relative to when supervisors accept.

**If wrong:** §9, M6, D5, D6 and D12 all change; the fallback would require an
MDM-forced check-in SLA or new push infrastructure, and a different, explicit
handling of unsynced data at the deadline.

---

## 2. The integer record versions are enforced on writes and available for a client-side three-way merge

**Assumptions involved:** A7 (REST endpoints enforce the version on writes via
If-Match/409 rather than treating it as advisory), A8 (the server returns a full
current record, including a usable base snapshot, for every field), and A6 (the
server, not the client, owns the authoritative audit history).

**Why it is risky.** The brief says only "REST with integer record versions" and
that "supervisors can edit the same inspection from the web". The entire conflict
policy (§7) is built on a three-way merge against a `base_snapshot` captured at the
fetched version. If the server merely *stores* a version number but does not
*enforce* it on writes, a supervisor's edit and an inspector's offline edit can
silently overwrite each other — which is exactly the data-loss defect the brief
asks us to fix, only now in both directions. If the server exposes only deltas, or
only per-field versions, the client-side merge design is invalid and either the
server must grow per-field patch/version support (D2) or conflicts must be resolved
differently. This assumption is risky because it looks like a small API detail but
silently determines whether the central correctness guarantee exists at all; it is
easy to assume and easy to be wrong about.

**How the plan handles it.** M1 makes version enforcement, an idempotency-key
store, a full-record cursor pull, an append-only audit, and an acceptance timestamp
explicit, *additive* server prerequisites with contract tests. D2 recommends
record-level If-Match plus client-side three-way merge for v1 (smallest server
change, consistent with "no collaborative editor"), with server-side per-field
versioning deferred unless pilot conflict rates justify it. §6 makes "no response"
an unknown state retried with the same idempotency key, and §7 forbids silent
last-writer-wins and audits every merge and resolution decision.

**Cheapest early validation (M0):** a contract test against the real endpoints —
write with a stale `If-Match` from two clients and confirm a 409, and confirm a GET
returns every field needed to build a base snapshot.

**If wrong:** M1 grows into a server-side patch/version-map project, and §6, §7,
D2, D3 and M4/M5 must be redesigned before any sync code is written.

---

## 3. Prefetch is complete and brief, intermittent connectivity is enough to drain the queue

**Assumptions involved:** A3 (all assigned inspections, pinned templates and
last-known server state are on the device *before* it goes offline, and assignments
are not created or reassigned mid-window), A11 (connectivity returns in windows
long enough to drain the sync queue, including up to 40 photos), A12/A16 (those
photos fit device storage and the available uplink after downscaling), A13 (the
current read-through cache holds no durable in-flight notes needing backfill), and
A4 (templates are versioned and pinnable).

**Why it is risky.** "Open assigned inspections offline" is impossible unless A3 is
true, yet the brief never describes a prefetch step or an assignment lifecycle —
it only says inspectors "open assigned inspections". If an assignment is created,
reassigned, or its template changes during the offline window, the inspector opens
nothing or opens stale work. Separately, "intermittently" is qualitative: if the
uplink windows are too short to push 40 photos, the outbox never drains, and a
permanently un-drained queue collides directly with the 24-hour purge deadline
(risk 1). This cluster is risky because it is a *chain* — prefetch, capture, drain,
then purge — where the weakest link silently breaks the compliance story, and the
real-world parameters (window length, bandwidth, photo sizes, free space, assignment
timing) cannot be inferred from the brief at all.

**How the plan handles it.** D13 recommends prefetching all currently assigned open
inspections plus pinned templates with a visible "available offline" count; A4 pins
the template version at open time so template drift cannot retroactively invalidate
saved answers. D8 decouples form-text sync from the 40 photos via client-generated
attachment IDs, independent resumable chunked uploads, and server-tolerated pending
references, so a short window still commits the text. D9 recommends on-device
downscaling, storage caps, and warn/block behaviour that never drops an already
captured photo. §4 requires a pre-departure drain of any leftover outbox, and §15
tests brief windows, 40-photo uploads across many interruptions, and storage-full
conditions. M0 validates the real reconnect windows, uplink, photo sizes, free
space, and the shipped cache schema (A13) before implementation.

**Cheapest early validation (M0):** observe one real shift's assignment timing and
reconnect windows, sample current photo sizes and device free space, and inspect the
shipped SQLite schema for any durable unsaved notes.

**If wrong:** D13/D8/D9, §4, §8, §10 and the purge interaction all change; a wrong
A13 would additionally require a data-preserving migration/backfill of in-flight
notes before anything else is built.

---

**Cross-cutting note.** All three are *assumptions*, not facts: the brief is the
only product input, and none of the three is stated in it. Each is therefore paired
with an M0 validation check and a named decision in §16 of `PLAN.md`, and
implementation is explicitly gated on M0 sign-off so that a wrong assumption is
caught before it is baked into the data model, the sync protocol, or the compliance
design.
