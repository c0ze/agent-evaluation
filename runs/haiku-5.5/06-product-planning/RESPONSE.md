# Three riskiest assumptions

These are the assumptions where being wrong changes the architecture or the product, and where the brief says nothing. The full register is in `PLAN.md` §2.

## 1. A1: The existing record version can serve as a reliable merge base and audit trail

**Why it's risky.** The merge design depends on every write path (web app, REST API, batch imports, admin scripts) incrementing the record version and logging field-level changes in the same transaction. If any path skips this, two things go wrong silently. Concurrent edits are not detected, so values are overwritten. The audit trail gets gaps. Both failures look like normal operation.

**Cheapest test.** Inventory every writer to the inspection tables. Then run a concurrent-update test against the current API: two clients hold the same version, and the second write should get a 409.

**If wrong.** M1 grows from routing writes through change logging into a write-path refactor. That changes the pilot scope and the order of work. No sync implementation should start until this is answered.

## 2. A2: Purging at server-confirmed submission satisfies the 24-hour-after-acceptance rule

**Why it's risky.** The regulatory duty is keyed to acceptance, a server event that a basement device may not see for days. Purge-at-submission is the only offline-safe design I found. It is also an interpretation of the regulation, not a fact the brief states. The residual case, where the submit acknowledgment is lost and the device stays offline past acceptance, is not zero risk.

**Cheapest test.** Get a written compliance opinion on the purge trigger and on the residual case before M0 closes.

**If wrong.** The device must keep data until acceptance. That forces either work gated on connectivity or a remote wipe at the deadline, which destroys unsynced drafts. Either choice changes the product flow, not just the code.

## 3. A5: Same-field conflicts are rare enough for field-level merge with held proposals

**Why it's risky.** Supervisors edit from the web while inspectors are offline, and offline windows can be long. If supervisors routinely touch fields the inspector is working on, held proposals will be frequent. Submission will be blocked often, and inspectors will feel it immediately. The design avoids locks and co-editing, so it depends on this rate being low.

**Cheapest test.** Interview supervisors about when and what they edit on in-progress inspections. Where server-side edit history exists, measure how often web edits touch in-progress inspections. Confirm the held-proposal rate in pilot telemetry.

**If wrong.** The options are section ownership (supervisors edit only sections the inspector is not working in), read-only supervisor access to in-progress inspections, or time-limited supervisor locks. Each is a product decision, and the choice should be made before M4 begins.
