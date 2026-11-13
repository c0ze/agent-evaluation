# Week plan, Monday–Friday

Working hours are 09:30–17:30, with Wednesday ending at 13:00. Nothing below is scheduled outside those hours, and lunch (45 minutes every day) is not counted as spare time.

Several slots depend on answers I don't have yet. They are marked **(assumed)** and the open questions are listed in `DECISIONS.md`.

## Priorities

| # | Item | Deadline | Type | My effort | Depends on |
|---|------|----------|------|-----------|------------|
| 1 | Board numbers final | Thu 12:00 | Hard | 2 h uninterrupted | Lina's corrections (Tue by 11:00, unless the vendor export is late) |
| 2 | Security patch deployed | Fri 16:00 | Hard | 60–90 min review, plus the 30 min change window if I'm needed in it | My review, then QA (half day, not Thursday), then the change window |
| 3 | Renewal escalation answered | Monday | Hard | 45 min | Nothing |
| 4 | Two other escalations | Wednesday SLA (time of day unknown) | Hard | 2 × 45 min | Nothing; I leave at 13:00 Wednesday, so I treat Tuesday as my deadline |
| 5 | Customer demo and rehearsal | Thu 16:00 proposed; Wed 15:00 was Product's preference | Date is a preference; rehearsal before the demo is a requirement | 90 min rehearsal, plus the demo | Sam (rehearsal only possible Wed 10:00–12:00), Product confirming the date with the customer |
| 6 | Strategy outline, first draft | "Early this week"; Tue 14:00 to make the leadership meeting | Soft; 14:00 is a real cutoff only for Tuesday's review | 3 h focused | Nothing |

Priority is what gets protected when things collide, not the order of work. Monday starts with item 3 because it is short and due that day.

## Dependencies

```
Lina knows about vendor export (Mon 15:00)
  └─ corrections arrive (Tue by 11:00 if on time)
       └─ board numbers, 2 h uninterrupted ──► final by Thu 12:00

Patch ready for review (assumed Mon morning)
  └─ my review (Mon 11:15–12:45)
       └─ QA half day (Mon pm, Tue or Wed; not Thu)
            └─ 30 min change window ──► deployed by Fri 16:00

Product confirms Thu 16:00 with customer (needed Mon)
  └─ rehearsal with Sam (Wed 10:00–11:30)
       └─ fixes (Thu 12:45–14:15) ──► demo Thu 16:00

Strategy outline 3 h (Mon 13:30–16:30)
  └─ sent by Tue 14:00 ──► leadership meeting Tue 16:00
```

Latest safe points for the patch, since it has the longest chain:

- Review done by Tuesday: QA can finish by Wednesday, leaving one full retry cycle (fix, re-review Thursday, re-QA Friday morning) before the deadline.
- Review done Wednesday morning: QA Wednesday afternoon, deploy Friday. No retry cycle.
- Review done Thursday: QA Friday morning, deploy Friday afternoon. No margin at all.

## Monday

| Time | Block |
|------|-------|
| 09:30–10:00 | Send the alignment message (`DRAFT_REPLY.md`). Get renewal escalation details from Support. |
| 10:00–10:30 | Recurring meeting |
| 10:30–11:15 | **Renewal escalation response** (hard, due today) |
| 11:15–12:45 | **Security patch review** (assumed ready), then hand to QA |
| 12:45–13:30 | Lunch |
| 13:30–16:30 | **Focus block: strategy outline**, 3 h, no meetings |
| 16:30–17:00 | Checkpoint: read Lina's vendor export update (due 15:00), Product's demo confirmation, QA's start time. Re-plan Tuesday if needed. |
| 17:00–17:30 | Contingency |

Meetings: 30 min.

If the patch is not ready at 11:15, the outline starts then and the review moves to whenever the patch lands, at the latest Tuesday 09:30–11:00.

## Tuesday

| Time | Block |
|------|-------|
| 09:30–11:00 | Outline final pass and send. Also the spillover slot for Monday (review or outline). |
| 11:00–13:00 | **Focus block: board numbers**, 2 h uninterrupted, notifications off. Hand to Finance at 13:00. |
| 13:00–13:45 | Lunch |
| 13:45–14:00 | Last call: outline must be sent by 14:00 to be reviewed at 16:00 |
| 14:00–15:30 | **Two Wednesday-SLA escalations**, 45 min each |
| 15:30–16:00 | Contingency |
| 16:00–17:00 | Leadership meeting (recurring; assumed to be the same meeting that reviews the outline) |
| 17:00–17:30 | Contingency. Check QA progress on the patch. |

