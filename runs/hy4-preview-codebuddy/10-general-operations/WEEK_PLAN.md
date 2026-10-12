# Week Plan — Monday to Friday

## Ground rules I am holding to

- Working hours 09:30–17:30, Mon–Fri.
- **Wednesday 13:00–17:30 is unavailable.** Nothing is scheduled in it.
- Lunch: at least 45 minutes every day, blocked, not borrowed.
- No more than 4 hours of meetings/interaction in any day. Worst day below is
  Wednesday at 3h00.
- I have not assumed availability that was not stated. Where a slot depends on
  someone whose calendar I do not have (Sam on Thursday, QA on Wednesday
  afternoon), it is marked **UNCONFIRMED** and has a fallback.

## Hard deadlines vs. preferences

| Item | Type | When |
|---|---|---|
| Board numbers final | **Hard** (external) | Thursday 12:00 |
| Security patch deployed | **Hard** (stated "must") | Friday 16:00 |
| Renewals escalation response | **Hard** (committed, revenue) | Monday |
| Two support escalations | **Hard** (SLA) | Wednesday |
| Lina's corrections | **Hard-ish** — dependent on vendor export, confirmed Mon 15:00 | Tuesday 11:00 |
| Customer demo Wed 15:00 | **Preference** — and impossible for me (inside Wed unavailable block) | → moved |
| Customer demo Thu 16:00 | **Preference**, but the only slot that works | Thursday 16:00 |
| CEO strategy outline "early this week" | **Preference**, no stated consequence | Monday PM, sent Tue 10:00 |
| Strategy before Tue 16:00 leadership meeting (send by 14:00) | **Preference** (opportunity, not obligation) | met with ~4h to spare |

## Dependency chains

1. **Security patch:** my review (60–90 min) → QA half day → 30-min change
   window → deploy by Friday 16:00. QA is unavailable Thursday, so the chain
   must be review-by-Monday / QA-Wednesday / window-Friday. Anything later puts
   QA into Friday morning and the deploy on the deadline with no slack.
2. **Board numbers:** Lina's corrections (Tue 11:00, vendor-export dependent)
   → my 2 uninterrupted hours → final by Thursday 12:00. Earliest possible
   completion is Tuesday 13:00; that leaves ~47h of buffer.
3. **Customer demo:** Sam's rehearsal slot (only Wed 10:00–12:00) → demo. The
   demo cannot be Wednesday afternoon for me, so Thursday 16:00 is the only
   viable slot. Rehearsal Wednesday morning, demo Thursday afternoon.
4. **Strategy outline:** 3 focused hours → optional review at Tuesday 16:00
   leadership meeting if sent by 14:00.

---

## Monday — protect the longest chain, clear the committed response

| Time | Item | Notes |
|---|---|---|
| 09:30–10:00 | Triage, confirm vendor-export status request with Lina, day setup | |
| 10:00–10:30 | Recurring meeting | fixed |
| 10:30–11:15 | **Support escalation #1 — renewals** | hard: response Monday. 45 min |
| 11:15–12:45 | **Security patch review** | 90 min. Gates QA — must land today |
| 12:45–13:30 | Lunch | 45 min |
| 13:30–16:30 | **CEO strategy outline** — 3 focused hours | deep block, notifications off |
| 16:30–17:30 | Admin, follow-ups, 15:00 Lina decision point acted on, prep Tuesday | |

Meetings: 0h30. Contingency: 16:30–17:30 (1h).

**15:00 decision point:** Lina confirms whether the vendor export is on time.
If late, the Tuesday finance block moves to Thursday 10:00–12:00 (see Thursday).

## Tuesday — board numbers the moment corrections land

