# Decisions, Contradictions & Open Questions

---

## ✅ Confirmed Decisions

| # | Decision | Rationale | Owner | Status |
|---|----------|-----------|-------|--------|
| 1 | Customer demo moved to **Thursday 16:00** | Wednesday 15:00 conflicts with 13:00–17:30 unavailability; Sam rehearsal only Wed 10–12 | You / Product | Confirmed in plan |
| 2 | CEO strategy draft **Monday 12:45–15:45**, sent by **Tuesday 14:00** | "Early this week" + leadership meeting Tue 16:00 needs materials by 14:00 | You | Committed |
| 3 | Security patch **review Thursday 10:00–11:30**, **QA Friday 09:30–13:30**, **deploy Friday 15:00–15:30** | QA unavailable Thursday; deploy hard deadline Friday 16:00; needs review → QA (4h) → 30min window | You / Engineering | Sequenced |
| 4 | All three Support escalations completed **before Wednesday** | #1 Monday (renewals), #2 Monday, #3 Tuesday AM — clears Wed SLAs despite unavailability | You | Scheduled |
| 5 | Finance block **Tuesday 11:00–13:00** (2h uninterrupted) | Board numbers due Thu 12:00; depends on Lina by 11:00 | You / Finance | Contingent on Lina |
| 6 | **Lunch protected 45 min daily**, meeting cap **≤4h/day** | Personal sustainability constraint | You | Enforced in plan |

---

## ⚠️ Unresolved Contradictions / Risks

| # | Contradiction | Impact | Mitigation in Plan |
|---|---------------|--------|-------------------|
| 1 | **Lina may deliver late** (vendor export) — she confirms Monday 15:00 | Finance 2h block Tue 11–13 slides; board numbers at risk for Thu 12:00 | Mon 15:45–17:30 buffer; Tue 10:15–11:00 explicit Lina buffer; escalate to Finance lead if late |
| 2 | **Wednesday only 3.5h available** but rehearsal (1.5h) + lunch (0.75h) + buffer = 2.25h, leaving **zero margin** | Any overrun loses lunch or rehearsal debrief | Start rehearsal sharp at 10:00; prep done Mon/Tue; debrief async if needed |
| 3 | **QA unavailable Thursday** forces Friday QA, compressing Friday | QA (4h) + deploy (0.5h) + verify (0.5h) = 5h before 16:00, leaving only 1.5h buffer | Review Thu 10:00 sharp; QA start Fri 09:30 sharp; rollback plan pre-written |
| 4 | **Demo rehearsal requires Sam** (Wed 10–12 only) — single point of failure | If Sam sick/unavailable, no rehearsal → demo risk | Confirm Sam attendance Monday; identify backup reviewer |
| 5 | **CEO strategy "early this week"** vague — Tuesday 14:00 send is latest possible | If strategy needs iteration, no time before leadership meeting | Draft Monday, minimal Tuesday polish; align with CEO Monday on scope |

---

## ❓ Questions Assigned to Right Person

| # | Question | For | Deadline to Answer | Blocking |
|---|----------|-----|-------------------|----------|
| 1 | **Lina:** Will vendor export be on time? Confirm by Monday 15:00 so I can lock Tue 11–13 Finance block. | Lina | **Monday 15:00** | Finance timeline |
| 2 | **Finance lead:** If Lina delivers late (e.g., Tue 14:00), can board numbers slip to Friday, or is Thu 12:00 immovable? | Finance lead | **Monday 17:00** | Contingency planning |
| 3 | **Sam:** Confirm Wednesday 10:00–12:00 rehearsal attendance. Any conflicts? | Sam | **Monday 17:00** | Demo readiness |
| 4 | **Product:** Is Thursday 16:00 demo confirmed with customer, or do they need Wednesday 15:00? (We cannot do Wed 15:00) | Product | **Monday 17:00** | Calendar lock |
| 5 | **Engineering lead:** Security patch — is the change window **strictly 30 min at 15:00 Fri**, or is there flexibility (e.g., 14:30 or 15:30)? | Eng lead | **Wednesday 13:00** | Friday schedule precision |
| 6 | **CEO:** Strategy outline — what sections are mandatory for Tuesday 16:00 review? (Scope = 3h effort) | CEO | **Monday 12:00** | Monday focus block efficiency |
| 7 | **Support lead:** Escalation #1 (renewals) — any additional context needed before Monday 11:15 response? | Support lead | **Monday 09:30** | First task Monday |

---

## Decision Log Format (for future weeks)
- **Decision:** What was decided
- **Trigger:** What forced the decision
- **Alternatives considered:** Why others rejected
- **Owner:** Who drives execution
- **Review date:** When to revisit