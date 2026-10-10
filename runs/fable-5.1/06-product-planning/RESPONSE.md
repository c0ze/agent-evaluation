# RESPONSE — The three riskiest assumptions behind PLAN.md

`PLAN.md` labels every assumption (A#) and every pre-implementation decision
(D#). The three below carry the most risk because each one is load-bearing for
the whole design, each is unverified from the brief alone, and each would be
expensive to discover late. All three are scheduled for verification in M0
before any dependent milestone starts.

## 1. The integer record version is a real concurrency token (A3, feeds D1)

**What is assumed.** The version increments on every committed write to a
record, is returned on every read, and the server rejects writes with a stale
version, or can be changed to do so without breaking existing clients.

**Why it is risky.** The brief says only "REST with integer record versions".
That could mean an enforced optimistic-concurrency token, or an informational
counter that batch jobs bump, or a value that is not checked on write at all.
The entire merge design (§6.8, §7) uses the version as the base for deciding
which side changed a field. If the version is unreliable, the merge will
sometimes treat a supervisor's edit as unchanged and overwrite it without a
flag, or treat unchanged data as conflicting. That is silent data loss, which
is exactly the failure this programme exists to remove.

**How to de-risk.** In M0, read the server code paths that write inspections
(not the API docs) and produce a short report: where the version is incremented,
whether the check is enforced, and which write paths (web, batch, integrations)
bypass it. If enforcement is missing, it becomes the first task in M1 and the
plan already provides for a 409-impact report before it is switched on.

## 2. Supervisors rarely edit form content on in-progress inspections, so "inspector wins, supervisor is flagged" is acceptable (A7, D2)

**What is assumed.** Supervisor web edits during an inspection are mostly
workflow (reassign, reschedule, cancel, comment). Form answers are the
inspector's domain, so the policy applies the inspector's offline value and
records the supervisor's as overridden with a review flag.

**Why it is risky.** The brief rules out a collaborative editor, which forces a
policy-based merge. A policy is only acceptable if the losing side is rare and
the flag is actionable. If supervisors routinely correct answers on
in-progress inspections (for example fixing obvious errors during a quality
check while the inspector is still on site), the pilot will produce a stream of
`review_required` flags, supervisors will feel their work is being undone, and
the pressure will be to build the merge UI that product explicitly does not
want, or to flip the policy so the supervisor wins, which discards on-site
evidence. Either outcome changes the client, the server and the web scope.

**How to de-risk.** In M0, measure from server logs how often supervisor edits
touch form-answer fields on inspections in an in-progress state, and which
fields. If the rate is material, the cheap mitigation is on the web side: lock
inspector-owned fields while an inspection is in progress, or route corrections
through supervisor amendments (already designed for post-signature edits, D7).
Both keep the tablet free of merge dialogs. The pilot exit criteria (§12)
explicitly include supervisor judgement of flag volume.

## 3. Acceptance is a server-side event that can only follow complete receipt, and purging at submission confirmation is acceptable to the business (A5, A6, D3)

**What is assumed.** "Accepted" is a status transition made on the server,
with a server timestamp, and cannot happen before the server holds the full
submission including every attachment and the signature. The plan recommends
purging local customer data as soon as the server confirms complete receipt,
which is strictly earlier than acceptance and therefore always inside the
24-hour window.

**Why it is risky.** The regulatory clause is the one requirement in the brief
with an external penalty. A device in a basement, or powered off in a van, does
not learn that an inspection was accepted. Any design that waits for the
acceptance signal before purging can miss the 24-hour window through no fault
of the app. The recommended design avoids this entirely, but it depends on
acceptance never preceding complete receipt (otherwise the purge could happen
after the clock starts and while the device is offline), and it costs
inspectors the ability to review a submitted inspection offline. If product or
inspectors reject that trade, the fallback (D3 option b: purge on acceptance
signal with a timer from submission confirmation) reopens the offline-device
gap and turns a by-construction guarantee into an operational one that needs
server-side tracking and MDM backstops to be credible.

**How to de-risk.** In M0, confirm from server code whether acceptance can be
automated or applied to a partial submission, and get a written definition of
"customer data" from legal so the stub that remains on the device is agreed in
advance. Run the purge-timing scenarios from §14 (device offline for longer than
24 hours after submitting, device powered off, app force-stopped) in M5 under
both D3 options so the decision is made on evidence. Keep the server-side
"past `purge_after` without confirmation" alert regardless of the option
chosen; it is the only signal that reaches someone who can act.

## Runners-up

Two further assumptions would hurt but are cheaper to recover from: A1
(assignments reach the device before signal is lost; if not, prefetch cannot
help and the product needs an out-of-band path) and A9 with D4 (compressed
photos are acceptable evidence; if not, storage and drain time on intermittent
links rise several-fold but the pipeline is unchanged).
