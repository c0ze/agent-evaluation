# Decisions, contradictions and open questions

## Hard deadlines and constraints versus preferences

**Hard deadlines**

- Renewal escalation: response on Monday.
- Two other escalations: Wednesday SLAs (time of day not stated).
- Board numbers: final by Thursday 12:00.
- Security patch: deployed by Friday 16:00.

**Hard constraints**

- My hours: 09:30–17:30 Monday to Friday; unavailable Wednesday 13:00–17:30.
- Sam: unavailable Tuesday; can rehearse Wednesday 10:00–12:00. No other availability is stated.
- QA: unavailable Thursday.
- Lina: corrections Tuesday by 11:00 at the earliest; she knows by Monday 15:00 whether the vendor export delays them.
- The demo needs a 90-minute rehearsal with Sam beforehand.
- Patch sequence: review, then QA (half day), then a 30-minute change window.
- Recurring meetings: Mon 10:00–10:30, Tue 16:00–17:00, Thu 09:30–10:00.

**Preferences and soft targets**

- Product prefers the demo on Wednesday 15:00. The customer can also do Thursday 16:00.
- The CEO wants the strategy outline "early this week". Tuesday 14:00 is a real cutoff only if the outline is to be reviewed at Tuesday's leadership meeting.
- No more than four hours of meetings a day.
- At least 45 minutes for lunch.

## Confirmed decisions

These are mine to make and follow directly from the stated constraints.

1. The renewal escalation is answered Monday 10:30–11:15, before anything else of substance.
2. I review the security patch on Monday, not later in the week. QA is out Thursday and I am out Wednesday afternoon, so a Monday review is what leaves room for a retry.
3. The two Wednesday-SLA escalations are handled Tuesday afternoon. I do not rely on Wednesday, when I have 3.5 working hours and a rehearsal.
4. Board numbers get Tuesday 11:00–13:00 as an uninterrupted block, and Thursday 10:00–12:00 stays held as the fallback until the numbers are final.
5. The strategy outline gets Monday 13:30–16:30. It is a first draft, and it is the first item to slip if Monday overruns.
6. I do not attend anything Wednesday after 13:00, including a demo.
7. Lunch and the four-hour meeting cap are kept every day. Neither is used as contingency.

## Proposed, waiting on someone else

| Proposal | Needs | By |
|----------|-------|----|
| Demo on Thursday 16:00 instead of Wednesday 15:00 | Product to confirm with the customer | Monday end of day |
| Rehearsal Wednesday 10:00–11:30 | Sam to accept | Monday end of day |
| QA starts Monday afternoon or Tuesday, signs off by Wednesday | QA and Engineering | Monday midday |
| Change window Wednesday 09:30–10:00 if QA has signed off, otherwise Friday 10:00–10:30 | Engineering | Tuesday end of day |
| Outline goes to Tuesday's leadership meeting as a first draft | CEO | Monday |

## Unresolved contradictions

1. **Demo date against my availability.** Product prefers Wednesday 15:00. I am unavailable from 13:00 that day, and the only rehearsal slot is that same morning. The preferred slot works only if the demo runs without me, three hours after rehearsal. I recommend Thursday 16:00.
2. **Finance's plan assumes Tuesday-morning corrections; Lina's are conditional.** If the vendor export is late there is no stated new arrival time. After Tuesday 16:00 the only uninterrupted two-hour block before the deadline is Thursday 10:00–12:00, which ends exactly at the deadline.
3. **Whose two hours?** Finance's note says "need two uninterrupted hours" without saying who needs them. I have planned as if they are mine. If Finance also needs time after I finish, the real deadline for my part is earlier than Thursday 12:00.
4. **Wednesday SLAs against a half Wednesday.** If the SLAs expire at end of day Wednesday, I cannot use the afternoon. Planned for Tuesday, but the exact expiry times are unknown.
5. **Patch timing against QA and me.** Thursday is the natural day to deploy after a Wednesday QA sign-off, but QA is out and it is demo day. Whether Engineering is willing to deploy without QA on hand, and whether the patch touches the demo environment, is not stated.
6. **"Early this week" against capacity.** The only three-hour focus block before Tuesday 14:00 is Monday afternoon, on a day that also carries a hard escalation deadline and the patch review. The outline fits only if the patch is ready on time and Monday has no surprises.
7. **Sam and the demo itself.** The notes say Sam must join the rehearsal. They do not say whether Sam is needed at the demo or is free Thursday 16:00.
8. **Thursday could carry two hard items.** If corrections are late and the demo moves to Thursday, the board numbers (10:00–12:00) and the demo (16:00) land on the same day with no slack between the numbers and their deadline.

## Questions, by owner

**Lina**
- By Monday 15:00: is the vendor export on time?
- If it is late, what is a realistic date and time for the corrections? Can a partial set come earlier?

**Finance**
- Are the two uninterrupted hours mine, yours, or both?
- Is Thursday 12:00 when the numbers leave Finance, or when I hand them to you? Do you need review time after my part?
- If corrections arrive after Tuesday 14:00, do you accept finishing at Thursday 12:00 with no margin? If they arrive after Thursday 10:00, what goes to the board?

**Product**
- Can you confirm Thursday 16:00 with the customer by Monday end of day?
- How long is the demo? It has to end by 17:30.
- Who prepares the demo environment before Wednesday 10:00?
- If you want to keep Wednesday 15:00, who runs it in my place?

**Sam**
- Can you accept Wednesday 10:00–11:30?
- Are you needed at the demo, and if so are you free Thursday 16:00?
- Do you have any time Monday, in case the rehearsal needs to move?

**Engineering**
- Is the patch ready for review by Monday 11:15?
- Do I need to be in the change window, and who schedules it?
- Are you willing to deploy on Thursday without QA available?
- Does the patch touch the demo environment?

**QA**
- If I hand over the review at about 12:45 Monday, when can you start?
- How long is "half a day" in hours?
- Can you re-run on Friday morning if the first pass fails?

**CEO**
- Is Tuesday's leadership meeting the right place for a first draft, or do you want to see it before then?
- Does "early this week" mean Tuesday is fine, or did you want it Monday?

**Support**
- Which of the three is the renewal escalation, and who is the customer contact?
- What time on Wednesday do the other two SLAs expire?
- Does "response" mean a first reply or a resolution?
