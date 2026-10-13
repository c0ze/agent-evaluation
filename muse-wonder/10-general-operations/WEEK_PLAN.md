# Week Plan — Monday to Friday

**Working hours:** 09:30–17:30 Mon–Fri. **Unavailable:** Wednesday 13:00–17:30.
**Preferences honoured:** lunch ≥45 min daily; ≤4 h meetings/day. Lunch on Wednesday is taken from 13:00 in the unavailable block so the short morning is not eroded.
**Legend:** 🔴 hard deadline · 🟡 preference / opportunity · ⚠️ dependency

## Priority order

1. 🔴 Board numbers — final Thu 12:00 (Finance)
2. 🔴 Security patch — deployed Fri 16:00 (Engineering, serial chain)
3. 🟡 Strategy outline for Tue 16:00 leadership — send by Tue 14:00 (CEO)
4. 🔴 Support escalations — renewal Mon; two by Wed SLA
5. 🟡 Customer demo — Thu 16:00 (Wed 15:00 preference impossible, see Decisions)

---

## Monday — protect Tuesday

| Time | Block | Notes |
|---|---|---|
| 09:30–10:00 | Triage & confirmations | Send the questions in `DECISIONS.md` (Lina, Product/Sam, QA). |
| 10:00–10:30 | Recurring meeting | Fixed. |
| 10:30–11:15 | 🔴 Renewal escalation (45 min) | The one support item due Monday. Do first, do not defer. |
| 11:15–12:45 | Strategy draft — focus block 1 of 2 (90 min) | Three focused hours total; front-load today. |
| 12:45–13:30 | Lunch (45 min) | |
| 13:30–15:00 | Strategy draft — focus block 2 of 2 (90 min) | Draft complete in substance by 15:00. |
| 15:00 | ⚠️ Decision point: Lina update | Lina confirms whether vendor export is late. Triggers contingency below. |
| 15:00–16:30 | 🔴 Security patch review (90 min, max estimate) | Start Mon so QA is not pushed to Fri. If review finishes in 60 min, release 30 min to contingency. |
| 16:30–17:30 | Contingency / overflow | Polish strategy, prep Tue finance inputs, or absorb review overrun. No new commitments. |

**Deadlines Mon:** renewal escalation. **Meetings:** 0.5 h.

## Tuesday — finance anchor + leadership

| Time | Block | Notes |
|---|---|---|
| 09:30–10:30 | Strategy final polish & send prep (60 min) | Send deadline is 14:00; finish before finance block starts. |
| 10:30–11:00 | Buffer / escalation #2 start if ahead | Do not start anything that breaks the 11:00 finance block. |
| 11:00 | ⚠️ Lina corrections due | Dependency for finance block. |
| 11:00–13:00 | 🔴 Board numbers — 2 h uninterrupted (Finance) | Phone/notifications off. This is the block Finance asked for. |
| 13:00–13:45 | Lunch (45 min) | Delayed by finance block; protected. |
| 13:45–14:00 | Send strategy outline | 🟡 Meets Tue 14:00 leadership-review condition. |
| 14:00–14:45 | Support escalation #2 (45 min) | Ahead of Wed SLA; moved here because Wed morning cannot hold everything. |
| 14:45–15:30 | Support escalation #3 (45 min) | Ahead of Wed SLA. If finance overran, this pair slips to Wed 09:30 — see contingency. |
| 15:30–16:00 | Contingency / leadership prep | |
| 16:00–17:00 | Leadership meeting (recurring slot) | Strategy reviewed here if sent by 14:00. |
| 17:00–17:30 | Wrap-up, handover notes to QA | Confirm QA has everything from Monday's review. |

**Deadlines Tue:** strategy sent 14:00; leadership 16:00. **Meetings:** 1 h.
**Dependency chain:** Lina 11:00 → finance 11:00–13:00 → board final Thu 12:00.

## Wednesday — short day, rehearsal only

Available 09:30–13:00 only (3.5 h).

| Time | Block | Notes |
|---|---|---|
| 09:30–10:00 | Demo prep / escalation overflow slot | Only used if Tue escalations slipped. Otherwise demo prep. |
| 10:00–11:30 | Demo rehearsal with Sam (90 min) | ⚠️ Sam available Wed 10:00–12:00 only slot offered; Sam unavailable Tue. |
| 11:30–12:15 | Rehearsal fixes / escalation overflow | Fix rehearsal blockers while Sam is still available until 12:00. |
| 12:15–13:00 | Contingency / handover | Notes for Thu demo; confirm Thu demo environment owner. |
| 13:00–17:30 | **Unavailable** | 🔴 Customer demo **cannot** be Wed 15:00 — moved to Thu 16:00. |

