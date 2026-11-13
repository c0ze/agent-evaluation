# Response: the three riskiest assumptions

`PLAN.md` is written from `BRIEF.md` alone. It lists eleven assumptions. These three carry the most risk because the core design rests on them and the brief does not settle any of them. All three are checked in milestone M0, before any build work.

## 1. "Accepted" means supervisor acceptance on the server (A1)

**What the plan assumes.** The 24-hour clock starts when a supervisor accepts a submitted inspection on the server. Deleting the encryption key and files counts as removal. Supervisors can tolerate the Accept button being disabled while a tablet still holds a copy.

**Why it is risky.** The brief says only "after an inspection is accepted". It could equally mean the customer signing on the tablet. The plan's whole removal guarantee is built on the server refusing acceptance until the tablet's time-limited checkout has ended, so the tablet can meet the deadline without being reachable.

**If it is wrong.** The clock would start on the tablet, at signature. Unsynced work would have to be deleted within 24 hours whether or not it uploaded, and the accept gate would be pointless. Sections 5.1 and 8.2 would be redesigned.

**How to check.** A written ruling from compliance (decision D1), including the one gap the design cannot close: a powered-off tablet removes its data at next start, not at the deadline.

## 2. Tablets reconnect about daily, for long enough, with trustworthy clocks (A2)

**What the plan assumes.** A tablet reaches usable signal at least once per working day and holds it long enough to upload one inspection's photos. Inspectors cannot change the tablet clock.

**Why it is risky.** The brief says connectivity "may return intermittently" and gives no durations or photo sizes. The removal rule runs on the tablet's own clock.

**If it is wrong.** Checkouts end with work still on the tablet, and the plan then deletes that work to stay compliant (decision D2). That recreates the data loss the project exists to fix. A slow or rewound clock would delay removal instead.

**How to check.** Measure real offline stretches and photo sizes with pilot inspectors, and test upload on pilot hardware in a real basement. Those numbers set checkout length (D3) and photo compression (D7).

## 3. The server can be extended, and its versions behave as expected (A3)

**What the plan assumes.** The server team can add a mutation endpoint, checkouts, an acceptance rule and richer audit events. Record versions are per inspection and existing audit data is per field.

**Why it is risky.** The brief says only "REST with integer record versions". Field-level merging, safe retries and the accept gate all need server changes.

**If it is wrong.** The fallback is whole-record writes with merging on the tablet (decision D4). Conflicts become coarser, retries can double-apply, audit detail is weaker, and without the accept gate the removal guarantee in assumption 1 no longer holds.

**How to check.** A short review of the current API and audit schema with the server team.
