# RESPONSE — Three riskiest assumptions

Criteria for "riskiest": if the assumption is wrong, the plan's core mechanism
changes, not just a parameter. Ranked by expected cost of being wrong.

## 1. The existing REST API can express per-field preconditions (A3 + D1)

**Assumption:** the server's integer record versions can be extended into a
per-field version map so the device can detect *which* fields diverged from
supervisor edits, and the server can apply disjoint edits without treating
every concurrent change as a conflict.

**Why it's risky:** the entire conflict policy (§5) rests on the server being
able to tell "inspector edited field A, supervisor edited field B" apart from
"both edited field A." If the server only offers whole-record optimistic
concurrency, then *every* supervisor edit made while an inspector is offline
becomes a whole-record conflict and gets funneled into manual reconciliation.
With the brief's stated behavior — supervisors routinely editing the same
inspection from the web — that path could produce a reconciliation queue that
never empties, which fails the "no full collaborative editor" scope constraint
and reintroduces exactly the note-loss friction product is trying to remove.

**Impact if wrong:** conflict volume could rise by an order of magnitude; M5's
reconciliation UX becomes the critical path and the pilot's conflict-rate
target (<10% of inspections) becomes unreachable.

**Validation (cheapest first):** read the inspection PUT handler's change-
detection code and confirm it does (or can be made to do) field-level write
tracking; replay a week of production audit history to measure the real overlap
rate; then decide D1. This is a one-day spike, and it gates M4.

## 2. "Accepted" is reliably observable by the device (A5 + D5)

**Assumption:** acceptance is a discrete server-side state, and the device can
learn of it via sync pull — so the 24-hour removal clock starts from an
authoritative signal rather than the device's last knowledge of the world.

**Why it's risky:** it's a hard regulatory obligation with a hard clock, and the
tablet's operating environment is exactly the one where the signal is least
reliable — basements, intermittent connectivity, MDM reachability uncertain. If
acceptance is only visible to the web app, or observable only through a path the
device can't use, then compliance depends entirely on a purge that runs on a
device that may be offline for the entire 24 hours. "Delete local customer data
within 24 hours after acceptance" is unverifiable in that world — not merely at
risk of a late delete.

**Impact if wrong:** we cannot demonstrate compliance; the mitigation (server-
issued purge receipts, acceptance visible in the assignment payload, and a
bind on the device at first reconnect) becomes mandatory scope, not polish, and
M6 grows. If even that is impossible because acceptance can happen while the
device has no reconcilable state, the product decision may be that inspections
must be accepted only while the device is online, or that the server must orphan-
purge on the device's behalf — a real product change.

**Validation:** confirm with server owners how acceptance is stored and how a
device-visible delta can include it; test the reconnect-accept → purge flow in
the pilot's worst-network site before S2.

## 3. Supervisor and inspector edits rarely touch the same fields (A4)

**Assumption:** field-level overlap between the web supervisor and the offline
inspector is the exception, so auto-merge is the common case and manual
reconciliation is rare.

**Why it's risky:** this is the one assumption that is planned around but backed
by no evidence in the brief. It quietly sets the size of the conflict UX (M5),
the shape of the universe conflict counts must stay under (10% per S1's gate),
and whether D2's "manual only for overlap" choice is survivable. It is also the
assumption most likely to change over time as the product matures — a new
supervisor workflow (e.g., supervisors pre-filling findings or appending review
notes to the same free-text fields) could push overlap up after we ship.

**Impact if wrong:** the design doesn't break, but the *operating cost* does:
conflict-resolution backlog becomes a real support load, inspectors get nagged
during already-bad connections, and the pilot likely fails its S1 gate on a
metric that was never grounded.

**Validation:** (a) before M4, mine existing audit history for web-vs-mobile
field co-edit rates on the same inspection; (b) during the pilot, instrument the
overlap rate (§5's divergence classification) as a first-class metric, and
pre-agree with product what overlap rate triggers escalating to D2 option (c) or
restricting supervisor edit surface on active inspections; (c) in the interim,
server-side guardrail: when an inspection has unsynced device work, surface a
soft warning in the web UI before a supervisor saves into the same field.

**Cross-cutting note:** A4 and A1 are also the two assumptions where being
wrong changes data-retention math (purge scope) and shared-device semantics.
They're listed here rather than in the top three only because a failure is
visible early in the pilot, whereas 1 and 2 can be invisible until rollout or an
audit.