| Time | Item | Notes |
|---|---|---|
| 09:30–10:00 | Finish and send strategy outline | sent 10:00, well before the 14:00 cutoff |
| 10:00–11:00 | Board-numbers prep: templates, files, figures staged | so the next block is pure work |
| 11:00–13:00 | **Board numbers — 2 uninterrupted hours** | starts on Lina's corrections (target 11:00) |
| 13:00–13:45 | Lunch | 45 min |
| 13:45–16:00 | Deep work: board-number QA pass, demo prep, overflow | |
| 16:00–17:00 | Leadership meeting | fixed; strategy sent in time for review |

Meetings: 1h00. Contingency: 13:45–16:00 (2h15).
If corrections land after 11:00, the block slides by the delay, up to 13:15
(lunch shifts 15 min). Past ~12:00 delay, Thursday 10:00–12:00 takes over.

## Wednesday — rehearse and clear the Wednesday SLAs (morning only)

| Time | Item | Notes |
|---|---|---|
| 09:30–10:00 | Rehearsal prep | |
| 10:00–11:30 | **Demo rehearsal with Sam** | 90 min. Sam's only possible slot |
| 11:30–12:15 | **Support escalation #2** | Wednesday SLA. 45 min |
| 12:15–13:00 | **Support escalation #3** | Wednesday SLA. 45 min |
| 13:00–13:45 | Lunch | |
| 13:00–17:30 | **Unavailable — nothing scheduled** | QA runs their half day here (UNCONFIRMED) |

Meetings/interaction: 3h00 — under the 4h cap.
No contingency left today; if an escalation overruns it spills into Thursday
10:00–12:00 and the board-numbers buffer absorbs it.

## Thursday — hold the fallback slot, then the demo

| Time | Item | Notes |
|---|---|---|
| 09:30–10:00 | Recurring meeting | fixed |
| 10:00–12:00 | **HOLD — board numbers** (only if corrections slipped) or QA-failure triage | contingency block |
| **12:00** | **Board numbers final — hard deadline** | |
| 12:00–12:45 | Lunch | 45 min |
| 12:45–15:30 | Deep work: patch readiness check with Engineering, change-window prep | |
| 15:30–16:00 | Demo tech check | |
| 16:00–17:00 | **Customer demo** (Thursday slot) | UNCONFIRMED: Sam's availability |
| 17:00–17:30 | Demo notes and follow-ups | |

Meetings: 1h30.
If corrections slipped, 10:00–12:00 is the last window before the 12:00
deadline — zero slack. That is why Monday 15:00 matters.

## Friday — deploy with real slack, keep the morning open for QA

| Time | Item | Notes |
|---|---|---|
| 09:30–12:30 | **Open engineering time** — QA overflow / patch fixes if needed | QA cannot do Thursday, so this is the last slot |
| 12:30–13:15 | Lunch | 45 min |
| 13:15–14:00 | Go/no-go check with Engineering | |
| 14:00–14:30 | **Change window — deploy security patch** | 30 min |
| 14:30–16:00 | Verification + buffer before the 16:00 deadline | 1h30 of slack |
| **16:00** | **Patch deployed — hard deadline** | met with 1h30 to spare |
| 16:00–16:45 | Week wrap, carry-over list | |
| 16:45–17:30 | Buffer | |

Meetings: ~0h30.

## Contingency space, totalled

- Monday 16:30–17:30 (1h)
- Tuesday 13:45–16:00 (2h15)
- Thursday 10:00–12:00 (2h) — reserved, released only if needed
- Friday 09:30–12:30 (3h) — reserved for QA overflow
- Friday 14:30–16:00 (1h30) — buffer in front of the deploy deadline
- Total ~9h45 of uncommitted or reserved slack.

## What breaks this plan

1. Lina's corrections arrive later than Tuesday ~12:00 → board numbers have
   no slack before Thursday 12:00.
2. QA cannot take Wednesday afternoon, or needs me present during QA → the
   patch chain compresses into Friday morning with no recovery room.
3. Sam cannot do Thursday 16:00 → the demo has no remaining slot this week.
4. A new urgent item lands on Wednesday morning, which has no contingency.
