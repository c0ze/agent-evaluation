# Week Plan (Monday–Friday)

## Operating Constraints & Guardrails

- **Working hours:** `09:30–17:30`, Monday–Friday.
- **Hard unavailability:** **Wednesday `13:00–17:30`** (no work, calls, or demos scheduled).
- **Recurring meetings (fixed):** Monday `10:00–10:30`, Tuesday `16:00–17:00` *(assumed to be the leadership meeting — confirmation pending)*, Thursday `09:30–10:00`.
- **Personal preferences (respected throughout):**
  - **Meetings:** Max 4 hours/day (planned peak is 1.5 hours/day).
  - **Lunch:** At least 45 minutes reserved daily (Wednesday workday ends at `13:00`; `12:15–13:00` is reserved if taking lunch during working hours, or flexes to post-`13:00`).

---

## Priority Stack & Deadlines (Hard vs. Preference)

| Rank | Workstream | Deadline / Target | Type | Effort | Key Dependencies & Constraints |
|---|---|---|---|---|---|
| **P1** | **Engineering: Security Patch** | Deploy by **Fri 16:00** | **Hard deadline** | 60–90 min review + 30 min change window | Serial chain: Your review → half-day QA → 30-min deploy. **QA is unavailable Thursday.** Must review Mon (or Tue AM latest) to keep QA off Friday. |
| **P2** | **Finance: Board Numbers** | Final by **Thu 12:00** | **Hard deadline** | 2 uninterrupted hours | Blocked on Lina's corrections (ETA **Tue 11:00**; delay risk confirmed by **Mon 15:00**). Wed AM is split by rehearsal, leaving Thu `10:00–12:00` as last-resort fallback. |
| **P3** | **Support: 3 Escalations** | #1 (renewals): **Mon**; #2 & #3: **Wed SLAs** | **Hard deadlines** | 3 × 45 min (2.25 hrs) | #1 impacts renewals. #2 & #3 must finish before Wed `13:00` unavailability (front-loaded to Tue AM). |
| **P4** | **Product: Customer Demo & Rehearsal** | Demo: **Thu 16:00** *(Wed 15:00 unavailable)*; Rehearsal: **Wed 10:00–11:30** | **Preference / Scheduled commitment** | 90 min rehearsal + ~60 min demo | Wed `15:00` conflicts with hard unavailability; Thu `16:00` is customer's stated alternative. **Sam unavailable Tue**; Sam available Wed `10:00–12:00`. |
| **P5** | **CEO: Strategy Outline** | "Early this week"; **Tue 14:00** target for Tue 16:00 review | **Preference / Soft target** | 3 focused hours | Scheduled Mon afternoon to hit Tue 14:00 cleanly, but serves as the intentional shock absorber if a hard deadline (P1–P3) slips. |

---

## Day-by-Day Schedule

### Monday (`09:30–17:30`)
*Meetings: 0.5 hr | Lunch: 45 min | Focus work: 5.25 hrs | Contingency/Triage: 1.5 hrs*