**Deadlines Wed:** two support SLAs — planned for completion Tue afternoon, Wed 09:30 is the fallback, not the plan. **Meetings:** 1.5 h rehearsal.

## Thursday — board deadline, then demo

| Time | Block | Notes |
|---|---|---|
| 09:30–10:00 | Recurring meeting | Fixed. |
| 10:00–12:00 | 🔴 Board numbers — final check & send | Hard deadline **12:00**. Tue block did the work; this is verification, contingency for Lina-late case lives here (see below). |
| 12:00–12:45 | Lunch (45 min) | |
| 12:45–14:30 | Contingency (held empty) | Absorbs board overrun, rehearsal fixes, or demo prep. Do not book in advance. |
| 14:30–15:30 | Demo preparation | Environment check ahead of 16:00. |
| 16:00–17:00 | 🟡 Customer demo (Thu fallback) | Duration assumed 60 min — **unconfirmed**, see Decisions. Wed 15:00 preference not possible. |
| 17:00–17:30 | Demo follow-up notes | |

**Deadlines Thu:** board numbers 12:00 🔴. QA unavailable Thu — no QA work scheduled today. **Meetings:** ~1.5 h.

## Friday — deploy with buffer

| Time | Block | Notes |
|---|---|---|
| 09:30–11:00 | QA follow-up / patch readiness | ⚠️ QA half-day must already be done (Wed planned). Confirm change-window owner and rollback. |
| 11:00–12:30 | Contingency (held empty) | Last buffer before deploy. |
| 12:30–13:15 | Lunch (45 min) | |
| 13:15–14:00 | Pre-deploy checks | |
| 14:00–14:30 | Change window (30 min) | Timed to finish well before 16:00; exact slot to confirm with Engineering. |
| 14:30–16:00 | Deploy monitoring & verification | 🔴 Deployed by **16:00**. |
| 16:00–17:30 | Close-out, notes, week review | No new work after a deploy. |

**Deadlines Fri:** security patch deployed 16:00 🔴. **Meetings:** 0.5 h change window.

---

## Dependencies

```
Lina corrections (Tue 11:00) ──► Finance 2h (Tue 11:00–13:00) ──► Board final (Thu 12:00)
Strategy draft (Mon 3h + Tue polish) ──► Send (Tue 14:00) ──► Leadership (Tue 16:00)
Your patch review (Mon 15:00–16:30) ──► QA half-day (Wed, not Thu) ──► Change window (Fri 14:00) ──► Deploy (Fri 16:00)
Sam + you rehearsal (Wed 10:00–11:30) ──► Demo (Thu 16:00)
Renewal escalation ──► Mon only (no dependency)
```

## Contingency space & triggers

| Trigger | Response |
|---|---|
| Mon 15:00 — Lina says vendor export is late | Finance block slides from Tue 11:00; Thu 10:00–12:00 (already held) becomes the working block, Tue 11:00–13:00 converts to escalations/security. Escalate Thu 12:00 risk to Finance the same day, do not wait. |
| Finance Tue block overruns past 13:00 | Lunch shifts, escalations #2/#3 move to Wed 09:30 + Tue 15:30 slot; strategy send at 14:00 is not moved. |
| Patch review overruns 90 min or finds blockers | QA still starts Wed (partial handover Mon/Tue), Fri 11:00–12:30 contingency absorbs re-review; Thu is unusable for QA. |
| Wed rehearsal surfaces demo blockers | Thu 12:45–14:30 contingency is the fix window; if unfixable, Product owns customer comms — do not promise Wed. |
| Anything new arrives | It takes Fri 11:00–12:30 or Thu 12:45–14:30 contingency first; hard deadlines above are not traded away silently. |

Held contingency: Mon 16:30–17:30, Tue 15:30–16:00, Wed 12:15–13:00, Thu 12:45–14:30, Fri 11:00–12:30.

## Hard deadlines vs preferences

| Item | Type |
|---|---|
| Board numbers Thu 12:00; patch Fri 16:00; renewal escalation Mon; two escalations Wed SLA; Lina Tue 11:00 | 🔴 Hard (as stated) |
| Strategy sent Tue 14:00 for Tue 16:00 review | 🟡 Opportunity — miss it and leadership review slips, but no external breach |
| Demo Wed 15:00 | 🟡 Preference — impossible (unavailable Wed afternoon); Thu 16:00 offered alternative used |
| "Early this week" strategy; ≤4 h meetings/day; 45-min lunch | 🟡 Preferences — honoured in this plan |
