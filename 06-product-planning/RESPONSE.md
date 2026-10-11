# RESPONSE — The three riskiest assumptions

These are the three assumptions in `PLAN.md` §2 that, if wrong, are most likely to
invalidate the design rather than merely delay it. Each is listed with what breaks,
what in the plan would change, and how to close it before implementation starts.

---

## 1. The 24-hour purge and the audit history can be satisfied simultaneously (A9 + A10)

**The assumption.** "Accepted" is a server-side status transition, the 24-hour clock
starts at the server's acceptance timestamp, and the regulatory audit history can be
retained after local customer PII is removed — because the retained audit entries can be
pseudonymous (hashes and opaque refs instead of names and addresses).

**Why it is the riskiest.** The brief states two requirements that pull in opposite
directions: keep an audit history, and delete customer data within 24 hours. If the
audit history is legally required to record *who signed* and *what was recorded*, then
the very fields that make the audit meaningful are the fields we must delete. There is no
engineering trick that resolves this — it is a compliance interpretation, and guessing it
wrong produces a regulatory breach that is discovered long after release, on a device
that is already in a basement. The secondary risk is the clock: if we key the 24 hours
off device time (A13), a skewed clock silently breaches it.

**What changes if it is wrong.** If identity must be retained locally, the local purge
becomes a partial redaction with a compliance-approved retention carve-out, and the
device must be treated as in-scope for longer. If instead the purge is absolute, the
audit history must be **server-side only**, and the local audit log can retain nothing
but hashes and ids (which is what the plan currently assumes). Either way §8.3 and the
`audit_log` / `signatures` tables change, and M4's acceptance criteria change with them.

**How to close it.** Written confirmation from compliance on (a) the start of the clock,
(b) the exact enumerated field list that counts as "customer data", and (c) whether the
audit entry may reference the signer by hash. Then encoded as a test fixture in M0 — not
as a comment in the code.

---

## 2. Field-level conflict resolution is safe with per-record integer versions (A7 + A8)

**The assumption.** The backend team can add a small number of additive sync endpoints —
notably a change-log/field-level history — and record versions are bumped on *every*
write path, including web supervisor edits.

**Why it is risky.** The brief says versions are integers on the record. That tells us
*that* an inspection changed, never *which field*. Without field-level history, the only
available conflict policy is whole-record last-write-wins — which, in an app whose entire
purpose is to stop losing inspectors' notes, means the app will systematically discard
either the inspector's field notes or the supervisor's correction. That is not a
performance problem, it is the original bug reintroduced under a different name. The
quieter failure is worse: if even one server write path forgets to bump the version, a
client push is accepted as uncontended and overwrites data with **no conflict, no
signal, no trace**.

**What changes if it is wrong.** If new endpoints are refused, the plan degrades to
whole-record LWW with `If-Match`, conflict resolution UI is reduced to "discard and
redo", and D3's recommendation must be escalated to inspection-level check-out as a
**hard requirement** rather than a follow-on. Data loss becomes an expected, documented
product trade-off instead of an incident. If versions are reliable but field history is
not, we keep the per-op idempotent push but resolve conflicts by full-record comparison
and human review on every divergence.

**How to close it.** Written agreement from backend owners in M0 that the three
endpoints in §5.1 are in scope, plus an audit of every server write path for version
increments, plus a recurring canary job that flags any record whose version fails to
advance while `updated_at` does.

---

## 3. 40 photos per inspection can actually be stored and uploaded in the field (A5 + A6)

**The assumption.** Worst-case capture is on the order of a few hundred MB per
inspection before optimisation, the device has that headroom, and the connection that
returns is slow but usable enough to finish the upload.

**Why it is risky.** This is the assumption that fails *in production* rather than in
review. It combines three unknowns we have not measured: real file sizes on the oldest
tablet in the fleet, free storage after weeks of accumulated inspections, and actual
throughput at a job site. The failure mode is insidious: the form data is the part we
can protect deterministically, but if an inspector finishes an inspection, drives out of
the basement, and the 40 photos never finish uploading, **from their point of view the
inspection is still broken** — and they will go back to paper. It also interacts with
compliance: photos are customer data and are in scope for the purge, so storage pressure
and purge deadlines are competing forces on the same disk.

**What changes if it is wrong.** If capture volume is larger or storage tighter than
assumed, we must reduce resolution at capture, evict uploaded photos
aggressively, and make the pre-offline storage projection blocking (§7.9). If upload
throughput is worse, chunk sizing, bounded parallelism, and the "optimised by default"
policy (D8) all move from optimisation to requirement — and depot-Wi-Fi upload becomes
the expected path rather than the fallback. If the legal requirement is original
resolution, the entire storage and upload budget must be re-planned, which is exactly
why D8 must be answered before M1 rather than discovered at M3.

**How to close it.** Measure all three numbers in M0: actual captured file size on
target hardware, free storage across a sample of in-service devices, and throughput from
three representative sites. Then set the chunk size, parallelism, and default quality
policy from those measurements — and keep `free_storage_bytes`,
`local_db_size_bytes`, `attachment_upload_success_rate` and
`upload_duration_p95` on the pilot dashboard so the assumptions stay falsifiable after
launch.

---

## Common thread

All three share one property: **they cannot be closed by writing better code.** They are
a compliance ruling, a cross-team API commitment, and three field measurements. That is
why M0's acceptance criteria are stated as evidence and named owners rather than as
completed tasks — the rest of the milestone sequence is only as sound as these three
answers.
