# Decisions

Status key: **Decided** = fixed by the inbox or by me, no one else's agreement needed. **Proposed** = my recommendation, needs the named person to confirm. **Blocked** = cannot be settled until someone answers.

## Confirmed decisions

| # | Decision | Basis | Consequence |
|---|---|---|---|
| D1 | Wednesday afternoon (13:00–17:30) is treated as fully unavailable; no work, meetings, or demo attendance is scheduled there. | Stated working pattern. | The Wednesday 15:00 demo slot cannot be accepted by me. |
| D2 | The strategy outline is drafted Monday 12:45–15:45, not Tuesday morning. | A 3 h first draft cannot coexist with the 2 h finance block that must start after 11:00 Tuesday. Drafting Monday is the only way to both send by 14:00 Tuesday and give Finance its uninterrupted time. | Tuesday morning holds only sending and a 45-min escalation. |
| D3 | The security patch review is done Monday 16:00–17:30. | Review is the first link in a three-stage chain (review → QA half day → change window) and QA is unavailable Thursday. Starting Monday keeps a full day of slack. | QA can run Tuesday; deploy need not be same-day. |
| D4 | The 30-minute change window is booked Friday 09:30–10:00, not Thursday. | Thursday morning is the only remaining buffer for the board numbers if Lina's export slips; a 12:00 hard deadline outranks an early deploy. Friday 09:30 still leaves 6 h before the 16:00 deadline. | Requires Engineering to confirm the window and the operator. |
| D5 | Finance's two uninterrupted hours are booked Tuesday 11:00–13:00, immediately after Lina's 11:00 delivery. | Finance asked for two hours *after* corrections; this is the earliest slot that satisfies both that and the lunch minimum. | If corrections are late, the block moves to 13:45–15:45 (see contingency). |
| D6 | The renewal escalation is answered Monday; the other two are split Tuesday/Wednesday. | One has a Monday commitment; the others have Wednesday SLAs and can wait a day. | Wednesday carries one escalation only, alongside the rehearsal. |
| D7 | No day exceeds 4 h of meetings; lunch is ≥45 min daily. | Stated personal limit. | Thursday and Wednesday are the tightest days at 90 min of meetings. |
| D8 | The demo is assumed to be 60 minutes and to require my attendance. | Neither is stated in the inbox. | If either is wrong, Thursday evening changes (see Q3). |

## Unresolved contradictions

| # | Contradiction | Why it cannot be resolved unilaterally |
|---|---|---|
| C1 | Product prefers the demo **Wednesday 15:00**; I am unavailable Wednesday 13:00–17:30. | These are mutually exclusive. Either the demo moves to Thursday 16:00, or someone else presents. I cannot be in the room, and I will not pretend the preference can be met. |
| C2 | CEO wants the outline "early this week" and a Tuesday 16:00 review *if sent by 14:00*; Finance needs two uninterrupted hours Tuesday morning after corrections arrive at 11:00. | Drafting must be done Monday for both to hold. If Monday is disrupted (escalation overrun, patch review slipping), one of the two slips — the outline review is the softer of the two and would yield. |
| C3 | Wednesday is only ~3 h of work, yet it is the only day Sam can rehearse and the day two escalations are due. | After a 90-min rehearsal and 45-min lunch, ~45 min of slack remains. One escalation fits; two do not. Hence one moves to Tuesday. If the rehearsal overruns, the escalation is squeezed, not the lunch. |
| C4 | Board numbers are hard-final Thursday 12:00, but Finance describes only "two hours" of work — Tuesday. | If finalisation needs materially more than two hours, Thursday's 10:00–12:00 margin may not cover it, and Wednesday afternoon is unavailable. Needs Finance to confirm the estimate (Q2). |
| C5 | "Deploy by Friday 16:00" and "QA unavailable Thursday" pull the change window toward Friday, while Thursday morning is the board-number safety net. | Only one can use Thursday morning. I chose the hard external deadline (board numbers) and moved the deploy earlier in the day Friday instead. Reversible if Engineering prefers Thursday. |

## Questions, assigned

**To Lina** — needed Monday 15:45
- Q1. Will the vendor export land on time, and will Tuesday's corrections be complete or partial? If partial, which figures are provisional?
- If the export is late: what is the earliest realistic delivery, and who else can supply the missing data?

**To Finance** — needed Monday, before the checkpoint
- Q2. Is two hours the full effort to finalise, or is Thursday's 10:00–12:00 also needed? Can you accept submission at 11:00 Thursday rather than 12:00?
- Who signs off, and what should I do if Lina's export slips past Tuesday afternoon?

**To Product** — needed Monday
- Q3. Can the demo move to **Thursday 16:00**? Wednesday 15:00 is inside my unavailable window, so I cannot staff it. If Thursday does not work for the customer, who presents?
- Q4. Is the demo 60 minutes? Am I presenting or attending? Who else besides Sam must be there?

**To Sam** — needed Monday
- Q5. Confirm Wednesday 10:00–11:30 for the 90-minute rehearsal (your window is 10:00–12:00). Can you hold a 30-minute second run Thursday 14:30 if the rehearsal exposes gaps?

**To Engineering / QA** — needed Tuesday
- Q6. Can QA take the half day Tuesday afternoon (review lands Monday 17:30)? If not, Wednesday morning — but then confirm it does not need me.
- Q7. Confirm the change window **Friday 09:30–10:00**, who executes it, and who is on rollback. If Friday morning is not viable, say so now so Thursday can be reconsidered.

**To CEO / leadership** — needed Monday
- Q8. Is the Tuesday 16:00 review essential, or is Wednesday acceptable if the draft needs one more pass? "Early this week" does not tell me which.

**To Support** — needed Monday 09:30
- Q9. Which of the three is the renewal one, what response format is expected, and by what time Monday?

## Dependencies on other people, at a glance

| Person | What I need | When | If it does not arrive |
|---|---|---|---|
| Lina | Export status | Mon 15:45 | Finance block moves to Tuesday afternoon; Thursday 12:00 flagged at risk |
| Finance | Effort estimate, sign-off owner | Mon | Plan Thursday 10:00–12:00 defensively |
| Product | Demo slot decision | Mon | Proceed with Thursday 16:00 as proposed; do not attend Wednesday |
| Sam | Rehearsal confirmation | Mon | Rehearsal falls back to 10:00–11:30 Wednesday regardless |
| Engineering/QA | QA slot, change window | Tue | Book Friday 09:30 and state the assumption in the team note |
| CEO | Whether Tuesday review is essential | Mon | Send the draft Tuesday morning anyway; review becomes optional |
