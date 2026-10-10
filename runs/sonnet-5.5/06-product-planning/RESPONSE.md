# Response: the three riskiest assumptions

`PLAN.md` was written from `BRIEF.md` alone. I did not look at the existing app, APIs, or data, so every statement about how the current system behaves is an assumption. The plan lists sixteen (A1 to A16). These three carry the most risk, because each could invalidate a core design choice and none can be checked from the brief.

## 1. Concurrency premise: integer versions are reliable, and supervisor and inspector edits rarely overlap (A4 and A7)

**What the plan assumes.** The existing integer record version is a single counter per inspection, bumped by every writer (web, mobile, API, batch jobs). Stale writes are rejected atomically. Supervisors mostly edit a small set of fields, such as comments, corrections, and status, that seldom coincide with what an inspector is changing. On that basis, a field-level three-way merge plus an advisory device hold is enough, and no collaborative editor is needed.

**Why it is risky.**
- If any writer path does not bump the version, a stale offline write can silently overwrite a supervisor's edit. That is undetected data loss, and it also corrupts the audit history.
- If versions are coarser or finer than assumed, the merge design changes.
- If overlap is common, conflict resolution stops being an edge case and becomes the product. That directly undercuts the brief's "no full collaborative editor".

**Cheapest early test (M0).**
- Send a deliberately stale write through every writer path and confirm it is rejected.
- Mine existing edit and audit history for supervisor edits made while an inspection was open elsewhere, to estimate the overlap rate.

**If the assumption fails.** Fix or wrap the offending writers before any offline client is enabled (M2). If overlap is high, tighten field ownership (D3) or add per-field locking before the pilot, and revisit whether the scope can stay non-collaborative.

## 2. Purge premise: "accepted" always follows a complete server copy, so the 24-hour rule can be met on offline devices without destroying work (A3 and A13)

**What the plan assumes.** Acceptance is a server event that can only follow a submission the server fully holds. That lets the tablet purge safely when it learns of acceptance. It also lets a local retention cap, counted from the server's stated receipt time, meet the deadline for a device that never hears about acceptance. The plan also assumes compliance accepts purging earlier than 24 hours after acceptance, and that server-side audit history is not "local customer data".

**Why it is risky.** Acceptance is learned by the tablet only when it has contact, and the tablets are the ones that lose contact. The design fails in two ways if the assumption is false.
- If supervisors can accept or reassign an inspection while a tablet holds unsynced work, the regulation and the inspector's evidence collide. Complying means deleting work the server never received.
- If compliance reads the rule more strictly, or requires retention of something we planned to purge, the whole purge design changes.
- Related: the current read-through cache may already retain customer data past the limit (A16). That would be an existing compliance gap that must be escalated, not quietly fixed.

**Cheapest early test (M0).**
- Read the accept code path and the state machine. Confirm whether acceptance requires a submission and whether it is reversible.
- Get compliance's written answer on the deadline-passes-while-offline case (D1).
- Inspect what the legacy cache holds today.

**If the assumption fails.** The plan has a late-work path for unsynced work, and it is the only place that permits deliberate data loss. That tradeoff needs explicit compliance and product sign-off (D1). If acceptance can occur without a full server copy, the server should warn or require a reason at acceptance when a device hold has unsynced work, or block it.

## 3. Evidence premise: offline-captured signatures and device-reported times are acceptable audit-grade evidence (A10 and A11)

**What the plan assumes.** A drawn signature captured offline, bound to a hash of the exact content signed, plus audit events that record both the untrusted device time and the trusted server receive time, satisfy the regulation's audit requirement and whatever legal weight the signature needs. It also assumes that a signed record can be frozen locally and that a later supervisor edit can be handled by marking the signature stale.

**Why it is risky.** The brief says a signature must be collected offline. It does not say whose signature it is, what it attests to, or what evidence regulators or courts require. If the requirement is a trusted timestamp, an identity check, or an on-device witness, the local flow cannot provide it. A tablet clock is user-changeable and cannot be trusted alone. Supervisors editing signed content after the fact is easy to under-specify. A wrong answer would only surface after the pilot has collected signatures that turn out not to be valid.

**Cheapest early test (M0).** Put three concrete questions to legal and compliance before designing the signature schema. Who signs, and what does it attest to? What time and identity evidence must be recorded? Is device-reported time plus server receipt time acceptable? Show them the exact audit record fields proposed in section 12.

**If the assumption fails.** Change the signature schema and possibly the flow: for example, require a server-confirmed time before a signature counts, or require a connectivity check at signing. This is why D6 and D11 are marked as needed before the signature milestone, and before schema work if they change stored fields. Nothing else in the plan depends on the answer, but the pilot must not collect real signatures until it is settled.

## What I could not verify

Everything about the current stack: the mobile platform and framework (A12), the form-builder versioning (A6), whether the server supports idempotency or resumable uploads today (A15), and the actual photo sizes and tablet storage (A9). The plan puts each of these in M0 rather than guessing, and it states no dates, durations, or staffing numbers. Those depend on M0 findings and on team capacity that the brief does not provide.
