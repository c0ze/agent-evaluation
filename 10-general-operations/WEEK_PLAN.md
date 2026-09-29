# Week Plan, Monday to Friday

Built only from `INBOX.md`. The notes contain no calendar dates, so days are named by weekday. Working hours are 09:30-17:30, and nothing is planned outside them. Wednesday from 13:00 is treated as fully unavailable.

Anything marked **(unconfirmed)** depends on a person's availability that the notes do not state. I have not assumed it. The open questions are in `DECISIONS.md`.

## 1. Hard deadlines vs preferences

| Item | Type | Detail |
|---|---|---|
| Renewals escalation response | **Hard** | Monday. About 45 min. Time of day not stated. |
| Two other support escalations | **Hard** | Wednesday SLAs, cut-off times not stated. About 45 min each. Since I am gone after 13:00 Wednesday, I finish both by Tuesday. |
| Board numbers final | **Hard** | Thursday 12:00 ("must"). Needs 2 uninterrupted hours after Lina's corrections. |
| Security patch deployed | **Hard** | Friday 16:00 ("must"). Review (60-90 min), then QA (half day), then a 30 min change window. QA is out Thursday. |
| Demo rehearsal | **Fixed window** | 90 min with Sam. Sam is out Tuesday. The only stated window is Wednesday 10:00-12:00. |
| Customer demo | **Preference** | Wednesday 15:00 preferred, which falls in my unavailable time. Thursday 16:00 is acceptable to the customer. |
| Strategy outline | **Soft ask** | CEO wants it "early this week". 3 focused hours for a first draft. The 14:00 Tuesday cut-off is a condition, and it only matters if the outline is to be reviewed at the Tuesday 16:00 meeting. |
| At most 4 h of meetings per day | **Preference** | The plan stays within it every day (peak is 1.5 h). |
| At least 45 min lunch | **Preference** | Held every day. |

## 2. Dependencies

```
Patch:     review (Mon) -> QA half day (Tue requested; Wed AM fallback; Fri AM last resort; never Thu)
           -> 30 min change window (Wed AM proposed; Fri fallback) -> live by Fri 16:00

Board:     vendor export -> Lina's corrections (by Tue 11:00; she knows Mon 15:00)
           -> my 2 h uninterrupted block (Tue 11:00-13:00) -> final by Thu 12:00

Strategy:  3 h draft (Mon) -> polish and send (Tue AM, cut-off 14:00) -> leadership review Tue 16:00

Demo:      rehearsal with Sam (Wed 10:00-11:30) -> customer demo (Thu 16:00, Product to confirm)

Support:   renewals (Mon) -> escalation 2 (Mon PM) -> escalation 3 (Tue AM) -> Wed SLAs
```

## 3. Day by day

Legend: **FIXED** is an existing commitment. **FOCUS** is a protected work block. **BUFFER** is deliberately unallocated.

### Monday (8 h, meetings 0.5 h)

| Time | What | Type | Notes |
|---|---|---|---|
| 09:30-10:00 | Triage. Send `DRAFT_REPLY.md`. Ask Engineering to book QA. | Admin | The reply goes out first so answers arrive while I work. |
| 10:00-10:30 | Recurring meeting | FIXED | |
| 10:30-11:15 | Renewals escalation response | **FOCUS, hard** | Earliest hard deadline. Done before anything can eat the day. |
| 11:15-12:45 | Security patch review | **FOCUS, hard chain** | Budgeted at the 90 min upper bound. Hand to QA the moment it is done. If it finishes in 60 min, the spare 30 min goes to strategy. |
| 12:45-13:30 | Lunch (45 min) | | |
| 13:30-15:00 | Strategy outline, block 1 | FOCUS | 90 min. |
| 15:00-15:15 | Lina checkpoint | Admin | She will know whether the vendor export is late. Re-plan Tuesday and Thursday now if it is. |
| 15:15-16:45 | Strategy outline, block 2 | FOCUS | The 3 h first draft is complete. |
| 16:45-17:30 | Support escalation 2 (Wed SLA) | BUFFER, spoken for | First thing to bump if Monday overruns. Its fallback is Tuesday 13:45-14:30. |

### Tuesday (8 h, meetings 1 h)

| Time | What | Type | Notes |
|---|---|---|---|
| 09:30-10:15 | Polish and send strategy outline to the CEO | FOCUS | Target 10:15. Cut-off 14:00 for the 16:00 review. |
| 10:15-11:00 | Support escalation 3 (Wed SLA) | FOCUS, hard | After this, both Wednesday SLAs are covered. |
| 11:00-13:00 | **Board numbers, 2 h uninterrupted** | **FOCUS, protected** | Starts when Lina's corrections land. That is expected by 11:00 and possibly earlier, in which case I start earlier. Notifications off. If nothing has arrived by 11:00, chase Lina and use the time on buffer items. |
| 13:00-13:45 | Lunch | | |
| 13:45-15:45 | Reserve | BUFFER | (a) Fallback slot if the corrections land late. A start by about 13:45 still gives 2 clean hours. (b) Finance overflow. (c) Demo environment pre-check. (d) Answering QA questions. (e) Escalation 2 if Monday displaced it. |
| 15:45-16:00 | Skim outline before the meeting | Admin | |
| 16:00-17:00 | Leadership meeting (strategy review) | FIXED | Assumed to be the same as the recurring Tuesday 16:00 meeting. |
| 17:00-17:30 | Capture review actions. Tell Finance the state of the numbers. | Admin | |

