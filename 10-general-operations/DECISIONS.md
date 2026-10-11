# Decisions

## Confirmed decisions (made by me, low-risk)

1. **Renewals escalation answered Monday** (Mon 10:30–11:15). Revenue impact
   and an explicit "needs a response Monday" make this the week's first hard
   commitment.
2. **Security patch review on Tuesday 09:30–11:00**, not later. Reasoning: QA
   needs a half day after my review and is unavailable Thursday; QA on
   Wednesday leaves Thursday for the change window and Friday as a full
   buffer before the hard 16:00 deadline. Reviewing Monday was considered but
   Monday is already at capacity, and Tuesday still preserves the safe chain.
3. **Strategy outline drafted Monday, sent Monday EOD.** This satisfies the
   CEO's "early this week" and comfortably beats the Tue 14:00 cutoff so the
   16:00 leadership meeting can review it.
4. **Escalations #2 and #3 done Tuesday afternoon** — ahead of their Wednesday
   SLAs, which frees my limited Wednesday morning for the rehearsal.
5. **Finance 2h uninterrupted block Tue 11:00–13:00**, directly after Lina's
   corrections are due, leaving Tue afternoon / Wed morning as fallbacks
   before the Thu 12:00 hard deadline.
6. **Lunch (45 min) protected daily; meetings kept under 4h/day** (max this
   week: 1.5h on Wed/Thu).

## Unresolved contradictions

1. **Demo slot conflict (blocking).** Product prefers Wednesday 15:00, but I
   am hard-unavailable Wednesday 13:00–17:30. I will not silently invent
   availability, so the plan assumes the customer's alternative slot,
   **Thursday 16:00**. If Wednesday 15:00 is truly non-negotiable for the
   customer, someone else must own that session — I cannot attend.
2. **Rehearsal window is tight.** Sam is out Tuesday and can only rehearse
   Wednesday 10:00–12:00; a 90-minute rehearsal leaves zero slack in his
   window. If Sam is even 30 minutes late or must shorten it, the rehearsal
   can't be re-run before the demo. Sam needs to confirm.
3. **Lina's corrections are conditional.** "Tuesday by 11:00" holds *unless*
   the vendor export is late (she knows Monday 15:00). The whole finance block
   — and potentially the Thu 12:00 board deadline — hinges on this. No
   fallback timing for a late export has been given.
4. **Demo duration is unspecified.** I assumed ~60 minutes (Thu 16:00–17:00).
   If it's longer, it collides with end of day; if it's shorter, fine.
5. **QA capacity on Wednesday is assumed, not confirmed.** QA is only stated
   to be unavailable Thursday; nobody has confirmed they can take the patch
   Wednesday. If they can't, the fallback is QA Friday morning + change window
   Friday by 15:30 — very tight against the 16:00 deadline.

## Questions assigned to the right person

| Question | Owner | Needed by |
|---|---|---|
| Confirm Thursday 16:00 works for the customer (my Wednesday 15:00 is impossible); also confirm demo duration and attendee list | **Product** | Mon EOD |
| Confirm rehearsal Wed 10:00–11:30 (90 min inside your 10:00–12:00 window) and whether you're attending the Thursday demo | **Sam** | Mon EOD |
| Confirm corrections will make Tue 11:00; if the vendor export is late, give me a realistic arrival time so I can re-plan the finance block before Thu 12:00 | **Lina** | Mon 15:00 (her stated checkpoint) |
| Confirm QA can take the security patch Wednesday (half day) after my Tuesday review, and reserve Thu 10:30–11:00 as the change window | **Engineering + QA** | Mon EOD |
| Confirm the board-numbers process: is the Tue 11:00–13:00 block enough, or do you need me Thursday before 12:00 as well? | **Finance** | Mon EOD |
| Confirm a Monday-EOD strategy draft meets "early this week," and that the 16:00 Tuesday leadership review is the right forum | **CEO** (via leadership meeting invite) | Mon EOD |

## Hard deadlines vs. preferences (explicit)

- **Hard:** renewals response (Mon), board numbers final (Thu 12:00), patch
  deployed (Fri 16:00), escalations #2/#3 (Wed SLA), Tue 14:00 send cutoff
  *if* we want the leadership meeting review.
- **Preferences:** demo on Wed 15:00 (moved to Thu 16:00), CEO's "early this
  week" (met Monday), ≤4h meetings/day, 45-min lunch, Sam's Wed 10:00–12:00
  rehearsal window.
