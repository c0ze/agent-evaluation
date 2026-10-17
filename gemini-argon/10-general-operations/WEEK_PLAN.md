# Weekly Operating Plan (Monday–Friday)

## 1. Guardrails, Deadlines & Preferences

### Working Hours & Personal Constraints
- **Standard Hours:** Monday, Tuesday, Thursday, Friday `09:30–17:30`.
- **Wednesday Availability:** `09:30–13:00` only (`13:00–17:30` is **unavailable**).
- **Meeting Cap:** Maximum 4 hours of meetings per day (actual daily load below is `0.5h–2.0h`).
- **Lunch Break:** Minimum 45 minutes reserved daily.

### Hard Deadlines vs. Preferences
| Workstream | Type | Target / Constraint | Effort & Dependencies |
| :--- | :--- | :--- | :--- |
| **Support: Renewal Escalation (#1)** | **Hard Deadline** | Monday EOD (`17:30`) | `45 min` focus. |
| **Support: SLA Escalations (#2 & #3)** | **Hard Deadline** | Wednesday SLA | `45 min` each (`90 min` total). Scheduled Mon/Tue to avoid Wed crunch. |
| **Finance: Board Numbers** | **Hard Deadline** | Thursday `12:00` | `2 hours` uninterrupted after Lina sends corrections (expected Tue `11:00`; vendor export status known Mon `15:00`). |
| **Engineering: Security Patch** | **Hard Deadline** | Friday `16:00` | `60–90 min` review $\rightarrow$ `0.5 day` QA (QA unavailable Thu) $\rightarrow$ `30 min` change window. |
| **CEO: Strategy Outline** | **Preference / Target** | Tuesday `14:00` (for `16:00` review) | "Early this week" request; `3 focused hours` needed. |
| **Product: Customer Demo** | **Preference vs. Fallback** | Thu `16:00` (Wed `15:00` impossible) | Wed `15:00` conflicts with Wed afternoon unavailability; requires `90 min` rehearsal with Sam (Sam available Wed `10:00–12:00`). |

---

## 2. Priority Order
1. **Unblock Critical Path & Immediate Revenue Risk (Monday):** Respond to the renewal-impacting Support escalation (Monday hard deadline) and complete the 90-minute Engineering Security Patch review so QA has Tuesday/Wednesday to complete their half-day testing before Thursday's QA blackout.
2. **Governance & Executive Deadlines (Monday–Thursday 12:00):** Complete the 2-hour uninterrupted Finance Board Numbers block immediately after Lina's Tuesday `11:00` handoff (with protected fallback blocks on Tuesday `14:00–16:00` and Thursday `10:00–12:00` before the Thursday `12:00` deadline), and deliver the 3-hour CEO Strategy Outline before Tuesday `14:00`.
3. **Customer Commitments & SLA Compliance (Tuesday–Thursday):** Clear the remaining two Wednesday Support SLAs by Tuesday morning, run the 90-minute demo rehearsal with Sam on Wednesday `10:00–11:30`, and execute the Customer Demo on Thursday `16:00`.

---

## 3. Day-by-Day Schedule

### Monday (`09:30–17:30`)
*Focus: Clear Monday renewal escalation, front-load Security Patch review to unblock QA, and complete the bulk of the CEO Strategy Outline.*

- **09:30–10:00 (30m) | Weekly Triage & Alignment:** Send team update (`DRAFT_REPLY.md`) confirming Thursday `16:00` demo slot, Wednesday `10:00–11:30` rehearsal with Sam, and patch review handoff timing.
- **10:00–10:30 (30m) | Recurring Meeting** *(Meetings: 0.5h)*
- **10:30–11:15 (45m) | Focus Block — Support Escalation #1 (Renewal Risk):** Draft and send response. **[HARD DEADLINE: Monday]**
- **11:15–12:45 (90m) | Focus Block — Engineering Security Patch Review:** Complete full 90-minute review and hand off to Engineering/QA so QA can execute their half-day test on Tuesday or Wednesday (bypassing Thursday's QA unavailability).
- **12:45–13:30 (45m) | Lunch**
- **13:30–15:00 (90m) | Focus Block — CEO Strategy Outline (Part 1 of 2):** 1.5 hours of uninterrupted drafting.
- **15:00–15:15 (15m) | Dependency Check — Lina (Vendor Export):** Confirm whether vendor export is on time for Tuesday `11:00` delivery or if Tuesday/Thursday Finance contingency blocks must be activated.
- **15:15–16:45 (90m) | Focus Block — CEO Strategy Outline (Part 2 of 2):** Complete the remaining 1.5 hours of drafting (3 hours total).
- **16:45–17:30 (45m) | Focus Block — Support Escalation #2 (Wednesday SLA):** Complete first of two Wednesday SLA escalations early.

### Tuesday (`09:30–17:30`)
*Focus: Clear final Support SLA, execute Finance Board Numbers upon receipt of Lina's corrections, and ship CEO Strategy Outline by `14:00`.*

- **09:30–10:15 (45m) | Focus Block — Support Escalation #3 (Wednesday SLA):** Complete final support escalation ahead of Wednesday SLA.
- **10:15–11:00 (45m) | Focus / Contingency Buffer — CEO Strategy Outline Polish:** Final review of strategy outline (or spillover buffer if Monday's renewal escalation ran long).
- **11:00–13:00 (120m) | Focus Block — Finance Board Numbers (Primary Window):** 2 uninterrupted hours immediately following Lina's `11:00` corrections handoff.
  - *Contingency Swap:* If Lina confirmed on Monday `15:00` that corrections will be delayed past `11:00`, use `11:00–13:00` to finalize the CEO Strategy Outline or handle Engineering patch follow-ups, and shift Finance to Contingency Block A (`14:00–16:00`) or Contingency Block B (Thursday `10:00–12:00`).
- **13:00–13:45 (45m) | Lunch**
- **13:45–14:00 (15m) | Deliverable Handoff:** Send CEO Strategy Outline for leadership review. **[TARGET: Tuesday 14:00]**
- **14:00–16:00 (120m) | Contingency Block A (Finance Late Delivery / QA Rework):**
  - *Use Case 1:* Uninterrupted 2-hour block for Finance Board Numbers if Lina's corrections arrive between `11:00` and `14:00`.
  - *Use Case 2:* Address any feedback from Engineering/QA as QA begins half-day patch verification.
- **16:00–17:00 (60m) | Recurring Leadership Meeting:** Review CEO Strategy Outline. *(Meetings: 1.0h)*
- **17:00–17:30 (30m) | Daily Wrap & Rehearsal Check:** Confirm demo environment readiness for Wednesday morning rehearsal.

### Wednesday (`09:30–13:00` | Unavailable `13:00–17:30`)
*Focus: Rehearse customer demo with Sam during his sole availability window and verify Support SLAs and QA progress before `13:00` departure.*

- **09:30–10:00 (30m) | Demo Environment Setup & SLA Check:** Verify both Wednesday Support SLAs are closed and spin up demo environment.
- **10:00–11:30 (90m) | Product Customer Demo Rehearsal (with Sam):** Runs inside Sam's `10:00–12:00` availability window. *(Meetings: 1.5h)*
- **11:30–12:15 (45m) | Post-Rehearsal Adjustments & QA Status Check:** Use remaining 30 minutes of Sam's `10:00–12:00` window if rehearsal adjustments are needed; confirm QA half-day security patch testing completes Wednesday before Thursday's QA blackout. **[HARD DEADLINE: Support SLAs #2 & #3 Closed]**
- **12:15–13:00 (45m) | Lunch**
- **13:00–17:30 | UNAVAILABLE (Out of Office)**

### Thursday (`09:30–17:30`)
*Focus: Finalize Finance Board Numbers by `12:00` deadline (if delayed from Tuesday), execute Customer Demo at `16:00`, and deploy Security Patch early if QA signed off Wednesday.*
*(Note: QA is unavailable all day Thursday.)*

- **09:30–10:00 (30m) | Recurring Meeting** *(Meetings: 0.5h)*
- **10:00–12:00 (120m) | Contingency Block B — Finance Board Numbers (Last-Resort Window):**
  - *If vendor export delayed Lina's corrections past Tuesday:* 2 uninterrupted hours to finalize Board Numbers right before the `12:00` deadline.
  - *If Board Numbers finished Tuesday:* Incorporate Tuesday leadership feedback into the CEO Strategy Outline.
- **12:00 | MILESTONE — Finance Board Numbers Final** **[HARD DEADLINE: Thursday 12:00]**
- **12:00–12:45 (45m) | Engineering Pre-Deploy Check / Buffer:** Confirm Wednesday QA sign-off and readiness for afternoon change window.
- **12:45–13:30 (45m) | Lunch**
- **13:30–14:00 (30m) | Engineering Security Patch Change Window (Primary Slot):** Execute 30-minute deployment window if QA passed on Tuesday/Wednesday and QA attendance is not required during the change window. *(Meetings/Sync: 0.5h)*
- **14:00–15:30 (90m) | Focus / Contingency Buffer:** Follow-up work from strategy review or post-deployment verification.
- **15:30–16:00 (30m) | Pre-Demo Environment Check:** Final prep for customer demo.
- **16:00–17:00 (60m) | Product Customer Demo (Confirmed Slot):** Moved from Wednesday `15:00` to customer's alternate Thursday `16:00` slot. *(Meetings: 1.0h; Daily Total: 2.0h)*
- **17:00–17:30 (30m) | Post-Demo Debrief & Follow-ups**

### Friday (`09:30–17:30`)
*Focus: Final safety net for Security Patch QA/deployment prior to `16:00` deadline and end-of-week wrap-up.*

- **09:30–12:30 (180m) | Contingency Block C — Security Patch QA Re-verification / Deep Work:**
  - *If Wednesday QA found regressions:* QA is available Friday morning to complete re-testing ahead of the afternoon change window.
  - *If patch already deployed Thursday:* Open focus block for strategy execution and operational catch-up.
- **12:30–13:15 (45m) | Lunch**
- **13:15–14:00 (45m) | Final Deployment Readiness Check**
- **14:00–14:30 (30m) | Engineering Security Patch Change Window (Fallback Slot):** 30-minute deployment window with 90 minutes of buffer before the `16:00` deadline. *(Meetings/Sync: 0.5h)*
- **14:30–16:00 (90m) | Post-Deployment Monitoring & Sign-off**
- **16:00 | MILESTONE — Security Patch Deployed** **[HARD DEADLINE: Friday 16:00]**
- **16:00–17:30 (90m) | Weekly Review & Next Week Planning**