QA on the patch is requested to start today. That is unconfirmed.

### Wednesday (available 09:30-13:00 only, 3.5 h)

| Time | What | Type | Notes |
|---|---|---|---|
| 09:30-10:00 | Patch: check QA result. **Proposed** 30 min change window if QA passed Tuesday. | FOCUS | Needs Engineering to confirm the window (unconfirmed). If QA has not passed, this becomes a QA status check only. |
| 10:00-11:30 | **Demo rehearsal with Sam (90 min)** | FIXED | Sam's stated window is 10:00-12:00. |
| 11:30-12:00 | Rehearsal overrun or fixes | BUFFER | Still inside Sam's window. |
| 12:00-12:45 | Lunch | | |
| 12:45-13:00 | Handoff note: patch, demo and board status. Set out-of-office. | Admin | |
| 13:00-17:30 | **Unavailable** | | Nothing planned. |

Wednesday cannot host the 2 uninterrupted finance hours. The rehearsal breaks the morning into 30 min and 90 min pieces, and the afternoon is gone.

### Thursday (8 h, meetings 0.5 h plus demo)

| Time | What | Type | Notes |
|---|---|---|---|
| 09:30-10:00 | Recurring meeting | FIXED | |
| 10:00-12:00 | **Board numbers, protected reserve** | **HARD 12:00** | Normal case: numbers were finished Tuesday, and this is final check and sign-off, leaving slack. Late-corrections case: this is the whole 2 h with zero slack. Do not book anything here. |
| 12:00-12:45 | Lunch | | |
| 12:45-15:15 | Reserve | BUFFER | Feedback from the leadership review, demo prep, spillover. No patch work: QA is out. |
| 15:15-15:45 | Demo pre-flight (environment check) | FOCUS | |
| 15:45-16:00 | Breather | BUFFER | |
| 16:00-17:00 | **Customer demo** | FIXED once confirmed | Length not stated, so I hold 60 min. Depends on Product and the customer confirming. |
| 17:00-17:30 | Debrief and follow-ups | Admin | |

### Friday (8 h)

| Time | What | Type | Notes |
|---|---|---|---|
| 09:30-10:00 | Patch status check | Admin | If deployed, verify. If not, start the fallback path. |
| 10:00-12:00 | Open | BUFFER | Demo follow-ups, strategy revisions, spillover. |
| 12:00-12:45 | Lunch | | |
| 12:45-16:00 | Patch reserve | BUFFER | Fallback: QA Friday morning, then change window. **I want the change window to start no later than 14:30**, to leave 90 min for a retry or rollback before 16:00. |
| 16:00 | **Patch must be live** | **HARD** | |
| 16:00-17:30 | Weekly wrap-up and next-week list | Admin | |

## 4. Contingency triggers

| If | Then |
|---|---|
| Lina says at Monday 15:00 the corrections will be late | Tell Finance and the CEO the same afternoon. Tuesday 13:45-15:45 becomes the finance block (if they arrive by about 13:45). Otherwise Thursday 10:00-12:00 is the only clean window, with zero slack. Ask whether the Thursday 09:30 meeting can be skipped or shortened. |
| The renewals escalation or patch review overruns Monday | Escalation 2 moves to Tuesday 13:45-14:30. Strategy block 2 can shrink and finish Tuesday 09:30. |
| Strategy draft is not ready by Tuesday 14:00 | Send what exists with a "rough draft" label, or ask the CEO to review it at the next meeting. The board numbers do not move. |
| QA has not started by end of Wednesday | Friday becomes the only QA day, with no retry. Tell Engineering and the CEO Wednesday morning, not Friday. |
| QA finds a defect | Fix, then re-QA Wednesday morning (if QA is free) or Friday morning. Friday afternoon carries the change window. |
| Sam or the customer cannot do Thursday 16:00 | Product proposes another slot. I do not commit myself to any slot outside 09:30-17:30 or after 13:00 Wednesday. |

## 5. Contingency space

| Day | Buffer or reserve | Comment |
|---|---|---|
| Monday | 0:45 | Spoken for (escalation 2), and bumpable. |
| Tuesday | 2:00 | Also the finance fallback. |
| Wednesday | 0:30 | Only inside Sam's window. |
| Thursday | 4:45 | Of which 2:00 (10:00-12:00) is protected for the board deadline. |
| Friday | 5:15 | Mostly patch reserve. |

The slack is back-loaded. Only Tuesday afternoon and Thursday 10:00-12:00 can absorb a board-numbers problem. The Thursday and Friday slack protects the patch and the demo, and it comes too late to help the board deadline.

## 6. Checkpoints

- **Monday 15:00:** Lina's vendor status. Re-plan if late.
- **Monday end of day:** did QA get the patch? Is the strategy draft complete?
- **Tuesday 11:00:** did the corrections land?
- **Tuesday 14:00:** hard cut-off for sending the outline.
- **Wednesday 09:30:** QA result.
- **Wednesday 12:45:** handoff note out, since I am unavailable until Thursday.
- **Thursday 12:00:** board numbers final.
- **Friday 14:30:** latest start for the change window.
