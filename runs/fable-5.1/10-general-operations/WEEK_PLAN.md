# Week plan — Monday to Friday

Scope: everything in `INBOX.md`, scheduled inside stated working hours
(09:30–17:30 Mon–Fri; Wednesday 13:00–17:30 unavailable). Every day keeps at
least 45 minutes for lunch and stays well under the four-hour meeting cap.
No availability is assumed for anyone beyond what they stated (me, Sam, QA,
Lina, the customer). Where a slot depends on someone confirming, it says so.

## 1. Deadlines: hard vs. preference

| Item | Type | Cutoff | Notes |
|---|---|---|---|
| Escalation #1 (renewals) | **Hard** | Monday | Stated "needs a response Monday". 45 min. |
| Escalations #2 and #3 | **Hard** | Wednesday (SLA; exact times TBC with Support) | 45 min each. Wednesday afternoon is out, so effectively due by Wed 13:00; the plan closes them Mon/Tue. |
| Board numbers final | **Hard** | Thursday 12:00 | Two uninterrupted hours, after Lina's corrections. |
| Security patch deployed | **Hard** | Friday 16:00 | Chain: my review (60–90 min) → QA half day (QA off Thursday) → 30-min change window. |
| Strategy outline to CEO | Preference with a soft target | "Early this week"; sent by Tue 14:00 = reviewed at the Tue 16:00 leadership meeting | The 14:00 is an opportunity the CEO offered, not a stated deadline. Three focused hours. |
| Customer demo | Preference | Product prefers Wed 15:00; customer can also do Thu 16:00 | Wed 15:00 falls inside my unavailable block. |
| Demo rehearsal | Constraint (dependency) | Wed 10:00–12:00 is Sam's only stated slot | 90 min; Sam must join. |
| Working hours / Wed afternoon | Hard | 09:30–17:30; Wed 13:00–17:30 out | Nothing scheduled outside these. |
| ≤4h meetings/day, ≥45 min lunch | Personal preference | Daily | Honoured every day below. |

## 2. Priority order

1. **Security patch chain, started Monday** (review Mon 11:15–12:45). Longest
   chain, and QA is off Thursday — a one-day slip removes all buffer before
   Friday 16:00.
2. **Board numbers by Thu 12:00.** Protected two-hour block Tue 11:00–13:00
   with two fallbacks; the risk is Lina's vendor export, known Monday 15:00.
3. **Support escalations.** #1 Monday morning (hard, renewals); #2 Monday late
   afternoon, #3 Tuesday — both well ahead of the Wednesday SLA because
   Wednesday morning is already full and Wednesday afternoon is out.
4. **Strategy outline.** Three focused hours Monday afternoon; polish and send
   Tuesday morning (target 11:00, hard stop 13:45). This is the item that
   flexes if a hard deadline slips.
5. **Customer demo.** Rehearse Wed 10:00–11:30; propose Thu 16:00 to the
   customer, because I cannot do Wed 15:00.

## 3. Dependency chains

- Board numbers: vendor export (status Mon 15:00) → Lina's corrections (Tue by
  11:00) → my 2h block → final by Thu 12:00.
- Security patch: my review (Mon) → QA half day (Tue; QA to confirm) → change
  window (Fri 10:00–10:30 default; Engineering to confirm) → deployed by Fri 16:00.
- Demo: demo environment ready → 90-min rehearsal with Sam (Wed 10:00–11:30) →
  demo (Thu 16:00, pending Product/customer confirmation).
- Strategy outline: 3h draft (Mon pm) → polish (Tue am) → send by 14:00 →
  leadership review Tue 16:00.

## 4. Day by day

### Monday — the tightest day; hard items first

