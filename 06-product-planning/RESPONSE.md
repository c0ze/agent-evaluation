# Response — the three riskiest assumptions

These are the three assumptions in `PLAN.md` that most threaten the plan. They are ordered by
expected damage if wrong, not by likelihood. Each entry states what would falsify it, and what
we would do instead.

---

## 1. A2 — Inspector and supervisor edits are mostly disjoint by field

**Assumption:** The inspector owns findings/measurements/photos/signature; the supervisor owns
assignment/schedule/scope/acceptance; and concurrent edits to the *same* field are rare.

**Why it is load-bearing:** The whole conflict policy rests on it. If the domains are genuinely
disjoint, most concurrent edits merge automatically and the inspector almost never sees a
conflict dialog — which is exactly what "no full collaborative editor" requires. If they overlap
heavily, we are not building a merge; we are building a conflict-resolution workflow that an
inspector has to work through in a basement, on a tablet, at the end of a shift. That is a
different product, and "no collaborative editor" quietly turns into "manual reconciliation".

**What would falsify it:** Instrument the web supervisor app for one inspection cycle and count
edits by field *after* an inspection has been opened on a tablet. If a meaningful share of
supervisor edits touch findings/measurements/comments — not just scheduling and assignment — A2
is false. Note that supervisors "cleaning up" an inspector's notes before acceptance is the
common real-world case that breaks this.

**If it is false:** Auto-merge shrinks to scheduling metadata only; contested fields must
surface a diff to a human; and the pilot exit metric on conflict rate has to be renegotiated
before stage 3. It also makes the ownership matrix (decision D2) the single most important
 artifact in M0 rather than a formality.

**Mitigation now:** D2 is gated as an M0 exit criterion, and M9 alerts on conflict-rate spikes
precisely because a spike is the signal that A2 was wrong.

---

## 2. A10 / A9 / D9 — The 24-hour local purge can be met without destroying accepted work

**Assumption:** "Accepted" is a server-side transition, the deletion clock starts from a
server-confirmed timestamp, and we may retain a non-PII purge receipt as evidence.

**Why it is load-bearing:** This is the only hard regulatory obligation in the brief, and it
sits directly on top of two untrusted inputs — the device clock (A11) and the device's network
state at the deadline. Three things can go wrong at once: the device is offline when the clock
starts, the device clock is wrong, and the inspection still has unsynced work when the deadline
arrives. In that state, deleting means losing an inspector's accepted work; not deleting means
missing a compliance deadline. The plan resolves this by refusing to do either silently
(quarantine + alert + supervised drain), but that resolution assumes compliance accepts a
quarantine path at all. If they require unconditional deletion at the deadline, the design has
to guarantee that nothing unsynced can exist at acceptance time — which pushes acceptance to be
strictly online and changes the offline submit story (D10).

**What would falsify it:** A written answer from compliance on two questions: (a) does a
non-PII purge receipt satisfy the audit history requirement, and (b) is an encrypted quarantine
with a supervised drain an acceptable temporary state? Also, a check of whether a tablet can
even *reach* an accepted state offline under the current server model.

**If it is false:** M8 grows, D9 is reopened, and — worst case — acceptance must require
connectivity, which weakens the core offline promise at the exact moment the inspector is
leaving the basement.

**Mitigation now:** D8, D9, and D11 are all gated as M0 exit criteria; purge failure is
classified as a paging alert rather than a reliability metric; and the compliance test suite
explicitly covers offline-at-deadline, reboot, and clock skew.

---

## 3. A8 — Intermittent connectivity is sufficient to get a full inspection out

**Assumption:** When signal returns, it is good enough (or resumable enough) to upload answers,
a signature, and up to 40 photos — roughly 80–240 MB under A7 — without starting over.

**Why it is load-bearing:** This assumption is what makes "offline" a feature rather than a
trap. Collecting everything offline is easy; the failure mode that would sink the pilot is an
inspector surfacing with a completed inspection that then cannot get out — because the upload
restarts on every drop, the tablet throttles, the battery dies mid-upload, or a basement stairwell
gives 30 seconds of signal at a time. The brief says connectivity returns *intermittently*, which
is the hostile case for a large payload. Resumable chunked upload is the mitigation, but it is
only a mitigation — it does not create bandwidth that is not there.

**What would falsify it:** A field measurement before the pilot: on the actual pilot route,
capture a 40-photo inspection offline and time a full upload under real signal conditions,
including deliberate interruption. If a full inspection cannot complete within a plausible
window, or resumes cost more than they save, A8 is false.

**If it is false:** Resumable upload moves from hardening to mandatory in M5; partial submit
(answers and signature first, photos following) becomes a required product behaviour rather than
an implementation detail; and the pilot may need a staging point with Wi-Fi, or a supervisor-side
expectation that photos lag the report.

**Mitigation now:** Attachment upload is a separate queue from record ops, so answers and the
signature are never held hostage by photos; upload progress is per-attachment and resumable; and
the basement field test in M10 is an exit criterion rather than a nice-to-have.

---

## Note on what this plan omits

No dates and no staffing estimates appear anywhere in `PLAN.md`. Sequencing is expressed purely
as milestone dependencies with per-milestone acceptance criteria (§15), because duration depends
on the M0 decisions and on team capacity, neither of which is known from the brief. Estimating
either would be invention, not planning.
