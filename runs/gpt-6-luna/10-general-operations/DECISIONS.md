# Decisions and open questions

## Confirmed

- Work hours are 09:30–17:30 on weekdays; Wednesday 13:00–17:30 is unavailable. Reserve at least 45 minutes for lunch and keep meetings under four hours per day.
- Recurring meetings are Monday 10:00–10:30, Tuesday 16:00–17:00, and Thursday 09:30–10:00.
- The renewal-related support escalation needs a response Monday. The other two have Wednesday SLAs and take about 45 minutes each.
- Board numbers must be final Thursday by 12:00. Finance needs two uninterrupted hours after Lina sends corrections, expected Tuesday morning unless the vendor export is late. Lina will know by Monday 15:00 if it is late.
- The security patch must deploy by Friday 16:00. The required order is a 60–90 minute review, then half-day QA, then a 30-minute change window. QA is unavailable Thursday.
- The CEO wants a strategy outline early this week. It takes three focused hours and can be reviewed at Tuesday's 16:00 leadership meeting if sent by 14:00.
- Product prefers a Wednesday 15:00 customer demo; the customer can also do Thursday 16:00. The demo environment needs a 90-minute rehearsal and Sam must join. Sam is unavailable Tuesday and can rehearse Wednesday 10:00–12:00.

## Plan choices

- Send the strategy outline Monday after a three-hour focused block, ahead of Tuesday's 14:00 review cutoff.
- Use Tuesday 11:00–13:00 for board finalization if corrections arrive on time, with Tuesday 13:45–15:45 as the fallback and Thursday 10:00–12:00 as the final backstop.
- Schedule the user's patch review Monday 16:00–17:30; ask QA to run Tuesday after review and hold Wednesday morning/early afternoon for retest. Target deployment Friday 13:00.
- Do not schedule the preferred Wednesday 15:00 customer demo because it falls in the user's unavailable period. Hold Thursday 16:00 instead, subject to Sam's availability and confirmation that the demo fits before 17:30.

## Open questions and owners

| Owner | Question / decision needed | When needed |
|---|---|---|
| Lina | By Monday 15:00, confirm whether the vendor export is late and give the firm correction ETA. If Tuesday 11:00 is at risk, send an update before then. | Monday 15:00; update Tuesday morning |
| Finance owner | If corrections are not available by Tuesday 13:45, who can provide coverage or approve a recovery path? Can the Thursday noon deadline still be met if corrections arrive after that point? | Agree as soon as Lina reports a delay |
| Engineering | Will the patch package be review-ready by Monday 16:00, and can Engineering hold the Friday 13:00 change window? | Monday 15:45 |
| QA / Engineering | Can QA complete the half-day Tuesday after review and keep Wednesday morning/early afternoon available for a retest? Confirm the QA owner and actual slot; Thursday is unavailable. | Monday before review completes |
| Sam | Can you join the customer demo Thursday at 16:00? | Monday, before Product locks the slot |
| Product | Confirm the customer demo duration and whether Thursday 16:00 works with Sam. If not, find another slot both can attend. | Monday |

## Timing risks

- If the vendor export slips, the Tuesday finance fallback only works if corrections arrive by 13:45. Thursday 10:00–12:00 is the last usable two-hour block before the board deadline, so later delivery needs an immediate Finance/Lina decision.
- The Thursday demo is not fully confirmed until Sam's attendance and duration are known. The Wednesday preferred time conflicts with the user's unavailable hours.
- Any QA failure needs resolution by Wednesday because QA cannot run Thursday and the patch has a Friday 16:00 deployment deadline.
