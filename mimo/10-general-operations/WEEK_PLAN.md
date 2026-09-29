# Week Plan — Monday to Friday

## Ground rules (stated, not invented)

- Working hours: **09:30–17:30**, Monday–Friday.
- **Wednesday 13:00–17:30 is unavailable** — do not schedule work then.
- Preference: **≤ 4 hours of meetings per day**; **≥ 45 minutes for lunch**.
- Hard deadlines are marked **[HARD]**. Preferences and opportunities are marked **[SOFT]**.
- No availability invented for other people beyond what the notes state.

## Deadline register

| Item | When | Type | Owner dependency |
|---|---|---|---|
| Support escalation (renewal) response | Monday | **[HARD]** | You |
| Two support escalations | Wednesday SLA | **[HARD]** | You (can be done earlier) |
| Strategy outline first draft (3h work) | “Early this week” | **[SOFT]** | You |
| Send strategy for leadership review | Tue 14:00 for 16:00 meeting | **[SOFT]** opportunity | You |
| Lina corrections arrive | Tue by 11:00 (may slip) | Input | Lina; vendor export |
| Lina will know if export is late | Monday 15:00 | Input | Lina |
| Board numbers final | Thursday 12:00 | **[HARD]** | You + Lina corrections + 2h focus |
| Customer demo | Preferred Wed 15:00; alt Thu 16:00 | **[SOFT]** preference | Customer, Product, Sam |
| Demo rehearsal (90 min, Sam joins) | Sam free Wed 10:00–12:00 only | Gate for demo | Sam |
| Security patch deploy | Friday 16:00 | **[HARD]** | You review → QA half-day → 30-min change window |
| QA blackout | Thursday | Constraint | QA |

## Dependency chains

1. **Board numbers:** Lina corrections (Tue ≤11:00, status known Mon 15:00) → **2 uninterrupted hours** with you → finalize before **Thu 12:00 [HARD]**. If corrections slip, use Wednesday morning and Thursday 10:00–12:00 as catch-up — still must land before Thu 12:00.
2. **Security patch:** Your review (60–90 min) → QA half-day *after* review → 30-min change window → live by **Fri 16:00 [HARD]**. QA cannot work Thursday, so QA must run Mon–Wed or Fri. Review early in the week to keep Friday from becoming a single-point-of-failure day.
3. **Customer demo:** 90-min rehearsal with Sam → demo slot. Sam is only free **Wed 10:00–12:00**. Preferred demo **Wed 15:00 collides with your Wednesday afternoon blackout** — the realistic slot is **Thu 16:00** (confirm with customer; do not assume).
4. **Strategy outline:** 3 focused hours → (optional) send by Tue 14:00 for the Tue 16:00 leadership review. Completing it Monday removes pressure from the board-numbers day.

---

## Monday (09:30–17:30)

| Time | Block | Type | Notes |
|---|---|---|---|
| 09:30–10:00 | Strategy outline — focus block 1 | Deep work | Part of required 3h |
| 10:00–10:30 | Recurring meeting | Meeting | Fixed |
| 10:30–11:15 | **Support escalation (renewal)** | **[HARD] today** | 45 min; response must go out Monday |
| 11:15–12:00 | Strategy outline — focus block 2 | Deep work | |
| 12:00–12:45 | Lunch | Break | 45 min |
| 12:45–14:30 | Strategy outline — focus block 3 | Deep work | Completes 3h total |
| 14:30–15:00 | **Lina status check** | Deadline touchpoint | She knows by 15:00 if vendor export is late |
| 15:00–16:30 | **Security patch review** (60–90 min) | Gate for Fri [HARD] | Start the review→QA→deploy chain |
| 16:30–17:15 | Support escalation #2 | **[HARD] Wed SLA** (done early) | 45 min |
| 17:15–17:30 | Day wrap / email | Admin | |

- **Meetings:** 30 min (well under 4h).
- **Contingency space:** 14:30–15:00 (before Lina checkpoint). If the patch is not ready for review at 15:00, use that block for support escalation #3 instead and move the review to Tuesday.

## Tuesday (09:30–17:30)

| Time | Block | Type | Notes |
|---|---|---|---|
| 09:30–10:15 | Support escalation #3 | **[HARD] Wed SLA** (done early) | Clears all three escalations before Wednesday |
| 10:15–11:00 | Board-numbers prep / admin | Prep | Ready to start the moment corrections land |
| 11:00–13:00 | **Board numbers — 2 uninterrupted hours** | **[HARD] chain step** | Finance requirement; assumes corrections arrive ≤11:00 |
| 13:00–13:45 | Lunch | Break | 45 min |
| 13:45–14:00 | **Send strategy outline** to leadership | **[SOFT]** for 16:00 review | 14:00 cutoff |
| 14:00–15:30 | **Contingency block** | Buffer | If Lina slipped: board-numbers recovery here. If not: QA scheduling + change-window coordination |
| 15:30–16:00 | Leadership meeting prep | Prep | |
| 16:00–17:00 | Leadership meeting | Meeting | Fixed recurring; can review strategy if sent by 14:00 |
| 17:00–17:30 | Wrap / notes | Admin | |

