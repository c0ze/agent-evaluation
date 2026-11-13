# Decisions, Contradictions & Open Questions

## 1. Confirmed Decisions (Within Stated Constraints)

1. **Reject Wednesday `15:00` Customer Demo; Target Thursday `16:00`:**
   - You are unavailable Wednesday `13:00–17:30`. Wednesday `15:00` is only Product's preference, whereas the customer is already confirmed available Thursday `16:00` (inside your `09:30–17:30` hours). *(Only exception: if Product confirms your live attendance at the customer demo is unnecessary.)*
2. **Lock Demo Rehearsal Inside Sam's Wednesday `10:00–12:00` Window (Target `10:00–11:30`):**
   - Sam is unavailable Tuesday and only confirmed for Wednesday `10:00–12:00`. Scheduling `10:00–11:30` satisfies the 90-minute requirement and keeps `11:30–13:00` contiguous rather than splitting the morning into two 60-minute fragments.
3. **Draft the CEO Strategy Outline on Monday (`12:45–15:45`, 3 Focused Hours):**
   - Keeps Tuesday free for Lina's `11:00` corrections (2 uninterrupted hours) and Security Patch review while still hitting the optional Tuesday `14:00` send cutoff for the `16:00` leadership meeting.
4. **Resolve Renewal Escalation Monday Morning (`10:30–11:15`) & Clear Wednesday-SLA Escalations Early (Mon/Tue):**
   - Protects the Monday renewal deadline early in the day and prevents Wednesday's 3.5-hour morning from carrying 90 minutes of hard-SLA exposure alongside Sam's rehearsal.
5. **Hold Tuesday `11:00–13:00` Uninterrupted for Board Numbers & Use Monday `15:00` as the Escalation Trigger:**
   - Targets completion ~47 hours before Thursday `12:00`, leaving Thursday `10:00–12:00` strictly as an emergency fallback rather than the primary plan.
