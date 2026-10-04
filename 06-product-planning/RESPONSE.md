# The three riskiest assumptions

Full reasoning lives in `PLAN.md` (§2 assumptions, §13 decisions). These three are the ones
where being wrong is expensive, expensive to discover late, or both.

---

## 1. The server can be extended additively, and its integer record version is actually enforced

**The assumption (A2 / A14 / D2).** New sync endpoints and a delta feed can be added to the
existing REST API, and the existing integer record version increments on every accepted
mutation *and is enforced* — a stale write is rejected with the current record returned, not
silently overwritten.

**Why it is risky.** This one assumption is the foundation under everything else. The integer
version is the merge base: without a trustworthy version, a three-way merge cannot tell
"changed on both sides" from "changed on one side", and every conflict decision in §7 becomes
guesswork. It is also silently load-bearing — a version field that is incremented but *not*
enforced is a very ordinary thing to find in a codebase, and the brief's wording ("use REST
with integer record versions") does not distinguish the two. If the answer is "the API is
frozen," the transport layer is not a retrofit at all; it is a separate sync service, and
M1–M4 in the milestone sequence change shape.

**Blast radius.** Total. Every other milestone depends on it, and so do the idempotency,
delta-feed, and rollback-parking designs — rollback is only genuinely reversible if the server
can keep accepting a parked cohort's ops, which is an additive-endpoint requirement.

**Cheapest way to find out.** One question to the server owner before any design work: *send
two writes at the same base version — what does the second one do?* A one-afternoon spike,
answering both halves of the question.

**If false.** Fall back to a versioned, append-only mutation-log surface beside the existing
API, and treat conflict detection as a new server responsibility with its own milestone. Do
not start M2 (the local outbox) until this is settled — the outbox is cheap to build and
expensive to re-shape.

---

## 2. The 24-hour removal rule means what the plan assumes

**The assumption (A7 / A8 / D3).** The clock starts at **server-side acceptance**, not at
inspector submission; the device is the obligated party; photos and signature images are
customer data subject to the rule; audit evidence is separate and server-side; and
never-submitted drafts are *not* customer data under the clock.

**Why it is risky.** It is a legal determination, not an engineering one, and the plan encodes
it in the storage design. Three sub-questions can each be wrong, and the errors are
irreversible in both directions:

- If the clock actually starts at **submission**, purging on the acceptance-based deadline
  destroys unsubmitted inspector work.
- If photos and signatures turn out to be **exempt as audit evidence**, the plan over-purges and
  destroys evidence it is required to keep.
- If never-submitted drafts **do** count as customer data, the device is holding customer data
  outside the 24-hour window for as long as an inspector is offline — a standing violation, not
  a one-off.

The device is the worst possible enforcement point: it may be dark for days, it may never come
back, and the compliance evidence it produces is the only proof the rule was met.

**Blast radius.** Irreversible, and it reaches the storage layout (tiered retention in §8.3),
the purge scheduler, the signature and photo data classes, and the audit design. Retrofitting
this after a violation is not a code change.

**Cheapest way to find out.** Get compliance to answer three written questions before M0
closes: what starts the clock, what counts as customer data, and what happens to an
unsubmitted draft. The plan's recommendation is on the record in D3, so compliance is
reacting to a specific proposal rather than an open question.

**If false.** The local storage design changes (the retention tiers may need to be reversed),
and the app may need to *refuse* offline drafts in some states rather than merely purging them
— which is a product decision, not an implementation detail.

---

## 3. Supervisor edits are field-scoped and infrequent enough that field-level merge is the right design

**The assumption (A9 / A12).** Supervisors editing from the web make relatively rare,
field-scoped changes; two people are not genuinely co-authoring the same text; and the brief's
"no full collaborative editor" constraint reflects real workflow rather than just budget.

**Why it is risky.** It is the plan's central bet on conflict handling. The entire design
avoids CRDT/OT and character-level merge on the strength of this assumption, and the §7.1 policy
pushes genuine divergences into a human-resolved queue. If supervisors in practice rewrite
whole sections, add and remove form fields while tablets are dark, or genuinely co-author with
inspectors, then: conflict volume grows well beyond what a badge-and-web-resolution flow can
absorb, the orphaned-answers path (§6.3) becomes routine rather than exceptional, and the
product constraint itself has to be reopened. A conflict-rate spike in pilot is the early
warning, but it arrives only after real inspectors have been through real basements.

**Blast radius.** Large and rework-shaped. The merge engine (§6, §7) and the supervisor
resolution UX are the two most expensive pieces of the plan; a wrong bet here means either
rebuilding the merge layer or shipping a queue nobody can work.

**Cheapest way to find out.** Before design work, ask two supervisors to describe their
actual editing pattern on a real inspection, and sample recent server audit history for edits
made to the *same* inspection within a short window by a supervisor and a device. That sample
is a direct measurement of the assumption, and it is data the company already has.

**If false.** Two viable paths, both cheaper now than later: constrain the supervisor web client
so that structural edits (field add/remove) are blocked while any device has a pending
unacknowledged edit on that inspection, or re-open the product constraint and fund a proper
merge model. The pilot's conflict-rate gate exists so that if this assumption fails, it fails
on a small cohort rather than at full rollout.

---

### Also worth watching, but not top three

**A1 — assignments and form definitions are already cached before the inspector loses signal.**
Cheap to mitigate (cache the whole assignment index) and cheap to verify, so the downside is
bounded — but if wrong, the feature cannot start any work offline, which defeats the purpose.

**A3 — 40 photos is the real throughput driver.** Design is already built around it
(resumable chunked upload, priority queues so photos never starve form data, and allowing
submit with photos outstanding so an inspector is never stranded), so this is a capacity
question rather than a design question.

**A10 — the existing SQLite cache is genuinely disposable.** If any unshipped offline draft
exists, or users depend on cached text, backfill becomes a workstream that the plan does not
budget for.
