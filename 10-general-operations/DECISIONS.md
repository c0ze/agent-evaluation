# Decisions

## Confirmed

These are settled by the notes or by the calendar constraints. They do not need another round of agreement.

- Working time is 09:30–17:30, Monday to Friday. Wednesday 13:00–17:30 is unavailable.
- Board numbers are final Thursday at 12:00. That is a hard deadline. The work is two uninterrupted hours, and it starts only after Lina sends corrections.
- Lina's forecast is corrections by Tuesday 11:00. She will know by Monday 15:00 whether the vendor export is late.
- The security patch is deployed by Friday 16:00. That is a hard deadline. The sequence is a 60–90 minute review, then QA for half a day, then a 30-minute change window. QA is unavailable Thursday.
- One support escalation affects renewals and gets a response on Monday. The other two carry Wednesday SLAs. Each is about 45 minutes.
- The strategy outline is a first draft of about three focused hours. "Early this week" is a preference. The Tuesday 16:00 leadership meeting can review it only if the draft was sent by 14:00.
- Recurring meetings stay: Monday 10:00–10:30, Tuesday 16:00–17:00, Thursday 09:30–10:00.
- Lunch of at least 45 minutes, and no more than four hours of meetings in a day, are preferences. This plan keeps both.
- Sam is unavailable Tuesday. The only rehearsal window he gave is Wednesday 10:00–12:00. The rehearsal needs 90 minutes and Sam joins, so it is set for Wednesday 10:00–11:30.
- Wednesday 15:00 cannot be the customer demo. It falls inside the closed afternoon. The demo is declined for that slot.

## Choices made in the plan

- Thursday 16:00–17:30 is held for the demo because it is the only other slot the customer offered. It is a hold, not a confirmation. Length was not stated, and 17:30 is the end of the day.
- The patch review is Monday 11:15–12:45, so QA has a non-Thursday half day afterward. Tuesday is the backup for the review. Wednesday's planned mornings (rehearsal, or the board block) leave no 60–90 minute opening. A same-day Friday review, QA half day, and change window is not in the plan: it only works if QA starts immediately and nothing slips before 16:00, and QA's hours were not stated.
- QA is asked for Tuesday. Friday morning is the backup half day. The change window is targeted at Friday 15:00–15:30, with the user reachable. Wednesday 09:30–10:00 is an optional earlier window only if QA is already done and the board block is not using Wednesday.
- Thursday 10:00–12:00 stays clear until Finance says the numbers are final.
- The two Wednesday-SLA escalations are placed Monday 15:45–16:30 and Tuesday 13:45–14:30. Wednesday 11:30–12:15 can take one of them if Tuesday cannot. It cannot take both.
- The strategy draft is Monday 13:30–15:30 plus Tuesday 09:30–10:30, sent at 10:30, on the default week. If Monday's renewal or review runs long, the outline is what moves.
- If corrections are waiting at Tuesday 09:30 and Monday's review is done, the board block takes 09:30–11:30, strategy hour 3 moves to 12:15–13:15, and the outline goes out by 13:45, still before 14:00. If the review missed Monday as well, 12:15–13:45 is the review and the outline misses the meeting.
- If corrections are not in hand by Tuesday 14:00, Sam and Product get a warning that afternoon. If the corrections are then waiting at Wednesday 09:30, Wednesday 09:30–11:30 becomes the board block and the rehearsal is released. If they are not waiting at 09:30, the rehearsal stays and the board block moves to Thursday 10:00–12:00. The rehearsal is not cancelled in advance.
- If corrections are still not in hand at Thursday 10:00, Thursday 12:00 is missed. That gets escalated rather than papered over.

## Unresolved contradictions

**Demo slot against the Wednesday close.** Product's preferred demo is Wednesday 15:00. Wednesday 13:00–17:30 is unavailable. Both cannot happen. The only alternative in the notes is Thursday 16:00. Sam's Thursday is unknown, and it is also unresolved whether he is required at the live demo or only at the rehearsal. Until Product confirms the customer and, if needed, Sam confirms Thursday, the demo is held and not locked.

**A late vendor export against a Thursday noon final.** Finance's two hours assume corrections on Tuesday morning. Lina has already said the vendor export may be late. Wednesday afternoon is closed. Wednesday morning can hold the two hours only by giving up Sam's rehearsal, and only if the corrections are actually there at 09:30. Otherwise the last legal window is Thursday 10:00–12:00, which ends at the moment the numbers must already be final. A late export and a noon Thursday finality are in tension. Monday 15:00 is when that either clears or gets escalated.

**Three strategy hours against the Tuesday meeting and the Tuesday finance block.** This fits on the default week: two hours Monday afternoon, one hour Tuesday before 11:00, send at 10:30. It does not fit if Monday is used up by the renewal and the review, because Tuesday 11:00–13:00 stays on the board numbers and the send cutoff is 14:00. The outline then misses the leadership meeting. That tradeoff is accepted. The day does not get extended to rescue a preference.

## Questions

**Lina**

- By Monday 15:00: is the vendor export on time?
- If it is late, what time will the corrections actually arrive? The two-hour block needs a start by Tuesday 14:00 if it is to finish the same day, or a file waiting at Wednesday 09:30 if it is to leave Thursday any buffer.

**Finance**

- If the two-hour pass is forced onto Thursday 10:00–12:00, is a noon final still real, or do you need time after the pass before you will call the numbers final?
- Who sends the "these are final" note, so Thursday morning can be released if Tuesday's pass holds?

**Product**

- Tell the customer Wednesday 15:00 is off the table, and ask them to confirm Thursday 16:00.
- How long is the demo? The hold is 16:00–17:30 because the length was not given and the day ends at 17:30.
- Does Sam have to be in the live demo, or only in the rehearsal?
- Default if the export misses Tuesday: Wednesday morning goes to the board numbers and the rehearsal drops, provided the corrections are waiting at 09:30. Say if you would rather keep the rehearsal and accept a Thursday 10:00–12:00 finalization with no buffer.

**Sam**

- Wednesday 10:00–11:30 is the rehearsal, inside the 10:00–12:00 window you gave. Tuesday you are out, so nothing is booked then.
- Can you do a live demo on Thursday 16:00? That time is not assumed.
- You may get a Tuesday-afternoon warning that Wednesday's rehearsal could be released at 09:30 if board corrections arrive overnight. It will not be cancelled before we know.

**Engineering and QA**

- Review is planned to finish Monday by 12:45. Can QA take the half day on Tuesday?
- If Tuesday is not possible, the backup half day is Friday morning. Thursday is closed.
- Is Friday 15:00–15:30 an acceptable change window, and does it need the user in the room?
- If QA is clean on Tuesday, Wednesday 09:30–10:00 can be the change window instead. It has to stop at 10:00 for rehearsal, and it is off the table if Wednesday morning has become the board block.

**Support**

- The renewals escalation will be answered Monday. The other two are scheduled Monday late afternoon and Tuesday after lunch.
- If any of the three is waiting on another team, say so Monday at 09:30. The 45-minute estimates are otherwise treated as solo work.

**CEO**

- The outline is aimed at the Tuesday 16:00 meeting, sent before 14:00, on the default week.
- If Monday is taken by the renewal response or the patch review, the draft moves to later in the week and that meeting will not have it. Is there a time after which a first draft stops being useful, or is later this week still the right reading of "early"?