- **Meetings:** 60 min (under 4h).
- **If Lina’s corrections are late (she confirms Monday 15:00):** keep 11:00–13:00 open as first recovery window and use Wed 09:30–10:00 plus Thu 10:00–12:00 as backup — still before the Thu 12:00 hard stop.

## Wednesday (09:30–13:00 only)

| Time | Block | Type | Notes |
|---|---|---|---|
| 09:30–10:00 | Demo rehearsal prep | Prep | Materials, environment check |
| 10:00–11:30 | **Demo rehearsal with Sam** (90 min) | Gate for demo | Inside Sam’s only window (10:00–12:00) |
| 11:30–12:15 | Contingency | Buffer | Board-numbers catch-up if Lina slipped; or escalation fallback (see below) |
| 12:15–13:00 | Contingency / short lunch / handoff | Buffer | End of your available day |

- **After 13:00: unavailable.** The preferred demo at **Wed 15:00 is not possible [SOFT preference vs hard constraint]** — use the customer’s Thursday 16:00 alternative (confirm first).
- **Fallback if escalations were not done Mon/Tue:** 11:30–12:15 and 12:15–13:00 fit both 45-min escalations and still meet the Wednesday SLA — but lunch suffers; doing them early is strongly preferred.

## Thursday (09:30–17:30)

| Time | Block | Type | Notes |
|---|---|---|---|
| 09:30–10:00 | Recurring meeting | Meeting | Fixed |
| 10:00–12:00 | **Board numbers finalization** | **[HARD] 12:00** | Last call; nothing goes past 12:00 |
| 12:00–12:45 | Lunch | Break | 45 min |
| 12:45–14:15 | Contingency / change-window coordination | Buffer | Confirm Friday change window with Engineering; absorb any board overrun *before* 12:00 only — after 12:00 board numbers are done |
| 14:15–15:30 | Demo prep | Prep | Assuming demo lands at Thu 16:00 |
| 15:30–16:00 | Break / setup | Buffer | |
| 16:00–17:00 | **Customer demo** (60 min assumed) | **[SOFT]** slot | Confirm duration with Product; slot is the customer’s alternative |
| 17:00–17:30 | Wrap | Admin | |

- **Meetings:** 30 + 60 = 90 min (under 4h).
- **QA is unavailable today** — no security QA can run Thursday; do not plan any.

## Friday (09:30–17:30)

Hard stop: **security patch deployed by 16:00**. Review should already be done (Monday). QA half-day must fit before the 30-minute change window.

**Path A — QA completed earlier in the week (preferred):**

| Time | Block | Type |
|---|---|---|
| 09:30–12:00 | Open / contingency / follow-ups | Buffer |
| 12:00–12:45 | Lunch | Break |
| 12:45–13:30 | Deploy prep | Prep |
| 13:30–14:00 | **Change window (30 min)** | **[HARD] chain step** |
| 14:00–16:00 | Verification + buffer to hard deadline | Buffer |
| 16:00 | **Patch live [HARD]** | |
| 16:00–17:30 | Week wrap, notes, handoffs | Admin |

**Path B — QA must run Friday (if earlier slots were missed):**

| Time | Block | Type |
|---|---|---|
| 09:30–13:30 | **QA half-day (4h)** | **[HARD] chain step** |
| 13:30–14:00 | **Change window (30 min)** | **[HARD] chain step** |
| 14:00–16:00 | Verification + buffer to 16:00 | Buffer |
| 16:00 | **Patch live [HARD]** | |
| 16:00–17:30 | Week wrap | Admin |

Path B leaves no recovery if QA finds issues. Getting review done Monday and QA scheduled for Tuesday/Wednesday is the main de-risking move of the week.

---

## Contingency map (explicit buffer)

| Buffer | Size | Primary use | Secondary use |
|---|---|---|---|
| Mon 14:30–15:00 | 30 min | Lina status checkpoint | Pull escalation #3 forward |
| Tue 14:00–15:30 | 90 min | Lina-late board recovery | QA + change-window coordination |
| Wed 11:30–13:00 | 90 min | Board catch-up | Escalation fallback (45+45) |
| Thu 12:45–14:15 | 90 min | Change-window coordination | Demo prep spillover |
| Fri 14:00–16:00 | 120 min | Deploy verification | Absorb QA findings before 16:00 |

## What is intentionally *not* scheduled

- Wednesday 13:00–17:30 — stated unavailable.
- Any invented Sam availability outside Wed 10:00–12:00.
- Any invented Lina, QA, or customer availability.
- A Wednesday 15:00 demo — it conflicts with a hard personal constraint and must be renegotiated to Thursday 16:00 (or another slot the customer offers).
