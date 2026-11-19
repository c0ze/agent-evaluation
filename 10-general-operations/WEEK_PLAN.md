# Week Plan — Monday–Friday

## Fixed constraints (not negotiable in this plan)

| Constraint | Effect |
|---|---|
| Working hours 09:30–17:30, Mon–Fri | 8 h/day nominal; 45 min lunch inside it |
| Wednesday 13:00–17:30 unavailable | Wednesday is a 3 h work day (09:30–12:15 after lunch); nothing can be scheduled Wednesday afternoon |
| Lunch ≥ 45 min, meetings ≤ 4 h/day | Enforced below; meeting load peaks at 1.5 h (Wed, Thu) |
| Sam unavailable Tuesday; rehearsal window Wed 10:00–12:00 | Rehearsal fixed at Wed 10:00–11:30 |
| QA unavailable Thursday | QA must run Tuesday or Wednesday |

## Deadline register

**Hard**
1. Board numbers final — **Thursday 12:00** (external commitment; Finance cannot slip it).
2. Security patch deployed — **Friday 16:00** (Engineering commitment; security exposure).
3. Renewal-affecting escalation answered — **Monday** (Support commitment; revenue).
4. Remaining two escalations — **Wednesday SLA** each.

**Soft / preference**
5. Customer demo — *preferred* Wednesday 15:00; acceptable Thursday 16:00.
6. CEO strategy outline — "early this week"; Tuesday 16:00 review only if sent by 14:00.
7. Finance's "two uninterrupted hours" — a requirement on the work, not a calendar slot; it must fall after Lina's corrections.

## Dependency chains

```
Lina corrections (Tue ≤11:00, or flag Mon 15:00)
        └─> 2 h uninterrupted finance work
                └─> board numbers FINAL by Thu 12:00

Patch review (me, 60–90 min)
        └─> QA half day
                └─> 30-min change window
                        └─> deploy by Fri 16:00

Sam + 90-min rehearsal (Wed 10:00–11:30)
        └─> customer demo (Thu 16:00)
```

Each chain has one upstream gate I do not control (Lina, QA, Sam). The plan puts my own step early in every chain and keeps the fragile tail in buffer.

---

## Monday — clear the time-critical and unblock the chains

| Time | Item | Why here |
|---|---|---|
| 09:30–10:00 | Triage; confirm Lina 15:45 checkpoint | Cheap, sets the week's risk flag |
| 10:00–10:30 | Recurring meeting | Fixed |
| 10:30–11:15 | **Escalation #1 (renewals)** — draft + send response | Only item with a Monday commitment |
| 11:15–12:00 | Contingency / carry-over | Protects the 3 h block below |
| 12:00–12:45 | Lunch | — |
| 12:45–15:45 | **CEO strategy outline — 3 h focused, no interruptions** | Must exist before Tuesday morning; Tuesday has no room for 3 h |
| 15:45–16:00 | **Lina checkpoint** (vendor export on time?) | The one fact that decides Tuesday's shape |
| 16:00–17:30 | **Security patch review (90 min)** | Starts the QA→deploy chain immediately; QA can then run Tuesday |

Meetings: 45 min (recurring + checkpoint). Focus blocks: 3 h + 1.5 h. Contingency: 45 min.

## Tuesday — finance block, ship the outline, close escalations

| Time | Item | Why here |
|---|---|---|
| 09:30–10:00 | Final read + **send strategy outline** to leadership | Beats the 14:00 cutoff with hours to spare |
| 10:00–10:45 | Escalation #3 | Uses the gap before Lina's material lands |
| 10:45–11:00 | Confirm Lina's corrections actually arrived | Go/no-go for the next block |
| 11:00–13:00 | **Finance: 2 h uninterrupted**, Lina's corrections applied | Directly after delivery, as Finance asked |
| 13:00–13:45 | Lunch | — |
| 13:45–16:00 | Buffer — finance overflow, escalation #2, demo logistics | This is the week's main contingency reservoir |
| 16:00–17:00 | Leadership meeting (strategy review) | Fixed |
| 17:00–17:30 | Notes, adjust Wednesday | — |

Meetings: 60 min. Focus: 2 h finance + 1.5 h buffer.

Note: escalation #2 is deliberately left in Tuesday's buffer. It has a Wednesday SLA, so it can absorb a slip without breaching anything.