| Time | Block | Type |
|---|---|---|
| 09:30–10:00 | Send the team note (`DRAFT_REPLY.md`); put the asks to Product, Sam, Engineering/QA, Lina | Admin |
| 10:00–10:30 | Recurring meeting | Meeting |
| 10:30–11:15 | Escalation #1 (renewals) — response sent | **Hard: Monday** |
| 11:15–12:45 | **Focus:** security patch review (90-min budget) → hand-off notes to QA | Starts the patch chain |
| 12:45–13:30 | Lunch | |
| 13:30–16:30 | **Focus:** strategy outline first draft (3h, notifications off; glance at Lina's status only at the end) | CEO ask |
| 16:30–17:15 | Escalation #2 (Wed SLA) — done early because Wednesday morning is full | Hard: Wed |
| 17:15–17:30 | Act on Lina's 15:00 status: if the export is late, tell Finance today and switch Tuesday to Plan B | Checkpoint |

Meeting time: 0.5h. Contingency on the day: none. If the review or the
escalation overruns, the strategy block shrinks (it continues Tuesday
09:30–11:00 anyway) and escalation #2 moves to Tue 14:30.

### Tuesday

| Time | Block | Type |
|---|---|---|
| 09:30–11:00 | Strategy outline: finish, polish, send to CEO (target 11:00; latest 13:45 to make the 14:00 cut) | CEO ask |
| 11:00–13:00 | **Focus:** board numbers with Lina's corrections — uninterrupted, no meetings, no chat | **Hard chain** |
| 13:00–13:45 | Lunch | |
| 13:45–14:30 | Escalation #3 (Wed SLA) | Hard: Wed |
| 14:30–16:00 | Contingency (90 min): board spillover, QA questions on the patch, edits before leadership | Buffer |
| 16:00–17:00 | Leadership meeting (recurring) — outline reviewed if sent by 14:00 | Meeting |
| 17:00–17:30 | Wrap: QA status on the patch; confirm demo slot with Product/Sam | Admin |

QA runs their half day on the patch Tuesday (needs QA's confirmation; if they
can start Monday afternoon, better — not assumed).
Plan B (corrections land after 11:00 but by 14:00): board block moves to
14:00–16:00; escalation #3 moves to Wed 11:30–12:15.
Meeting time: 1h.

### Wednesday — morning only (13:00–17:30 unavailable)

| Time | Block | Type |
|---|---|---|
| 09:30–10:00 | Check QA result; demo-environment pre-check | Buffer/prep |
| 10:00–11:30 | Demo rehearsal with Sam (90 min) | Constraint: Sam's only slot |
| 11:30–12:15 | Close out escalations #2/#3 (confirm SLAs met), or escalation #3 itself if it moved here under Plan B | Hard: Wed |
| 12:15–13:00 | Lunch (see assumption) | |
| 13:00–17:30 | Unavailable — no demo, no meetings, no change window | Hard |

Assumption: I don't know whether the 13:00–17:30 block already covers lunch,
so 12:15–13:00 is held for it. If lunch is covered by the afternoon block,
12:15–13:00 becomes 45 min of contingency.
Plan C (corrections land Wednesday): there is no two-hour uninterrupted slot on
Wednesday. Board numbers go to Thu 10:00–12:00 with zero margin — Finance needs
to know Tuesday evening at the latest.
Meeting time: 1.5h.

### Thursday

| Time | Block | Type |
|---|---|---|
| 09:30–10:00 | Recurring meeting | Meeting |
| 10:00–12:00 | Board numbers: final check and send to Finance. Also the last-resort 2h block if corrections were late | **Hard: 12:00** |
| 12:00–12:45 | Lunch | |
| 12:45–14:00 | Patch: confirm QA sign-off, walk through deploy/rollback with Engineering. If QA found issues: my re-review here (75 min) | Patch chain |
| 14:00–15:30 | Demo prep; short run-through with Sam only if Sam is free (not assumed) | Demo |
| 15:30–16:00 | Buffer | Buffer |
| 16:00–17:30 | Customer demo (proposed; length TBC with Product; must end by 17:30) | Pending confirmation |

If the board numbers were finished Tuesday, 10:30–12:00 becomes contingency.
Meeting time: 0.5h + demo (≤1.5h) = ≤2h.

### Friday

| Time | Block | Type |
|---|---|---|
| 09:30–10:00 | Pre-deploy check with Engineering/QA | Patch chain |
| 10:00–10:30 | Change window — security patch deploy (default slot; Engineering to confirm) | **Hard: by 16:00** |
| 10:30–12:30 | Post-deploy verification / contingency (if a QA re-test is needed, QA runs it 09:30–13:00) | Buffer |
| 12:30–13:15 | Lunch | |
| 13:15–14:00 | Demo follow-ups to Product/customer | Demo |
| 14:00–14:30 | Fallback change window (held; last-safe start 15:00) | Contingency |
| 14:30–16:00 | Contingency: anything that slipped; strategy outline v2 from leadership feedback | Buffer |
| 16:00–17:30 | Week wrap-up, next-week notes | Admin |

Meeting time: 0.5h.

## 5. Contingency map

| If… | Then… | Who needs to know, when |
|---|---|---|
| Lina says Mon 15:00 the export is late, corrections by Tue 14:00 | Board block → Tue 14:00–16:00; escalation #3 → Wed 11:30 | Finance, Lina — Monday evening |
| Corrections land Wednesday | Board block → Thu 10:00–12:00, no margin; ask Finance whether a preliminary set on Wednesday helps | Finance, Lina — Tuesday evening |
| Corrections land after Wednesday | Thu 12:00 is at risk; Finance decides what "final" means and what can go to the board | Finance, CEO — immediately |
| QA finds issues in the patch | Engineering fix Wed; my re-review Thu 12:45–14:00; QA re-test Fri 09:30–13:00; change window Fri 14:00–14:30 | Engineering, QA — same day |
| QA can't do Tuesday | Wednesday is the only other pre-Friday day (QA off Thu); if QA slips to Friday morning the deploy is 14:00 with no re-test loop | Engineering — Monday |
| Customer can't do Thu 16:00 | Wed 15:00 only works without me; otherwise it moves to next week — Product's call | Product, Sam — Monday |
| Sam can't make Wed 10:00 | No stated alternative; the rehearsal has no other slot this week, so the demo date moves | Product, Sam — Monday |
| Strategy draft not ready by Tue 13:45 | Send Wednesday morning for async review; ask the CEO whether the next leadership meeting is acceptable | CEO — Tuesday 13:45 |
| Monday overruns | Strategy block shrinks; escalation #2 → Tue 14:30 | — |

## 6. Load summary

| Day | Working time | Meetings | Committed work | Buffer |
|---|---|---|---|---|
| Mon | 8h | 0.5h | 6.75h | 0 (flex via the strategy block) |
| Tue | 8h | 1h | 4.75h | 1.5h |
| Wed | 3.5h | 1.5h (rehearsal) | 1.25h | 0 (0.75h if lunch sits in the afternoon block) |
| Thu | 8h | 0.5h + demo ≤1.5h | 4.75h | 0.5h (+1.5h if board numbers were done Tuesday) |
| Fri | 8h | 0.5h | 2.75h | 4h |

Buffer across the week is about six hours, rising to eight if Tuesday goes to
plan. It is weighted to the back half on purpose: the hard deadlines are
front-loaded, and each one's fallback lands Thursday or Friday.
