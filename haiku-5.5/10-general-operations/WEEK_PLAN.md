# Week plan: Mon 12 – Fri 16 October 2026

Source: `INBOX.md` (notes collected Friday 9 Oct).

## Working assumptions

- Working hours 09:30–17:30, Monday to Friday. Wednesday is usable only 09:30–13:00 (unavailable 13:00–17:30). Friday has no other notes, so standard hours apply.
- Lunch is 45 minutes every day. Meetings stay under four hours a day.
- Anything marked **(assumed)** is not in the notes. It needs confirming, see `DECISIONS.md`.

## Deadlines: hard vs. preference

| When | Item | Type |
|---|---|---|
| Mon 12 Oct, by end of day | Response to the renewal-affecting escalation | **Hard** (notes say "needs a response Monday") |
| Mon 12 Oct 15:00 | Lina confirms whether the vendor export is late | Decision point |
| Tue 13 Oct 11:00 | Lina's board corrections | Dependency (slips if export is late) |
| Tue 13 Oct 14:00 | CEO strategy draft sent | **Hard** for the 16:00 leadership review |
| Wed 14 Oct (time not given) | Two support escalation SLAs | **Hard** (SLA) |
| Wed 14 Oct 10:00–12:00 | Sam's rehearsal window | **Hard** (Sam's only offered window) |
| Thu 15 Oct 12:00 | Board numbers final | **Hard** (Finance) |
| Thu 15 Oct 16:00 | Customer demo | **Hard** once booked (customer's stated alternative) |
| Fri 16 Oct 16:00 | Security patch deployed | **Hard** |
| Wed 14 Oct 15:00 | Demo preferred slot | Preference, not feasible (you are unavailable) |
| "Early this week" | CEO outline | Preference; Tue 14:00 is the real cutoff |
| ≤4 h meetings/day, ≥45 min lunch | Your working preferences | Preference (met in this plan) |

## Dependency chains

- **Security patch:** patch ready → your review (Mon) → QA half day (Tue, assumed) → 30-min change window (Wed 11:30) → deployed by Fri 16:00.
- **Board numbers:** vendor export → Lina's corrections (Tue 11:00) → your 2-hour block (Tue 11:00–13:00) → sent to Finance (Thu 11:30) → Finance deadline (Thu 12:00).
- **CEO outline:** first draft (Mon 13:30–16:30) → your read (Tue 09:30) → sent (Tue 10:00–10:30) → leadership review (Tue 16:00).
- **Customer demo:** Product books Thu 16:00 → Sam rehearsal (Wed 10:00–11:30) → demo (Thu 16:00).
- **Support:** renewal response (Mon) → two Wednesday-SLA escalations handled early (Tue afternoon).

## Monday 12 Oct

Meetings: 0.5 h. Focus: about 5.75 h, plus 1 h contingency.

| Time | Block | Type | Notes |
|---|---|---|---|
| 09:30–10:00 | Triage; review `DECISIONS.md` questions | Focus | Send nothing until you have read `DRAFT_REPLY.md` |
| 10:00–10:30 | Recurring meeting | Meeting | Fixed |
| 10:30–11:15 | Renewal-affecting escalation: response | Focus | Hard by end of day. Response only; the fix can follow |
| 11:15–12:45 | Security patch review | Focus | Head of the security chain. Needs patch ready at 11:15 |
| 12:45–13:30 | Lunch | Lunch | |
| 13:30–16:30 | CEO strategy first draft (3 focused hours) | Focus | Only Monday afternoon gives three hours before Tue 14:00. Glance at Lina's 15:00 update at the 15:00 mark, then straight back to the draft |
| 16:30–17:30 | **Contingency** | Buffer | Used first (see below) |

## Tuesday 13 Oct

Meetings: 1 h (16:00–17:00). Focus: about 4.5 h (finance block plus two escalations).

| Time | Block | Type | Notes |
|---|---|---|---|
| 09:30–10:00 | Read CEO draft once; fix obvious issues | Focus | |
| 10:00–10:30 | Send CEO draft to leadership | Fixed (target) | Hard cutoff 14:00. You send it |
| 10:30–11:00 | Buffer; confirm Lina's corrections are in | Buffer | If not in, do not start the finance block (see Contingency) |
| 11:00–13:00 | **Board numbers finance block (2 uninterrupted hours)** | Focus (protected) | Starts when Lina's corrections arrive |
| 13:00–13:45 | Lunch | Lunch | |
| 13:45–14:30 | Support escalation 1 (Wednesday SLA) | Focus | Handled a day early |
| 14:30–15:15 | Support escalation 2 (Wednesday SLA) | Focus | |
| 15:15–16:00 | Buffer; check QA half-day result | Buffer | QA's half day is QA's work (assumed Tuesday) |
| 16:00–17:00 | Leadership meeting | Meeting | Assumed to be the recurring Tue 16:00–17:00 slot |
| 17:00–17:30 | Buffer | Buffer | |

## Wednesday 14 Oct (usable 09:30–13:00 only)

Meetings: 1.5 h (rehearsal). Focus: about 1 h (triage, change window).

| Time | Block | Type | Notes |
|---|---|---|---|
| 09:30–10:00 | Triage: QA result, Finance status, demo logistics | Focus | |
| 10:00–11:30 | Demo environment rehearsal with Sam (90 min) | Fixed | Sam's window is 10:00–12:00. Don't start the change window early |
| 11:30–12:00 | Security patch change window (30 min) | Fixed (assumed) | After rehearsal. Fallback is Fri 13:30 |
| 12:00–12:45 | Lunch | Lunch | |
| 12:45–13:00 | Buffer | Buffer | Move anything unfinished to Thursday |
| 13:00–17:30 | Unavailable | — | Nothing scheduled, including Product's 15:00 request |

## Thursday 15 Oct

Meetings: 1.5 h (recurring 30 min + demo, assumed 60 min). Focus: about 4.5 h.

| Time | Block | Type | Notes |
|---|---|---|---|
| 09:30–10:00 | Recurring meeting | Meeting | Fixed |
| 10:00–11:30 | Board numbers: final check. If Tuesday's block did not happen, this becomes the finance block | Focus (protected) | Zero slack in the fallback case |
| 11:30–12:00 | Send final numbers to Finance and confirm receipt | Fixed | Finance deadline is 12:00 |
| 12:00–12:45 | Lunch | Lunch | |
| 12:45–15:30 | Demo prep: script, open decisions, Support follow-ups | Focus | |
| 15:30–16:00 | Demo environment check after the patch (Sam, if confirmed) | Buffer | If Sam is not available, check solo and note it |
| 16:00–17:00 | Customer demo | Fixed (customer) | Not booked yet. Duration assumed 60 min |
| 17:00–17:30 | Debrief; buffer | Buffer | |

## Friday 16 Oct

Meetings: none. Focus: about 1 h (the rest is buffer, since Friday is the deadline day).

| Time | Block | Type | Notes |
|---|---|---|---|
| 09:30–12:30 | Follow-ups: demo notes, Support, patch confirmation | Buffer | |
| 12:30–13:15 | Lunch | Lunch | |
| 13:15–13:30 | Buffer | Buffer | |
| 13:30–14:00 | **Fallback security change window** (only if Wednesday's was missed) | Contingency | Deployment must be complete by 16:00 |
| 14:00–16:00 | Buffer | Buffer | Hard stop for the patch is 16:00 |
| 16:00–17:00 | Week close-out and next week's items | Focus | |
| 17:00–17:30 | Buffer | Buffer | |

## Contingency rules

1. **Patch not ready at 11:15 Monday:** review moves to Monday 16:30–17:30 (60 min, the minimum). QA can still start Tuesday, and the Wednesday window still holds.
2. **Lina says the export is late (Mon 15:00):** message Finance before 17:00 Monday. Propose Thursday 10:00–12:00 as the fallback (zero slack) and ask whether partial numbers Tuesday are acceptable. Tuesday 11:00–13:00 is then free, so the two support escalations can move up from 13:45.
3. **Wednesday change window missed:** Friday 13:30–14:00. Deadline is 16:00.
4. **Thursday 16:00 falls through:** the customer's only stated options are Wed 15:00 (you are unavailable) and Thu 16:00. Any other date needs Product to renegotiate with the customer, and whether to accept it is your decision.
5. **Monday runs long:** the renewal response and the security review stay fixed, so the CEO draft absorbs the overrun. Its only spare time is Monday 16:30–17:30 and the Tuesday 10:30–11:00 buffer, which is not enough for three hours. If it is still short at 14:00 Tuesday, send a clearly labelled partial outline. Do not move the finance block to make room. Rule 1 also uses the Monday 16:30 slot, so if both happen, the CEO draft is the item to shorten.

## Not scheduled, on purpose

- No Wednesday afternoon work (unavailable 13:00–17:30).
- No Thursday QA work (QA unavailable).
- No Support work on Wednesday (moved to Tuesday).
- No Wednesday 15:00 demo (conflicts with your unavailability).
