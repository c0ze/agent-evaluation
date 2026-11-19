# RESPONSE — the three riskiest assumptions

`PLAN.md` rests on fourteen assumptions. Most of them, if wrong, cost rework.
Three of them, if wrong, invalidate the architecture rather than modify it —
one technical, one behavioural, one regulatory. They are ordered by how late
they can be discovered without a rewrite.

---

## R1 — The existing API can carry this protocol without a breaking change

**Assumption (A1, A2).** The REST API can be extended additively — new
endpoints, new optional fields, new headers — and the integer record version is
a whole-inspection token covering form content, so it can serve as the
concurrency token for a batch sync.

**Why it is load-bearing.** Every mechanism in the plan hangs off two server
guarantees: idempotent batch application and `If-Match` on an integer version.
The three-way merge needs a version that moves exactly when form content moves.
The retention flow needs an acceptance event the device can observe. The
attachment flow needs a staging area separate from the record. If the version
instead bumps on attachment upload, every photo upload would collide with form
edits and the rebase loop would thrash. If the API cannot add idempotency keys,
"request succeeded, response lost" — the normal case in a basement — turns into
duplicated audit events and duplicated defects on the record.

**What breaks if false.** Not a feature: the design. A non-extensible API means
either a server rewrite on the critical path, or a client that synthesises
atomicity it cannot actually get, which means partial writes and a data-loss
mode the plan claims to have eliminated. A version token that moves for the
wrong reasons means the merge base is wrong, which means the merge silently
produces wrong documents — the worst failure class here, because it looks like
success.

**How to falsify cheaply, before M1.** Not an interview — an exercise. Take the
five hardest sync cases (duplicate delivery, 409 rebase, mid-batch 401, accept
during upload, 40-photo manifest) and write them as contract tests against the
real server, in M0, with the real endpoints. Two or three days of server work
either produces the endpoints or proves they cannot exist. Also confirm what
actually bumps the version today by reading the write paths, not the docs.

**Fallback.** If batch atomicity is impossible, batch at the smallest atomic
unit and make the client's queue the transaction log, with idempotency at the
op level. If the version is not form-scoped, introduce a derived content
version for form fields and leave the existing version alone for compatibility.
Both are worse — more round trips, more conflict windows — but both preserve the
data-loss guarantees, which are the part that cannot be traded away.

---

## R2 — Offline windows are short and supervisor overlap is rare

**Assumption (A3, A4).** An inspector is offline for roughly a shift and
reconnects at least daily; supervisors and inspectors seldom edit the same
inspection at the same time, and when they do they usually touch different
fields.

**Why it is load-bearing.** This is what justifies the whole conflict
architecture. Field-level merge plus a review queue is the right design for
occasional, mostly-disjoint overlap. It is the wrong design for routine
concurrency: if a supervisor routinely edits the same inspection the inspector
is filling, the queue becomes the primary workflow, supervisors spend their day
resolving diffs, and the product has accidentally built the collaborative
editor it explicitly did not want — without the machinery that makes one
usable. The same assumption sets lease duration, package pre-download windows,
the idempotency-key retention period, and the max-age purge backstop. Every one
of those is a number that is wrong in a specific direction if inspectors
disappear for a week.

**What breaks if false.** Two distinct failures. Long offline windows push
storage past device capacity, make the 24-hour retention clock unsatisfiable in
practice, and widen the window in which a supervisor can accept a record the
device will never see. High overlap produces a conflict rate that looks like a
merge bug but is a product-model bug: no amount of merge correctness fixes a
workflow where two people edit one form all day.

**How to falsify cheaply.** Before M1, pull the data that already exists:
timestamps of assignment open and submit, edit-gap distributions per inspection,
and how often a supervisor edit lands inside an inspector's open window. The
current system, even without offline support, records enough to estimate this.
If the data is too thin, instrument the pilot's first cohort before scaling
merge complexity — and note that this is the one assumption where the honest
answer may only arrive during S1, which is precisely why the pilot is gated
rather than staged by calendar.

**Fallback.** If overlap is frequent, narrow the concurrency domain rather than
improve the merge: give the supervisor and the inspector disjoint field
ownership (supervisor-only fields, inspector-only fields), or take a soft lock
on sections rather than the whole record. If offline windows are long, cap them
explicitly — the app warns and blocks new inspection opens past a configured
age — rather than pretending a week-long offline window is a supported mode.

---

## R3 — The 24-hour deletion obligation can be met and evidenced this way

**Assumption (A6, A13, plus the acceptance gate in §10.4).** "Accepted" is the
server-side event that starts the clock; crypto-erase plus file deletion counts
as removal; and gating acceptance on device confirmation makes the deadline
reachable at all.

**Why it is load-bearing.** This is the only assumption whose failure is not a
bug but a compliance breach, and the only one that cannot be fixed forward after
launch. It also constrains the product: the acceptance gate is the mechanism
that prevents a supervisor from starting a 24-hour clock on data sitting in a
basement with no signal. Remove the gate and the plan promises something the
device cannot deliver — a supervisor accepts at 09:00, the inspector's tablet is
in a dead zone until Thursday, and the local copy outlives the legal limit by
days. The plan's honesty about that depends entirely on this reading being
correct.

Three separate claims hide inside it: (i) that "removal" is satisfied by
destroying an encryption key rather than sanitising the medium — defensible,
because overwriting flash blocks is not reliable anyway, but it is a legal
judgement, not an engineering one; (ii) that the clock starts at supervisor
acceptance rather than at submission or at some other event; (iii) that an
audited override of the acceptance gate is permissible when a device is lost
rather than merely unreachable.

**What breaks if false.** If (i) is rejected, deletion must be physical, which
means re-imaging devices — incompatible with a daily-use tablet fleet and a
much larger operational project. If (ii) is wrong, the whole retention scheduler
and receipt model is aimed at the wrong event. If (iii) is not permitted, a lost
tablet holding an acceptance-gated inspection blocks that record indefinitely,
and the product needs an escalation path that does not exist in this plan.

**How to falsify cheaply.** Written confirmation from compliance in M0, before
any code — with the specific mechanism named: per-inspection envelope keys,
destroyed at acceptance, with a deletion receipt and a max-age backstop. Ask
for the rejection in writing too, because a verbal "should be fine" is the most
expensive kind of yes. In parallel, run the purge under a manipulated clock in
S0 so the mechanism is demonstrated, not asserted.

**Fallback.** If physical sanitisation is required, the plan collapses to
"device is re-imaged after each accepted inspection", which changes the product
from offline capture to kiosk-style sync-and-reset — a different product, worth
knowing before M1 rather than after the pilot. If crypto-erase is accepted but
the acceptance gate is not, the residual risk must be written down and accepted
by compliance explicitly, with device revocation as the compensating control.

---

## How these are tracked

Each risk gets a named owner at M0 and a review point:

| Risk | Owner | Revisit at | Trigger to escalate |
|---|---|---|---|
| R1 API contract | Server lead | M0 contract sign-off | Any contract test that cannot be written |
| R2 overlap and window | Product | S0 baseline data; S1 week-one telemetry | Conflict rate above pilot ceiling, or any offline window beyond one shift |
| R3 retention interpretation | Compliance + security | M0 written confirmation | Any purge receipt missing, or any acceptance override |

The common thread: all three can be partly tested before implementation and
fully tested only in the pilot. That is the argument for the pilot being a
gated milestone with exit criteria rather than a date, and for M0 being a
milestone rather than a kickoff meeting.