## Wednesday — rehearsal, short day, no afternoon

| Time | Item | Why here |
|---|---|---|
| 09:30–10:00 | Prep rehearsal; check demo environment is live | Rehearsal is only 90 min; no time to fix surprises |
| 10:00–11:30 | **Demo rehearsal with Sam** (90 min) | Sam's only window |
| 11:30–12:15 | Escalation #2 or #3 (whichever is still open) | Meets the Wednesday SLA |
| 12:15–13:00 | Lunch | Ends exactly at the 13:00 unavailability boundary |

Meetings/collaboration: 90 min. Focus: 1.5 h. **Nothing after 13:00** — the plan does not pretend otherwise.

## Thursday — the hard 12:00 deadline, then the demo

| Time | Item | Why here |
|---|---|---|
| 09:30–10:00 | Recurring meeting | Fixed |
| 10:00–12:00 | **Board numbers: final checks, sign-off, submit** | Holds the full margin before the 12:00 hard deadline |
| 12:00–12:45 | Lunch | — |
| 12:45–14:30 | Open focus — strategy feedback, follow-ups | Absorbs anything Monday/Tuesday deferred |
| 14:30–15:30 | Demo final pass; confirm attendees and environment | — |
| 15:30–16:00 | Setup / settle before the customer joins | — |
| 16:00–17:00 | **Customer demo** (duration assumed 60 min — confirm) | The workable of the two offered slots |
| 17:00–17:30 | Notes, capture customer follow-ups | — |

Meetings: 90 min. Thursday morning is deliberately not used for the patch change window, so a late Lina export can still be absorbed before 12:00.

## Friday — deploy, then hold the buffer

| Time | Item | Why here |
|---|---|---|
| 09:30–10:00 | **Security change window — deploy** | Leaves 6 h to 16:00 instead of deploying at the deadline |
| 10:00–12:00 | Monitoring + open work | Watches the deploy while there is still time to roll back |
| 12:00–12:45 | Lunch | — |
| 12:45–16:00 | Contingency — patch issues, overflow, loose ends | Reserved; not planned work |
| 16:00 | **Hard checkpoint: patch confirmed deployed** | — |
| 16:00–17:30 | Week close, next-week prep | — |

Meetings: 30 min. Contingency: 3 h 15 min.

---

## Meeting-load check

| Day | Meetings / collaborative time | Limit 4 h |
|---|---|---|
| Mon | 45 min | OK |
| Tue | 75 min (incl. Lina check) | OK |
| Wed | 90 min rehearsal | OK |
| Thu | 90 min | OK |
| Fri | 30 min | OK |

Lunch is ≥45 min every day. Wednesday's lunch ends at 13:00 with zero slack — if the rehearsal overruns, lunch is what gets squeezed, not the afternoon (which cannot move).

## Contingency triggers

| Trigger | Response |
|---|---|
| **Lina says Monday 15:45 that the export is late** | Move the finance block to Tue 13:45–15:45 and tell Finance Monday evening. Thursday 12:00 still holds if corrections arrive Tuesday. |
| **Corrections not received by Tuesday 15:00** | Escalate to Finance same day: Thursday 12:00 becomes at risk because Wednesday afternoon is unavailable and Thursday morning holds only 2 h. Do not absorb this silently. |
| **Patch review runs past 17:30 Monday** | Finish Tuesday 09:30–10:00 (before the outline send); QA still starts Tuesday afternoon. Change window stays Friday. |
| **QA cannot complete Tuesday** | Move QA to Wednesday morning (QA's availability, not mine); keep the Friday change window. |
| **Demo cannot move off Wednesday 15:00** | I cannot attend — Wednesday 13:00–17:30 is unavailable. Ask Product to either take Thursday 16:00 or nominate someone else to present; do not accept a slot I cannot staff. |
| **Rehearsal reveals environment problems Wednesday** | Escalate to Product/Eng Wednesday before 13:00; Thursday 14:30–15:30 is the only remaining fix window. |

## What this plan refuses to do

- It does not schedule anything Wednesday afternoon.
- It does not assume I can be in two places at once (the Wednesday 15:00 demo is the obvious trap).
- It does not treat "early this week" as a date, or the Wednesday demo preference as a commitment.
- It does not book the patch change window so late that a failure has no recovery time.