Meetings: 1 h. Sam is out today, so nothing demo-related is scheduled.

## Wednesday (09:30–13:00 only)

| Time | Block |
|------|-------|
| 09:30–10:00 | Proposed change window for the patch if QA signed off Tuesday. Otherwise contingency for escalation spillover. |
| 10:00–11:30 | **Demo rehearsal with Sam**, inside Sam's 10:00–12:00 window |
| 11:30–12:15 | Rehearsal overrun, fix list, handover notes before I go offline |
| 12:15–13:00 | Lunch |
| 13:00–17:30 | Unavailable |

Meetings: 1.5 h. Anything that needs me Wednesday afternoon has to be done by 12:15 or wait until Thursday.

## Thursday

| Time | Block |
|------|-------|
| 09:30–10:00 | Recurring meeting |
| 10:00–12:00 | **Held for board numbers.** If they were finished Tuesday, this is a final check with Finance and then free time. If corrections were late, it is the last 2 h block before the 12:00 deadline. |
| 12:00–12:45 | Lunch |
| 12:45–14:15 | Demo fixes from the rehearsal |
| 14:15–15:30 | Contingency. Patch re-review goes here if QA sent it back. |
| 15:30–16:00 | Demo pre-flight |
| 16:00–17:30 | **Customer demo** (proposed; length not confirmed, must end by 17:30) and notes |

Meetings: up to 2 h. QA is out, so no QA work and, unless Engineering says otherwise, no patch deployment today.

## Friday

| Time | Block |
|------|-------|
| 09:30–10:00 | Patch status check |
| 10:00–10:30 | Backstop change window, held until the patch is live |
| 10:30–12:30 | Flexible work: outline revisions from Tuesday's feedback, demo follow-ups |
| 12:30–13:15 | Lunch |
| 13:15–14:00 | Contingency |
| 14:00–14:30 | Second backstop change window (used if QA had to re-run Friday morning) |
| 14:30–15:30 | Contingency |
| 15:30–16:00 | Last possible change window. **Patch deadline 16:00.** |
| 16:00–17:00 | Week wrap-up and status note |
| 17:00–17:30 | Contingency |

Meetings: at most 30 min.

## Contingency space and when it gets used

About 8 hours are unallocated or conditionally held (2 of them are the Thursday hold, which is free only if the numbers are already done): Mon 17:00–17:30, Tue 15:30–16:00 and 17:00–17:30, Wed 09:30–10:00 and 11:30–12:15, Thu 10:00–12:00 (if the numbers are already done) and 14:15–15:30, Fri 13:15–14:00, 14:30–15:30 and 17:00–17:30.

| If this happens | Then |
|-----------------|------|
| Lina says Monday that the export is late, corrections arrive by Tue 14:00 | Board numbers move to Tue 14:00–16:00. Escalations move to Tue 11:00–13:00. |
| Corrections arrive after Tue 14:00 but before Thu 10:00 | Board numbers go in Thu 10:00–12:00, finishing at the deadline with no margin. Wednesday has no 2 h uninterrupted block because of the rehearsal. Finance is told on Monday that this is the fallback. |
| Corrections arrive after Thu 10:00 | The Thu 12:00 deadline cannot be met as described. Finance needs to decide Monday or Tuesday what goes to the board instead. |
| Monday's outline block is eaten | Finish Tue 09:30–11:00 and send a rougher draft. If it still isn't sendable, tell the CEO by Tue 11:00 that it misses the leadership meeting. This is the first item to slip. |
| QA fails the patch | Re-review Thu 14:15–15:30, re-QA Fri morning, deploy Fri 14:00–14:30, last resort 15:30. |
| Product keeps the demo on Wed 15:00 | I cannot attend. It would run without me, three hours after its only rehearsal. That is Product's call, not something I can absorb. |
| Rehearsal finds serious problems | Thu 12:45–15:30 is the only repair time before a Thu 16:00 demo. |

## Meeting load check

No day exceeds the four-hour preference: Mon 0.5 h, Tue 1 h, Wed 1.5 h, Thu up to 2 h, Fri up to 0.5 h. The rehearsal and the demo are counted as meetings.
