# Decisions and open questions

“Confirmed” below means stated in the inbox. Proposed scheduling choices are separate and do not represent bookings, completed work, or promises by other people.

## Confirmed constraints and decisions

| Item | Status and consequence |
|---|---|
| Working hours | Monday–Friday 09:30–17:30; Wednesday 13:00–17:30 unavailable |
| Board numbers | Hard deadline Thursday 12:00; require two uninterrupted hours after Lina sends corrections |
| Corrections | Expected Tuesday by 11:00, conditional on vendor export; Lina knows export status Monday by 15:00 |
| Security patch | Hard deployment deadline Friday 16:00; review 60–90 minutes → QA half day → 30-minute change window |
| QA | Unavailable Thursday; no other QA availability was stated |
| Support | Renewal escalation requires a response Monday; two other escalations have Wednesday SLAs; about 45 minutes each |
| Strategy | CEO prefers “early this week”; three focused hours needed. Tuesday 14:00 submission enables review at the 16:00 leadership meeting |
| Demo | Wednesday 15:00 preferred; customer can also do Thursday 16:00. Rehearsal needs 90 minutes and Sam |
| Sam | Unavailable Tuesday; can rehearse Wednesday 10:00–12:00 |
| Recurring meetings | Monday 10:00–10:30, Tuesday 16:00–17:00, Thursday 09:30–10:00 |
| Personal preferences | No more than four meeting hours per day; at least 45 minutes for lunch. The plan honors both |

## Proposed operating choices

- Prioritize the Monday renewal response, board deadline, and patch deadline. Complete the other support responses Tuesday so Wednesday's unavailable afternoon does not threaten their SLAs.
- Draft the strategy outline in two 90-minute focus blocks Monday and circulate it at 16:45. This meets the early-week preference and leaves time before Tuesday's 14:00 review cutoff.
- Protect Tuesday 11:00–13:00 for finance, with Tuesday 14:00–16:00 and Thursday 10:00–12:00 as fallback blocks. Aim to hand over final numbers Thursday by 11:30 on the normal path.
- Review the patch Monday 15:15–16:45, request Tuesday QA, and propose Wednesday 12:15–12:45 deployment. Reserve Friday recovery and a 14:30–15:00 fallback change window. These depend on review material, QA capacity, passing results, and a booked change window.
- Propose the rehearsal Wednesday 10:00–11:30 and the customer demo Thursday 16:00. Hold Thursday until 17:30 because demo duration is unspecified; that hold is not an agreed 90-minute demo.
- Provisionally budget four hours for QA's “half day.” Confirm the actual duration and scheduling with its owner; neither Tuesday nor Friday QA capacity is known.

## Unresolved contradictions and risks

| Issue | What remains unresolved | Owner and decision needed |
|---|---|---|
| Wednesday demo versus unavailable afternoon | Wednesday 15:00 cannot fit the stated calendar | Product: book the customer's Thursday 16:00 alternative or agree another time |
| Expected corrections versus vendor uncertainty | Tuesday 11:00 is conditional, so finance's planned focus block is not guaranteed | Lina: report status Monday by 15:00 and give a revised ETA if late; Finance: choose the acceptable fallback if deadline is threatened |
| Thursday finance fallback versus noon deadline | The recurring meeting ends at 10:00, leaving exactly two hours and no handoff buffer | Finance: agree how finalization and any approval can complete by 12:00; escalate if corrections arrive after 10:00 |
| Patch sequence versus QA blackout | Late review, failed QA, or rework could push testing into Thursday when QA is unavailable | Engineering and QA owner: confirm Tuesday capacity and a recovery path; identify deadline risk before Friday |
| Rehearsal or support problems Wednesday | Only the morning is available; there is no afternoon recovery capacity | Product/Sam: confirm rehearsal; Support lead: arrange coverage if Wednesday SLA work remains after 13:00 |

## Questions assigned to owners

These are proposed request times and response targets, except Lina's Monday 15:00 status checkpoint, which is stated in the inbox. No answers or owner commitments are assumed.

| Owner | Question or action needed | When to request / target |
|---|---|---|
| Lina | Is the vendor export on time? If not, when will complete corrections arrive, and what is still missing? | Request Monday morning; stated status checkpoint Monday 15:00; confirm delivery Tuesday by 11:00 if on time |
| Finance | Who must accept/sign off the final board numbers, and what does “final” require? If export is late, is any provisional approach acceptable, or must the deadline be escalated? | Request Monday; resolve before relying on Thursday's zero-buffer fallback |
| Engineering owner | Will a reviewable patch be ready Monday 15:15? Can the Wednesday 12:15 change window be booked, with Friday 14:30 as fallback if needed? Who handles verification and recovery, and how much time is needed? | Request Monday 09:30; readiness and window confirmation before QA/deployment commitments |
| QA owner, identified through Engineering | How long is the required half day, and is Tuesday 09:30–13:30 available after Monday review? What subsequent slot is possible if review slips, and is Friday 09:30–13:30 available for recovery? | Request Monday 09:30; seek an answer Monday so the schedule can be adjusted |
| Product | Can you book Thursday 16:00 with the customer, confirm the duration ends by 17:30, and identify required attendees? Does Sam also need to attend the demo? | Request Monday; seek booking and duration confirmation Tuesday |
| Sam, coordinated by Product | Can we reserve Wednesday 10:00–11:30 for the rehearsal? Is any demo attendance required and feasible? | Request Monday; confirm before Wednesday; Tuesday is unavailable |
| Support lead | What are the exact Wednesday SLA cutoff times? Are 45-minute responses sufficient for these cases, and who can cover follow-up during Wednesday's unavailable afternoon if needed? | Request Monday; plan responses Tuesday regardless; arrange coverage only if needed |
| CEO / leadership coordinator | Does a Monday outline meet the intended “early this week” scope, and is there anything essential for Tuesday's review? | Request Monday morning; submit the useful first draft Monday, by Tuesday 14:00 at latest for review |

Known availability is limited to the inbox. Owner names not provided are identified by role; no additional staff, meetings, dates, availability, approvals, or overtime are invented.