| Time | Block | Type | Details & Dependencies |
|---|---|---|---|
| `09:30–10:00` | Week Triage & Alignment | Admin / Comms | Send team alignment message (`DRAFT_REPLY.md`); confirm patch readiness (Eng), demo shift to Thu 16:00 (Product/Sam), and SLA cutoffs (Support). |
| `10:00–10:30` | Recurring Meeting | Fixed Meeting | — |
| `10:30–11:15` | **Support Escalation #1 (Renewals)** | **Focus (P3 — Hard: Mon)** | Clear Monday renewal risk early so any customer follow-up still has afternoon runway. |
| `11:15–12:45` | **Security Patch Review** *(90 min)* | **Focus (P1 — Hard: Fri 16:00)** | Unblocks half-day QA on Tuesday (well ahead of Thursday's QA outage). *Fallback if patch isn't ready yet: pull Support Escalations #2 & #3 here and move review to Tue `09:30–11:00`.* |
| `12:45–13:30` | Lunch | Personal (45 min) | Protected break. |
| `13:30–16:30` | **CEO Strategy Outline (First Draft)** *(3 hrs)* | **Deep Focus (P5 — Soft: Tue 14:00)** | Uninterrupted 3-hour drafting block to get the outline done a day early. *If P1/P3 spills over, this block is the first thing flexed.* |
| `16:30–17:30` | **Lina Status Check & Contingency Buffer** | **Checkpoint / Buffer** | Check Lina's **15:00** vendor export update (activate Board Numbers contingency if late); handle Escalation #1 follow-up or patch review questions. |

---

### Tuesday (`09:30–17:30`)
*Meetings: 1.0 hr | Lunch: 60 min | Focus work: 4.5 hrs | Contingency/Buffer: 1.5 hrs*
*(External parallel track: **QA runs half-day security patch testing** today. **Sam unavailable all day.**)*

| Time | Block | Type | Details & Dependencies |
|---|---|---|---|
| `09:30–11:00` | **Support Escalations #2 & #3** *(2 × 45 min)* | **Focus (P3 — Hard: Wed SLAs)** | Clears both Wednesday SLAs a full day early, protecting Wednesday's short morning. *Fallback slot for Security Patch Review if Engineering wasn't ready Monday.* |
| `11:00–12:00` | **Strategy Polish & Delivery + Lina Intake** | **Focus / Checkpoint** | Final edit and send CEO Strategy Outline (by `12:00`, **2 hrs ahead** of the `14:00` soft target). Confirm Lina's **11:00** corrections arrived cleanly and ask any quick clarifying questions before the uninterrupted block. |
| `12:00–13:00` | Lunch | Personal (60 min) | Protected break. |
| `13:00–15:00` | **Finance Board Numbers** *(2 uninterrupted hrs)* | **Deep Focus (P2 — Hard: Thu 12:00)** | Primary block — finishes nearly two days ahead of Thursday 12:00. *If Lina's export slips to Tue afternoon (by 14:00), slide this block to `14:00–16:00`. If later, move to Thu `10:00–12:00` fallback.* |
| `15:00–16:00` | **Contingency & Meeting Prep** | **Buffer** | Prep for 16:00 leadership review, respond to Finance/QA questions, or finish any bumped Wed SLA item. |
| `16:00–17:00` | Recurring / Leadership Meeting | Fixed Meeting | Reviews CEO Strategy Outline *(confirm this is not a double-booking with a separate recurring meeting)*. |
| `17:00–17:30` | Wrap-Up & QA Check-In | Admin / Buffer | Capture leadership notes; verify whether QA completed patch testing or needs Wednesday. |

---

### Wednesday (`09:30–13:00` ONLY — Unavailable `13:00–17:30`)
*Meetings: 1.5 hrs | Lunch: 45 min (optional in-window or post-13:00) | Focus/Contingency: 1.25–2.0 hrs*
*(External parallel track: **QA fallback testing / re-testing window** — last day QA is available before Friday.)*

| Time | Block | Type | Details & Dependencies |
|---|---|---|---|
| `09:30–10:00` | Demo Rehearsal Prep & Status Check | Prep / Triage | Verify demo environment access; quick check on Finance board numbers and QA patch status. |
| `10:00–11:30` | **Product Demo Rehearsal (with Sam)** *(90 min)* | **Meeting (P4)** | Fits Sam's `10:00–12:00` window with a 30-min overflow cushion (`11:30–12:00`) if environment issues arise. |
| `11:30–12:15` | **Rehearsal Fixes, QA/Finance Follow-Up & Buffer** | **Contingency** | Document demo environment issues for fixes before Thu 16:00; unblock any QA findings before QA's Thursday outage; absolute last-chance window for Support Wed SLAs if bumped earlier. |
| `12:15–13:00` | Lunch *(or flex buffer)* | Personal (45 min) | Reserved if eating before your `13:00` commitment; otherwise take lunch after `13:00` and keep `12:15–13:00` as extra handoff buffer. |
| `13:00–17:30` | **UNAVAILABLE** | **Hard Block** | Completely offline. *(Product's preferred `15:00` demo is declined in favor of Thu `16:00`.)* |

---

### Thursday (`09:30–17:30`)
*Meetings: 1.5 hrs | Lunch: 60 min | Focus/Contingency: 5.5 hrs*
*(External constraint: **QA is unavailable all day Thursday.**)*

| Time | Block | Type | Details & Dependencies |
|---|---|---|---|
| `09:30–10:00` | Recurring Meeting | Fixed Meeting | — |
| `10:00–12:00` | **Finance Board Numbers — HARD CONTINGENCY** *(2 uninterrupted hrs)* | **Protected Fallback (P2 — Hard: Thu 12:00)** | **Held open until Lina's Tuesday delivery is confirmed.** If Board Numbers were completed Tuesday, release this block for: final Finance sign-off before noon, verifying demo environment fixes, or iterating on the Strategy Outline from Tuesday's meeting. |
| `12:00` | **HARD DEADLINE: Board Numbers Final** | **Milestone** | — |
| `12:00–13:00` | Lunch | Personal (60 min) | Protected break. |
| `13:00–15:30` | **Demo Fix Verification & Strategy Iteration** | **Focus / Buffer** | Re-test demo environment fixes from Wednesday's rehearsal; incorporate leadership feedback into Strategy Outline; review any Engineering patch fixes so QA can re-verify first thing Friday. |
| `15:30–16:00` | Pre-Demo Tech Check | Prep | Final environment and screen-share check. |
| `16:00–17:00` | **Product Customer Demo** *(duration TBC)* | **Meeting (P4)** | Confirmed alternative slot with customer (confirm exact length — must finish by `17:30`). |
| `17:00–17:30` | Demo Follow-Up & Friday Deploy Readiness | Admin | Capture customer action items; confirm Friday change window readiness with Engineering & QA. |

---

### Friday (`09:30–17:30`)
*Meetings: 0.5 hr | Lunch: 60 min | Focus/Contingency: 6.5 hrs*
*(External parallel track: **QA returns Friday** — available `09:30–13:30` if re-testing or late QA is required.)*

| Time | Block | Type | Details & Dependencies |
|---|---|---|---|
| `09:30–10:30` | Pre-Deploy Verification / QA Sync | Focus / Check | Final go/no-go check with Engineering & QA (if QA already signed off Tue/Wed). |
| `10:30–11:00` | **Security Patch Change Window (Primary)** *(30 min)* | **Deploy (P1 — Hard: Fri 16:00)** | Preferred deployment window: full team (you + Engineering + QA) online all day for monitoring/rollback, **5 hours ahead** of the `16:00` hard deadline. |
| `11:00–12:30` | Post-Deploy Monitoring / Overflow Work | Focus / Buffer | Monitor patch stability; wrap up Strategy Outline v2 or customer demo follow-ups. |
| `12:30–13:30` | Lunch | Personal (60 min) | Protected break. |
| `13:30–14:00` | Fallback Go/No-Go Check | Contingency | Only needed if QA had to run/re-test Friday morning (`09:30–13:30`). |
| `14:00–14:30` | **Security Patch Change Window (Fallback)** *(30 min)* | **Contingency Deploy (P1)** | Backup deployment slot if QA ran Friday morning. |
| `14:30–16:00` | **Hard Deploy Rollback / Retry Buffer** | **Contingency** | 90-minute safety margin before the `16:00` hard cutoff. |
| `16:00` | **HARD DEADLINE: Security Patch Deployed** | **Milestone** | — |
| `16:00–17:30` | Weekly Closeout & Next-Week Planning | Admin | Finalize notes, archive completed escalations, prep next week. |

---

## Key Contingency Playbooks

1. **If Lina announces Monday 15:00 that the vendor export is late:**
   - *Arrives Tue `11:00–14:00`:* Shift Finance block to Tuesday `14:00–16:00`.
   - *Arrives Tue late PM / Wed:* Activate the protected **Thursday `10:00–12:00`** fallback block (2 uninterrupted hours ending right at deadline).
   - *Arrives after Thu `09:45`:* Mathematically impossible to complete 2 uninterrupted hours by Thu `12:00` without dropping/moving the Thu `09:30` recurring meeting (buys 30 min, extends cutoff to `10:00` arrival) or getting Finance approval for interim/caveated numbers or a shifted cutoff. Escalate immediately Monday afternoon once Lina gives the revised ETA.
2. **If Engineering's security patch isn't ready Monday morning:**
   - Swap Monday `11:15–12:45` with Tuesday `09:30–11:00` (do Support Escalations #2 & #3 Monday morning, review patch Tuesday morning). QA still runs Tuesday afternoon / Wednesday, keeping Friday `10:30` deploy intact.
   - If patch review slips past Wednesday `12:00`, QA is forced onto Friday `09:30–13:30` and deployment moves to the **Friday `14:00–14:30`** fallback (zero room for major defects — flag risk to Engineering immediately).
3. **If a hard deadline (P1–P3) erupts Monday or Tuesday:**
   - Defer the **CEO Strategy Outline** (P5, soft target) out of Monday afternoon / Tuesday `14:00` to Thursday afternoon (`13:00–15:30`) or Friday, notifying the CEO before Tuesday morning rather than missing a hard deadline or overworking past `17:30`.
