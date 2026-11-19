# Week Plan (Mon–Fri)

## Operating constraints (do not silently override)
- Working hours **09:30–17:30**, Mon–Fri.
- **Wednesday 13:00–17:30 unavailable** — only 09:30–13:00 (3.5 h) is bookable.
- Lunch ≥ 45 min every day (placed 12:15–13:00 or 12:30–13:15 below).
- Meetings ≤ 4 h/day (all days are well under this).
- HARD deadlines are marked **[HARD]**; preferences/opportunities are marked **[soft]**.

## Priorities (reasoning in RESPONSE.md)
1. Finance board numbers — **[HARD]** Thu 12:00, blocked by Lina's corrections.
2. Security patch — **[HARD]** Fri 16:00, multi-step chain (my review → QA → change window).
3. Support escalations — **[HARD]** renewal Mon, two SLAs Wed, direct customer/revenue impact.

Demo rehearsal and CEO strategy are protected as *dependency-critical / flexible* work, not because they are loose, but because their windows are narrow and movable.

---

## Dependency map
| Item | Must happen after | Must be done by |
|---|---|---|
| Board numbers (2 h) | Lina corrections (Tue ≤11:00) | **Thu 12:00 [HARD]** |
| Security QA (½ day) | My review (60–90 min) | Before change window; QA unavailable Thu |
| Change window (30 min) | QA complete | **Fri 16:00 [HARD]** |
| Demo | 90-min rehearsal with Sam | Thu 16:00 (confirmed slot) |
| Rehearsal | Sam available | Wed 10:00–12:00 only |
| Strategy review at leadership | Draft sent | Tue 14:00 [soft] |

---

## Monday
- 10:00–10:30 — Recurring meeting (30 min).
- 10:30–11:15 — **Renewal escalation response [HARD, today]**.
- 11:15–12:15 — Strategy draft focus block (1 h) **[soft]**.
- 12:15–13:00 — Lunch (45 min).
- 13:00–15:00 — Strategy draft focus block (2 h) → **3 h total, draft complete**.
- 15:00 — Check Lina on vendor-export / corrections status (she confirms by today 15:00).
- 15:15–16:30 — **Security patch review (75 min)** → unblocks QA.
- Meetings: 0.5 h. Lunch: 45 min.

## Tuesday
- Corrections expected by 11:00 (dependency; confirm Monday 15:00).
- 09:30–11:00 — Buffer / prep; refine strategy wording before 14:00 send.
- 11:00–13:00 — **Board numbers: 2 uninterrupted hours [HARD]**.
- 13:00–13:45 — Lunch (45 min).
- 13:45–14:00 — **Send strategy draft to leadership [soft opportunity]**.
- 14:00–14:45 — Support escalation #2 (one of the two Wed-SLA items pulled forward).
- 14:45–16:00 — Contingency / follow-ups (kept free in case Tuesday corrections are late).
- 16:00–17:00 — Leadership meeting (recurring) — can review strategy.
- (QA team runs the half-day security QA today, after Monday's review; no conflict with my calendar.)
- Meetings: 1 h. Lunch: 45 min.

## Wednesday (only 09:30–13:00 available)
- 10:00–11:30 — **Demo rehearsal, 90 min, Sam joins** ( Sam free 10:00–12:00 only).
- 11:30–12:15 — Support escalation #3 (remaining Wed-SLA item).
- 12:15–13:00 — Lunch (45 min).
- 09:30–10:00 — Short prep/context check before rehearsal.
- **13:00 onward unavailable — no work scheduled.**
- Meetings: rehearsal 1.5 h. Lunch: 45 min.
- Note: one Wednesday-SLA item was pulled to Tuesday because Wednesday only has 3.5 h.

## Thursday
- 09:30–10:00 — Recurring meeting (30 min).
- 10:00–11:00 — Final board-numbers confirmation / buffer before 12:00 **[HARD]**.
- 11:00–12:00 — Board numbers locked **[HARD 12:00]**; wrap with Finance.
- 12:30–13:15 — Lunch (45 min).
- 13:15–16:00 — Open block: demo-env final check, follow-ups, contingencies.
- 16:00–17:00 — **Customer demo (confirmed slot)**.
- Meetings: 1.5 h. Lunch: 45 min.

## Friday
- 09:30–11:00 — Weekly wrap, support follow-ups, notes.
- 12:30–13:15 — Lunch (45 min).
- 14:00–14:30 — **Change window: deploy security patch (30 min)** → complete well before 16:00 **[HARD]**.
- 14:30–16:00 — Buffer / final check that deploy is healthy before deadline.
- Meetings: 0 h. Lunch: 45 min.

---

## Contingency space
- **If Lina's corrections are late** (vendor export): decided by Monday 15:00. Fallback is to run the 2-h board block Tue 14:45–16:00 + Thu 10:00–12:00; still beats Thu 12:00. Escalate to Finance on Monday if even this is at risk.
- **If security review runs long**: Monday 16:30 is the cap; QA then shifts to Wed morning (Sam/rehearsal is the only fixed Wed item) and the Fri change window stays at 14:00.
- **If demo must stay Wednesday**: impossible — Wed 15:00 is inside the unavailable window. Thursday 16:00 is the fallback already built in; Product must confirm customer availability.
- Unused open blocks (Tue 14:45–16:00, Thu 13:15–16:00, Fri 14:30–16:00) are deliberate slack, not idle time to fill.

## What is NOT assumed
- No availability is invented outside 09:30–17:30 or on Wednesday afternoon.
- The 4-h meeting cap and 45-min lunch are honored as personal working agreements.