6. **Target Monday Afternoon or Tuesday `09:30–11:00` for Security Patch Review (60–90 min):**
   - Enables QA to complete its half-day pass on Tuesday or Wednesday (before QA's Thursday outage) and targets a Friday morning (`10:00–10:30`) change window with 5.5 hours of pre-`16:00` buffer.
7. **Enforce Personal Preferences Across All Five Days:**
   - Daily meeting load stays at `0.5h–2.0h` (well below the `4h/day` cap), and `45 minutes` for lunch is preserved on Monday, Tuesday, Thursday, and Friday (plus `12:15–13:00` or post-`13:00` on Wednesday).

---

## 2. Unresolved Contradictions, Ambiguities & Schedule Traps

1. **Product Demo Preference (`Wed 15:00`) vs. Your Unavailability (`Wed 13:00–17:30`) + Missing Demo Parameters:**
   - **Contradiction:** Product prefers `Wed 15:00`, which directly violates your blocked Wednesday afternoon.
   - **Missing details:** Duration of the customer demo is unstated (if `Thu 16:00` exceeds `90` minutes, it exceeds your `17:30` working day), whether your attendance at the live call is mandatory, who owns demo-environment setup prior to `Wed 10:00`, and who fixes rehearsal bugs on Wednesday afternoon while you are out.
2. **Board Numbers Contingency Trap (`Mon 15:00` Export Check vs. Zero 2-Hour Slots on Wednesday):**
   - **Gap:** Lina will know by `Mon 15:00` if the vendor export is late, **but the notes do not state how late corrections would arrive**.
   - **Structural trap:** If corrections arrive after **Tuesday `14:00`**, Tuesday has no 2-hour uninterrupted slot left before the `16:00–17:00` recurring meeting. On Wednesday (`09:30–13:00`), Sam's 90-minute rehearsal inside `10:00–12:00` eliminates **every** uninterrupted 2-hour block. That forces Board numbers into **Thursday `10:00–12:00`** (right after the `09:30–10:00` recurring meeting), ending at the exact **`12:00` hard deadline** with zero margin for error or Finance sign-off.
   - **Ambiguity:** Unclear whether "Need two uninterrupted hours" is solo work by you or joint time with Finance, and whether Finance needs additional review/approval time *before* `Thu 12:00` after your 2-hour block ends.
3. **Security Patch Readiness Gap vs. QA Thursday Outage:**
   - **Gap:** Engineering specifies the `Fri 16:00` deploy deadline, `60–90 min` review, `half-day` QA, `30-min` change window, and QA's **Thursday unavailability**—but **does not state when the patch will be ready for your review**.
   - **Risk:** If the patch is not ready until Wednesday afternoon or Thursday, QA is pushed to Friday morning (`09:30–13:30`), compressing deployment into `Fri 14:15–15:30` with virtually no time for bug fixes or re-QA before `16:00`. Also unclear if QA needs you online during Wednesday afternoon QA (when you are unavailable) or if you must attend the 30-minute change window.
4. **Tuesday `16:00` Calendar Overlap Ambiguity:**
   - **Ambiguity:** Notes list both a recurring meeting (`Tue 16:00–17:00`) and a `"Tuesday 16:00 leadership meeting"` that can review the CEO strategy outline if sent by `14:00`. If these are two separate meetings, Tuesday `16:00` is double-booked.
5. **Support Escalation Cutoff Times & Format:**
   - **Gap:** Exact deadline hours are omitted for Monday's renewal escalation and the two Wednesday SLAs. Because you are unavailable Wednesday `13:00–17:30`, any Wednesday SLA left to Wednesday risks missing a mid-day or afternoon cutoff unless resolved Monday/Tuesday. Also unconfirmed whether responses are async written replies or live calls (which affect daily meeting load).
6. **Sam's Availability Outside Wednesday `10:00–12:00`:**
   - **Gap:** Notes state Sam is unavailable Tuesday and can rehearse Wednesday `10:00–12:00`, leaving Monday and Thursday morning unstated. No Sam availability is assumed outside `Wed 10:00–12:00`.
7. **Wednesday Lunch Interpretation:**
   - **Minor ambiguity:** You leave at `13:00` Wednesday (`13:00–17:30` unavailable). Unclear whether `45m` lunch happens *after* `13:00` or must be reserved *before* `13:00` (`12:15–13:00`). Both are accommodated in `WEEK_PLAN.md`.

---

## 3. Open Questions Assigned to the Right Person

| Owner | Question / Decision Needed | Why It Matters | Needed By |
|---|---|---|---|
| **Lina** | 1. At Monday `15:00`, if the vendor export is late, what is the exact revised ETA for corrections?<br>2. If on track, can corrections arrive early enough Tuesday morning to protect `11:00–13:00`? | Any ETA past Tue `14:00` eliminates Tuesday/Wednesday 2h slots and triggers Thursday-morning emergency contingency. | **Mon `15:00`** |
| **Finance** | 1. Does `"final by Thursday 12:00"` mean my 2-hour block completes finalization, or do you need review/sign-off time *after* my 2 hours and *before* `12:00`?<br>2. Is the 2-hour block solo work for me or a joint session with Finance? | Determines whether Thursday `10:00–12:00` is even viable as a fallback if Lina's export slips. | **Mon `16:00`** |
| **Product** | 1. Confirm **Thursday `16:00`** with the customer and drop Wednesday `15:00` (I am unavailable `13:00–17:30`)—or confirm I don't need to attend the live demo.<br>2. Confirm expected duration of the Thursday `16:00` demo (must finish by `17:30`).<br>3. Confirm who prepares the demo environment before `Wed 10:00` and owns any post-rehearsal fixes Wed afternoon. | Resolves hard calendar conflict and avoids demo overruns or unowned Wed-afternoon fixes. | **Mon EOD** |
| **Sam** | 1. Confirm **`Wed 10:00–11:30`** for the 90-minute rehearsal.<br>2. Backup only: if Lina's export slips and forces Board numbers into Wed morning, do you have any Monday or Thursday morning availability? | Locks rehearsal without fracturing Wed morning and identifies backup capacity only if Finance slips. | **Tue `12:00`** *(backup Mon `16:00` if Lina slips)* |
| **Engineering (& QA)** | 1. When will the security patch be ready for my `60–90m` review? *(Target: Mon afternoon or Tue morning.)*<br>2. Does QA need me online during their half-day pass (esp. Wed afternoon), and what is the defect/re-test buffer plan before `Fri 16:00`?<br>3. Do I need to join the 30-min change window, and can we target `Fri 10:00–10:30` once QA passes? | Missing Tue/early-Wed review pushes QA to Friday morning with near-zero hotfix buffer before `Fri 16:00`. | **Mon `12:00`** |
| **CEO / Meeting Organizer** | 1. Confirm that the recurring `Tue 16:00–17:00` meeting *is* the leadership meeting that will review the strategy outline.<br>2. Confirm expected depth for the "useful first draft" (`3h` scope). | Prevents a `Tue 16:00` double-booking and calibrates Monday's 3-hour draft scope. | **Mon `12:00`** |
| **Support** | 1. What are the exact SLA cutoff hours for Monday's renewal escalation and the two Wednesday escalations?<br>2. Are all three async written responses or do any require customer calls? | Ensures no Wed-afternoon SLA breaches during unavailability and keeps daily meeting cap accurate. | **Mon `10:30`** |
