# Week Plan (Monday–Friday)

Working hours: 09:30–17:30 Mon–Fri. **Wednesday 13:00–17:30 unavailable (hard).**
Preferences honored: ≤4h meetings/day, ≥45 min lunch daily.

Legend: **[H]** hard deadline · **[S]** soft/preferred · **[C]** contingency block · **[DEP]** depends on someone else

## Key placement decisions (why things sit where they do)

1. **Demo moves to Thursday 16:00 [S→confirmed slot].** Product prefers Wed 15:00, but I am
   unavailable Wed 13:00–17:30. I will not invent availability, so we use the customer's stated
   alternative: Thursday 16:00. Needs product/customer confirmation (see DECISIONS.md Q1).
2. **Rehearsal Wed 10:00–11:30.** Sam is unavailable Tuesday and can only rehearse Wed
   10:00–12:00; the demo needs 90 minutes, so this single window is used in full. It is
   immovable — there is no second overlap with Sam.
3. **Security patch chain starts Monday** so QA (unavailable Thursday) never lands on Thursday
   and deployment finishes ~2 days before the Friday 16:00 hard deadline:
   review Mon 10:30–12:00 → QA Tue 09:30–13:30 [DEP QA team] → change window Wed 09:30–10:00.
4. **Board numbers Tue 11:00–13:00**, immediately after Lina's corrections arrive (by 11:00)
   [DEP Lina]. Two uninterrupted hours, no meetings booked around it. Finalized ~2 days before
   the Thursday 12:00 hard deadline.
5. **Strategy draft Mon 13:30–16:30** (3 focused hours), sent Monday EOD — beats the Tuesday
   14:00 soft cutoff so the Tuesday 16:00 leadership meeting can review it.
6. **Escalations:** renewals response Monday (hard); the two Wednesday-SLA escalations are done
   Tuesday, one day early, keeping Wednesday (already short) light.

## Monday — theme: unblock the week (meetings: 0.5h)

| Time | Block |
|---|---|
| 09:30–10:00 | Triage; ping QA to reserve Tue 09:30–13:30; ping Sam to confirm Wed 10:00–11:30 rehearsal |
| 10:00–10:30 | Recurring meeting |
| 10:30–12:00 | **Security patch review (90 min)** — gates QA [H chain → Fri 16:00] |
| 12:00–12:45 | **Renewals escalation response [H — due Monday]** |
| 12:45–13:30 | Lunch |
| 13:30–16:30 | **Focus: strategy draft (3h uninterrupted)** [S — "early this week"] |
| 16:30–17:00 | Send strategy to CEO; **check in with Lina — she knows vendor-export status by 15:00 [DEP]** |
| 17:00–17:30 | [C] Buffer |

*Decision point 15:00+: if Lina says the vendor export is late, activate Tuesday contingency below.*

## Tuesday — theme: protected deep work (meetings: 1h)

| Time | Block |
|---|---|
| 09:30–10:15 | Escalation #2 (45 min) — Wednesday SLA, done early [H] |
| 10:15–11:00 | [C] Buffer; confirm corrections landed with Lina |
| 11:00–13:00 | **Board numbers finalization (2h uninterrupted)** [H Thu 12:00] [DEP Lina ≤11:00] |
| 13:00–13:45 | Lunch |
| 13:45–14:30 | Escalation #3 (45 min) — Wednesday SLA [H] |
| 14:30–16:00 | [C] Contingency: patch-review fixes, board-number overflow, demo logistics |
| 16:00–17:00 | Leadership meeting (strategy draft under review) |
| 17:00–17:30 | Confirm demo at Thu 16:00 with product/customer |

**Tuesday contingency (if vendor export late):** corrections arrive Tue afternoon → board block
moves to Tue 14:30–16:30 (or, worst case, Wed 11:30–13:00 partial + Thu 10:00–12:00 finish —
zero slack, escalate per DECISIONS.md Q3). QA runs 09:30–13:30 regardless (team task).

## Wednesday — theme: demo readiness + deploy (meetings: 2h; day ends 13:00)

| Time | Block |
|---|---|
| 09:30–10:00 | **Security patch change window (30 min)** — deployed 2 days before Fri 16:00 [H] |
| 10:00–11:30 | **Demo rehearsal with Sam (90 min)** [DEP Sam — only possible window] |
| 11:30–12:15 | [C] Contingency: QA findings fix window, or Thu-16:00 demo confirmation follow-up |
| 12:15–13:00 | Lunch |
| 13:00–17:30 | **UNAVAILABLE** — nothing scheduled; no demo possible (drives Thu 16:00 choice) |

## Thursday — theme: deadlines + demo (meetings: 1.5h; QA unavailable — nothing QA-dependent)

| Time | Block |
|---|---|
| 09:30–10:00 | Recurring meeting |
| 10:00–12:00 | Safety net for board numbers (should be done Tuesday) — **hard deadline 12:00 [H]**; if free, use as focus/contingency |
| 12:00–12:45 | Lunch |
| 12:45–15:00 | [C] Contingency / focus: demo materials, overflow from the week |
| 15:00–15:45 | Demo prep with product |
| 16:00–17:00 | **Customer demo (moved from Wed 15:00)** — assumed 60 min, confirm length (Q1) |
| 17:00–17:30 | Buffer |

## Friday — theme: verify + recover (meetings: 0h)

| Time | Block |
|---|---|
| 09:30–12:00 | Verify patch in production; post-deploy checks [H — deploy must hold by 16:00] |
| 12:00–12:45 | Lunch |
| 12:45–15:00 | [C] Catch-all: anything slipped this week lands here; leftover escalation follow-ups |
| 15:00–16:00 | Final confirmation: patch deployed & stable → **Friday 16:00 hard deadline closed [H]** |
| 16:00–17:30 | Weekly review; draft next week's plan |

## Dependency chain summary

- Lina corrections (Tue ≤11:00, risk known Mon 15:00) → board numbers 2h (Tue 11:00) → **finance Thu 12:00 [H]**
- My patch review (Mon 10:30) → QA half-day (Tue, not Thu) → change window (Wed 09:30) → **deploy Fri 16:00 [H]**
- Sam (Wed 10:00–12:00 only) → rehearsal (Wed 10:00–11:30) → demo (Thu 16:00, pending confirmation)
- Strategy draft (Mon 13:30) → send Mon EOD → leadership review (Tue 16:00) [S: Tue 14:00 cutoff]

## Deadline classification

| Item | When | Type |
|---|---|---|
| Renewals escalation response | Monday | **Hard** |
| Two escalations (SLA) | Wednesday | **Hard** |
| Board numbers final | Thu 12:00 | **Hard** |
| Security patch deployed | Fri 16:00 | **Hard** |
| Strategy outline to CEO | "early this week" | Soft (preference) |
| Strategy sent for leadership review | Tue 14:00 | Soft (opportunity, met Mon EOD) |
| Demo at Wed 15:00 | Wed 15:00 | Soft (preference — **infeasible**, conflicts with hard unavailability) |
| Demo at Thu 16:00 | Thu 16:00 | Customer-offered alternative (proposed new slot) |
| Wed 13:00–17:30 unavailable; QA out Thu; Sam out Tue; ≤4h meetings/day; ≥45 min lunch | — | Hard constraints |

## Contingency space (deliberately unscheduled)

Mon 17:00–17:30 · Tue 10:15–11:00 + 14:30–16:00 · Wed 11:30–12:15 · Thu 10:00–12:00 +
12:45–15:00 · Fri 12:45–15:00 ≈ **9 hours** of slack across the week for slips.
