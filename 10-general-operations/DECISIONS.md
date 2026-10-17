# Operational Decisions, Contradictions & Open Questions

## 1. Confirmed Decisions
1. **Customer Demo Moved to Thursday `16:00`:** Product's preferred Wednesday `15:00` slot is declined due to hard unavailability on Wednesday `13:00–17:30`. We will use the customer's stated alternate slot on Thursday `16:00`.
2. **Demo Rehearsal Locked for Wednesday `10:00–11:30`:** Sam is unavailable Tuesday and only available Wednesday `10:00–12:00`. Scheduling the 90-minute rehearsal at `10:00–11:30` fits both Sam's window and our Wednesday morning availability (`09:30–13:00`), leaving 30 minutes of buffer before `12:00`.
3. **Security Patch Review Front-Loaded to Monday `11:15–12:45`:** Because QA requires a half day *after* our 60–90 minute review and is unavailable Thursday, completing the review on Monday allows QA to run on Tuesday afternoon or Wednesday. This avoids a risky Friday-only crunch ahead of the Friday `16:00` deployment deadline.
4. **Support Renewal Escalation Prioritized Monday `10:30–11:15`:** Handled immediately after the Monday `10:00` recurring meeting to meet the Monday response deadline. The other two escalations (Wednesday SLAs) are scheduled for Monday `16:45–17:30` and Tuesday `09:30–10:15` so Wednesday morning stays clear for the demo rehearsal.
5. **CEO Strategy Outline Targeted for Tuesday `14:00` Delivery:** Three focused hours are scheduled on Monday afternoon (`13:30–15:00` and `15:15–16:45`) with a 45-minute polish buffer on Tuesday `10:15–11:00` so leadership can review it at the Tuesday `16:00` meeting.
6. **Three-Tier Schedule Protection for Finance Board Numbers:** Primary 2-hour uninterrupted block is set for Tuesday `11:00–13:00` (immediately upon Lina's `11:00` delivery). If the vendor export slips, Contingency Block A (Tuesday `14:00–16:00`) and Contingency Block B (Thursday `10:00–12:00`) are held to guarantee completion before the Thursday `12:00` hard deadline.

---

## 2. Unresolved Contradictions & Risks
1. **Wednesday `15:00` Demo Preference vs. Wednesday `13:00–17:30` Unavailability:**
   - *Contradiction:* Product prefers the customer demo on Wednesday at `15:00`, during our hard out-of-office block (`13:00–17:30`).
   - *Resolution Path:* Move the demo to the customer's pre-approved fallback slot on Thursday `16:00` (or confirm if Product intends to run the live demo without us after Wednesday morning's rehearsal).
2. **Finance Uninterrupted Block vs. Uncertain Vendor Export Timing:**
   - *Risk:* Finance requires two *uninterrupted* hours before Thursday `12:00`, triggered by Lina's corrections (expected Tuesday `11:00`, but contingent on a vendor export whose status won't be known until Monday `15:00`). Because Wednesday afternoon is unavailable and Wednesday morning is occupied by the 90-minute rehearsal with Sam, any delay past Tuesday `14:00` forces the Finance work into Thursday `10:00–12:00`—leaving zero margin before the Thursday `12:00` deadline.
3. **Engineering Patch Sequence vs. QA Thursday Blackout & Wednesday Afternoon Unavailability:**
   - *Risk:* If the patch isn't ready for our review on Monday/Tuesday morning, QA cannot finish their half-day test before Thursday's blackout. Waiting until Friday morning for QA leaves almost no time to fix bugs before the Friday `16:00` deployment deadline.

---

## 3. Questions Assigned by Owner

### To Product ( & Sam)
- **Product:** Given my hard unavailability Wednesday `13:00–17:30`, please confirm you are locking in the customer's alternate demo slot on **Thursday at `16:00`** (or let me know if you only need me for the rehearsal and plan to run Wednesday `15:00` without me).
- **Product & Sam:** Please accept the calendar hold for the 90-minute demo rehearsal on **Wednesday `10:00–11:30`** (within Sam's `10:00–12:00` window), and confirm the demo environment will be staged by Wednesday `09:30`.

### To Lina & Finance
- **Lina:** Please confirm by **Monday `15:00`** whether the vendor export is on track for your Tuesday `11:00` handoff. If it is delayed, what is the latest time corrections will land so I can lock either Tuesday `14:00–16:00` or Thursday `10:00–12:00`?
- **Finance:** I have reserved **Tuesday `11:00–13:00`** (primary) and **Thursday `10:00–12:00`** (final fallback) for the two uninterrupted hours. If we have to use the Thursday `10:00–12:00` fallback, does delivering right at `12:00` satisfy your deadline, or do you need time before `12:00` for final sign-off?

### To Engineering & QA
- **Engineering:** Is the security patch ready for my 90-minute review at **Monday `11:15–12:45`**? Reviewing Monday allows QA to run their half-day test on Tuesday/Wednesday and avoid Thursday's QA blackout.
- **Engineering:** Once QA signs off by Wednesday, can we run the 30-minute deployment change window on **Thursday `13:30–14:00`** (without QA present), or do you prefer **Friday `14:00–14:30`** when QA is back online?

### To Support
- **Support:** Please share the ticket details for the renewal-impacting escalation before **Monday `10:30`** so I can send the response by `11:15`. For the two Wednesday SLA escalations, what time on Wednesday do the SLAs expire? (I have scheduled both for completion by Tuesday `10:15` to stay well ahead of the clock.)

### To CEO
- **CEO:** I have blocked three hours on Monday afternoon to get you the first draft of the strategy outline by **Tuesday `14:00`** ahead of the `16:00` leadership meeting. If Lina's vendor export shifts Tuesday morning's Finance window, is there any flexibility to review the outline Wednesday morning instead, or should Tuesday `14:00` remain hard?
