# Response — Three riskiest assumptions

The plan rests on ten assumptions (see `PLAN.md` §1). The three below are the
riskiest because each one, if wrong, forces a redesign rather than a tuning
change. They are stated as the assumption, why it is risky, what the early
signal of it being wrong looks like, and what the plan would do about it.

---

## 1. A single inspector owns an inspection at a time (Assumption A2)

**The assumption.** Inspectors do not collaborate in real time on the same
inspection from two tablets. A given inspection has at most one offline writer
on a tablet at any moment; the supervisor edits from the web are a separate
concern (see risk #2).

**Why it is risky.** This is the foundation of the data model. The local
change log, the `local_version` counter, the photo ownership, the signature
ownership, and the "one envelope per inspection in flight" rule all depend on
there being a single offline writer. If two tablets can edit the same
inspection offline at the same time, the conflict policy stops being "inspector
vs supervisor" and becomes "inspector vs inspector," which is exactly the
collaborative-editor scenario the brief explicitly rejects. The audit story
also breaks: a regulator asking "who entered this note and when" needs a clean
single-writer lineage.

**What would tell us it is wrong in the pilot.**
- Two tablets assigned to the same inspection in the assignment API.
- Inspection handover in the field ("take over for me") without a server round-trip.
- Multiple devices signed in by the same inspector.
- Any early conflict that cannot be explained by a supervisor edit.

**What the plan would do if it is wrong.** Stop the pilot at Stage 1 and
re-scope. The honest fix is a CRDT for form fields, OT for ordered photo
lists, and a presence model. That is a different product, not a different
version. The right move is to either (a) add server-side single-writer
locking with a clear "claim" model, or (b) accept that handover is server-
mediated and enforce that in the assignment UI. The first is the smaller
change; the second is a process change.

---

## 2. Supervisor web edits while an inspector is offline are the exception, not the norm (Assumption A3)

**The assumption.** Supervisors typically open an inspection before an
inspector starts work, or after the inspector submits. Mid-visit supervisor
edits are an edge case. The plan sizes conflict UX and the conflict rate
budget against this (target < 5% of submissions).

**Why it is risky.** Every supervisor mid-visit edit becomes a 409 conflict
the inspector must resolve by hand. The plan intentionally rejects automatic
merging, so the inspector sees a side-by-side screen and must choose. If
supervisors routinely edit in the gap (e.g., a quality reviewer who flags
issues while the inspector is still in the basement), conflicts become a
daily tax on inspectors, the resolution UI gets exercised far more than the
pilot exit criteria anticipate, and the "no full collaborative editor" stance
starts to feel like a product gap rather than a deliberate choice. It also
stresses the audit log with `conflict_resolution` rows, which is fine, but
it is the kind of volume that hints the product is asking for a collab model
in disguise.

**What would tell us it is wrong in the pilot.**
- Conflict rate above the 5% gate at any weekly checkpoint.
- A pattern of conflicts on the same small set of fields (signals systematic
  supervisor review).
- Supervisor feedback that the conflict UX is "blocking their work."
- Audit log dominated by `conflict_resolution` events on routine edits.

**What the plan would do if it is wrong.** Introduce a server-side
"supervisor notes" overlay: a separate field set that supervisors can edit
freely and that does not enter the conflict path with the inspector's
form fields. The inspector's notes and the supervisor's notes are merged at
render time. This keeps the no-collab-editor posture while removing the
operational pain. A second lever is a soft lock: when an inspection is open
on a tablet, the supervisor can read but is warned that writes will queue
behind the inspector. A third lever, more invasive, is to relax LWW for
non-overlapping fields. The first lever is the smallest viable change.

---

## 3. An offline visit is bounded, with a return-to-signal point at the end (Assumption A1)

**The assumption.** A tablet leaves signal at building entry and rejoins at
exit (van, parking, lobby). The visit has a known maximum duration. This is
what makes deferred photo upload viable, what makes the auth token TTL
work, and what makes the 24h purge clock line up with "the inspector has
moved on."

**Why it is risky.** Basements vary. Some have no signal at the surface
either, and inspectors only sync at the office or at a known Wi-Fi point
hours later. If the offline window is unbounded:
- Auth tokens can expire mid-visit and block the submit (D4 hard cap is
  sized for "a few hours," not "all day").
- Deferred photo upload piles up across multiple visits, blowing the device
  storage budget (D8) and creating a 24h-purge clock that has already
  elapsed for older inspections.
- The "submitted but photos not yet uploaded" window stretches, and a
  supervisor opening the record sees an empty photo set with no signal that
  data is in transit, which is operationally confusing.
- The audit trail of an inspection can sit on the device for far longer than
  anyone expected, which may itself fail the regulation that motivates the
  24h rule, depending on how it is read.

**What would tell us it is wrong in the pilot.**
- Median time from "first edit offline" to "first successful sync" above a
  few hours.
- Inspectors reporting that they only sync at the office or at home.
- Photo queue depth growing across days on a single device.
- Token-refresh failures or re-auth prompts on submit.

**What the plan would do if it is wrong.** Two adjustments. First, raise
the auth-token offline cap and shift to a re-auth-on-next-online rather
than a hard mid-visit cap. Second, relax the 24h-purge rule to "24h after
the device next comes online and the inspection is accepted," or, if
compliance reads the rule strictly, segment the audit log so non-customer
metadata can stay while customer data is scrubbed. Neither is free. The
cleanest path is to confirm the visit-duration assumption with the pilot
site during Stage 0 and adjust the auth and storage budgets before turning
the pilot on for real.

---

## Why these three and not the others

The other assumptions in §1 are important but their failure modes are
narrower and have well-understood fixes: storage encryption is a swap
(D1), photo timing is a flag (D3), MDM posture is an operations problem
(§9.6), and so on. The three above change the shape of the system if they
are wrong. They are also the ones the brief is silentest on, which is why
they are the most important to validate with the product owner before M0
closes and with the pilot cohort before Stage 1 turns on.
