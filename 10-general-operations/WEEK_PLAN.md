# Week Plan — Monday to Friday

Working hours: 09:30–17:30, Mon–Fri. **Wednesday 13:00–17:30 is unavailable** (Wednesday is a 3.5-hour day).
Constraints I applied every day: at least 45 min lunch, no more than 4 h of meetings.

## 1. Deadlines: hard vs. preferred

| Item | Type | When | Source |
|---|---|---|---|
| Board numbers final | **Hard** | Thu 12:00 | Finance |
| Security patch deployed | **Hard** | Fri 16:00 | Engineering |
| Renewal-risk escalation response | **Hard** (same-day) | Mon, time not stated → aim for before lunch | Support |
| Two other escalations | **Hard** (SLA) | Wed, SLA time not stated → finish Tue | Support |
| Strategy outline to CEO | Preference ("early this week") + one real cutoff: **send by Tue 14:00** to get it reviewed at Tue 16:00 leadership | Target Mon end of day | CEO |
| Customer demo | Preference Wed 15:00; alternative Thu 16:00 | **Not decided** (see DECISIONS.md, D1) | Product |
| Demo rehearsal (90 min, Sam must join) | Hard prerequisite of the demo | Wed 10:00–11:30 (Sam's only stated window) | Product / Sam |

## 2. Dependency chains

```
Security:  My review (60–90 min, Mon) -> QA half day (not Thu; QA hours otherwise unconfirmed)
           -> 30-min change window -> deployed by Fri 16:00
Board:     Vendor export -> Lina corrections (Tue by 11:00; she knows about delays by Mon 15:00)
           -> 2 uninterrupted hours of my time -> final by Thu 12:00
Demo:      Rehearsal with Sam (Wed 10:00-11:30) -> demo (Wed 15:00 or Thu 16:00)
CEO:       3 focused hours of drafting -> send by Tue 14:00 -> leadership review Tue 16:00
```

The security chain is the longest and has a gap in the middle (QA is out Thursday), so it starts first. If QA finds a problem after Wednesday, the only QA day left is Friday.

## 3. Day-by-day

### Monday — start the long chains, clear the renewal escalation
| Time | Block | Notes |
|---|---|---|
| 09:30–10:00 | Send team alignment message (DRAFT_REPLY.md); acknowledge the renewal-risk customer | Starts the decisions early |
| 10:00–10:30 | Recurring meeting | |
| 10:30–12:00 | **Focus: security patch review** (60–90 min) | Hand to QA as soon as done; unused time becomes buffer |
| 12:00–12:45 | Renewal-risk escalation response | Due today; sent before lunch |
| 12:45–13:30 | Lunch | |
| 13:30–16:30 | **Focus: CEO strategy outline first draft (3 h)** | Notifications off. Lina's 15:00 export status gets read at 16:30 |
| 16:30–17:00 | Read Lina's update, pick the Board plan (see Contingency A); confirm the demo decision with Product | |
| 17:00–17:30 | Reread and send the outline to the CEO (well before the Tue 14:00 cutoff) | If it isn't ready, finish it Tue 13:45–14:00 at the latest |

Meetings: 0.5 h. Focus: 4.5 h.

### Tuesday — Board numbers and the Wednesday-SLA escalations
| Time | Block | Notes |
|---|---|---|
| 09:30–10:15 | Escalation #2 (Wed SLA) | Done a day early because the Wed SLA time is unknown and Wed is short |
| 10:15–11:00 | Escalation #3 (Wed SLA) | |
| 11:00–13:00 | **Protected: Board numbers (2 uninterrupted hours)** | Starts when Lina's corrections arrive (due by 11:00) |
| 13:00–13:45 | Lunch | |
| 13:45–16:00 | **Contingency** | Takes the Board block if corrections are late (Contingency A), QA questions, change window if Engineering needs me there, any outline edits |
| 16:00–17:00 | Leadership meeting (reviews the CEO outline) | |
| 17:00–17:30 | Wrap-up; prep for the rehearsal | |

Meetings: 1 h.

### Wednesday — half day (09:30–13:00)
| Time | Block | Notes |
|---|---|---|
| 09:30–10:00 | Check the demo environment before rehearsal | |
| 10:00–11:30 | **Demo rehearsal with Sam (90 min)** | Sam's stated window is 10:00–12:00 |
| 11:30–12:00 | Rehearsal overrun / fixes | Still inside Sam's window |
| 12:00–12:15 | Hand demo notes to Product; check security QA status | |
| 12:15–13:00 | Lunch | |
| 13:00–17:30 | **Unavailable** | I can't attend a 15:00 demo today |

Meetings: 1.5 h. Both Wednesday-SLA escalations are already done (Tuesday).

### Thursday — Board deadline, possible demo
| Time | Block | Notes |
|---|---|---|
| 09:30–10:00 | Recurring meeting | Skip it only if Contingency A applies |
| 10:00–11:30 | Board: final check and sign-off with Finance | If Tuesday went to plan this takes ~30 min and the rest turns into buffer |
| 11:30–12:00 | Buffer before the **12:00 hard deadline** | |
| 12:00–12:45 | Lunch | |
| 12:45–15:00 | Focus: work in leadership feedback on the outline; catch-up | |
| 15:00–16:00 | Demo prep (if the demo is Thu) / otherwise contingency | |
| 16:00–17:30 | Customer demo (if moved to Thu; length not yet confirmed) / otherwise contingency | |

Meetings: 0.5 h, plus the demo if it happens today (up to 2 h, well under the cap).

### Friday — security deadline buffer
| Time | Block | Notes |
|---|---|---|
| 09:30–10:00 | Security status check | If the patch already shipped, the morning is free focus time |
| 10:00–12:30 | **Contingency: security** | Re-review of fixes if QA found issues; support a Friday QA re-run |
| 12:30–13:15 | Lunch | |
| 13:15–15:00 | Contingency | **Latest acceptable change window: 14:30–15:00**, which leaves an hour before the 16:00 deadline for verification or rollback |
| 15:00–16:30 | Catch-up / follow-ups from the demo and escalations | |
| 16:30–17:30 | Weekly wrap-up; plan next week | |

## 4. Contingency plans

**A. Vendor export is late (known Mon 15:00).**
- Ask Lina on Monday for a new ETA for the corrections.
- Corrections arrive by ~13:45 Tue: move the Board block to Tue 13:45–15:45. Nothing else changes.
- Corrections arrive later Tue or Wed: Wednesday gives only 1.5 h in one piece (11:30–13:00), not 2. The next real 2-hour slot is **Thu 09:30–11:30**, and it only works if I skip the Thursday recurring meeting. That leaves 30 min before the deadline. Thu 10:00–12:00 leaves zero margin, so I won't plan on it.
- Raise this with Finance on **Monday**, not Thursday (DECISIONS.md, Q3).

**B. Security QA finds a problem.**
- A fix plus my re-review, then a QA re-run on Wed or Fri (QA is out Thu). A Friday re-run needs QA to start by about 09:30–10:00 for the change window to happen by 14:30.
- If the Friday path looks at risk by Wednesday midday, escalate to Engineering right away.

**C. Demo.**
- If I have to attend, it must be Thu 16:00. Rehearsal stays Wed 10:00 either way.
- If Sam's Wednesday slot falls through, we have no confirmed rehearsal window with him. His availability on Mon, Thu and Fri is unknown, so we ask him (Q6) rather than assume.

**Unplanned time on purpose:** Tue 13:45–16:00, Thu afternoon (if no demo), and most of Friday. That's about 7 hours of buffer across the week, placed right before each hard deadline.

## 5. What I have not assumed
- QA's hours on Mon/Tue/Wed/Fri. We only know QA is out Thursday.
- Sam's availability beyond "not Tuesday" and "Wed 10:00–12:00".
- Whether I (or Sam) need to be at the customer demo, and how long the demo runs.
- The exact Monday deadline for the renewal response and the Wednesday SLA times.
- Whether the change window needs me present.
