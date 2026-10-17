# Three riskiest assumptions — offline inspection sync

`PLAN.md` (this directory), §3 lists fifteen explicit assumptions (A1–A15)
built on `BRIEF.md` as the only product input. The three below are the
riskiest because each is both uncertain from the brief and load-bearing:
if any one is false, a core part of the design — not a detail — has to
change. All three are scheduled for evidence-gathering in milestone M0,
before implementation builds on them.

## 1. A1 — Assigned work is known and downloadable before signal is lost

The whole offline model is "download assigned inspections (with their
form version) while online, then open them from SQLite with no signal".
The brief says inspectors need to "open assigned inspections" offline,
but never says when assignments are made, how often they change, or
whether inspectors are reliably online between assignment and arriving
in a basement. If assignments are frequently created or changed while an
inspector is already out of coverage, inspectors will arrive on site
with a tablet that truthfully says "not downloaded" — the feature works
exactly as designed and still fails the user. Fixing that after the fact
means a different product (offline creation of unassigned inspections,
speculative pre-download of likely work), which the plan currently
places out of scope (A13, §5). Validation is cheap and must come first:
review the real assignment workflow and timing with operations in M0,
including how often same-day changes happen after an inspector leaves
coverage.

## 2. A3 — Supervisor web edits rarely collide on the same field, and disjoint-field edits merge safely

The conflict policy (D2) auto-merges edits to different fields and asks
a human only where both sides changed the same field differently. That
is a good policy only if same-field collisions are uncommon and fields
are semantically independent enough to merge piecemeal. The brief
establishes that supervisors *can* edit the same inspection from the
web, but says nothing about how often, which fields, or why (correcting
the inspector's entries would be the worst case: collisions on exactly
the fields the inspector just filled in, plus field groups that only
make sense changed together). If A3 is wrong, one of two bad outcomes
follows: inspectors/supervisors drown in manual resolutions and route
around the feature, or — worse — disjoint auto-merges produce
internally inconsistent inspections that nobody ever reviewed as a
whole. The plan refuses silent last-writer-wins precisely to avoid
discarding work, which makes the human-resolution load the safety
valve; A3 is the assumption that the valve is sized correctly.
Validate in M0 by analysing actual web edit patterns per field and
interviewing supervisors, declare any must-change-together field groups
as single conflict units, and re-check the assumption against real
conflict rates at the pilot exit gate (M6) before broad rollout.

## 3. A4 — The integer record version is a reliable optimistic-concurrency token

The sync protocol (D3, §8) is built on the brief's single sentence that
"existing server APIs use REST with integer record versions". The plan
assumes that version is server-assigned, monotonic per record, returned
on every read, and enforceable on write so a tablet can say "this edit
was made against version N" and the server can detect that a supervisor
has since moved the record to N+2. If the version turns out to be
client-influenced, non-monotonic, shared across records, not returned
consistently, or simply ignored on write, there is no trustworthy way
to detect concurrent change — and without conflict detection, every
intermittent-sync retry risks silently overwriting a supervisor's edit,
recreating today's discarded-notes problem between two people instead
of one. Recovering would mean server-side change tracking/versioning
work *before* any sync protocol can be designed, reordering the
milestones. This is fully testable in M0: read the API contract and
server behaviour, probe stale-write handling against staging, and check
version presence/monotonicity across real in-flight inspections —
evidence the plan requires before M2 depends on it.

In short: A1 decides whether offline work can *start*, A3 decides
whether convergence is *bearable and safe* when two people edit, and A4
decides whether convergence is *detectable at all* on the existing API.
Each is cheap to test early and expensive to discover late, which is
why M0 exists as a gate rather than a formality.
