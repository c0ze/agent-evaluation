# Decisions, Contradictions, and Open Questions

## 1. Confirmed Decisions

These decisions follow directly from hard availability limits, stated deadlines, and dependency chains in `INBOX.md`:

| # | Decision | Rationale | Effective Timing |
|---|---|---|---|
| **D1** | **Customer demo cannot run Wednesday `15:00`; book Thursday `16:00` instead.** | Wednesday `13:00–17:30` is hard unavailable. Thursday `16:00` is the customer's stated alternative, stays inside working hours (`09:30–17:30`), and gives Thursday afternoon to fix issues surfaced in rehearsal. *(Pending Product's customer confirmation.)* | Confirm Monday AM; run **Thu `16:00`**. |
| **D2** | **Lock the 90-minute demo rehearsal for Wednesday `10:00–11:30` with Sam.** | Sam is unavailable Tuesday and available Wednesday `10:00–12:00`. Starting at `10:00` fits both calendars and preserves a 30-minute overflow buffer (`11:30–12:00`) before your `13:00` hard cutoff. | Confirm Monday AM; run **Wed `10:00–11:30`**. |
| **D3** | **Clear Support Escalation #1 (renewals) Monday morning (`10:30–11:15`) and pull Escalations #2 & #3 forward to Tuesday morning (`09:30–11:00`).** | Escalation #1 has a hard Monday deadline and direct renewal impact. Clearing #2 & #3 on Tuesday eliminates Wednesday SLA exposure ahead of your Wednesday afternoon absence and keeps Wednesday morning clean for rehearsal and contingencies. | **Mon `10:30–11:15`** & **Tue `09:30–11:00`**. |
| **D4** | **Front-load Security Patch Review to Monday (`11:15–12:45`), with Tuesday `09:30–11:00` as backup.** | QA requires a half-day after your review and is **unavailable all day Thursday**. Reviewing Monday (or Tuesday AM latest) lets QA finish Tuesday/Wednesday, avoiding a fragile Friday-only bottleneck before the **Friday `16:00`** hard deploy deadline. | **Mon `11:15–12:45`** (fallback **Tue `09:30–11:00`**). |
| **D5** | **Schedule Finance Board Numbers for Tuesday `13:00–15:00`, and hold Thursday `10:00–12:00` as a protected fallback.** | Respects the 2 uninterrupted hours required after Lina's Tuesday `11:00` corrections while leaving buffer for intake/questions. Because Wednesday morning is split by rehearsal and you are out Wednesday afternoon, Thursday `10:00–12:00` is the **only** remaining uninterrupted 2-hour block before the **Thursday `12:00`** hard deadline. | **Tue `13:00–15:00`** (fallback **Thu `10:00–12:00`**). |
| **D6** | **Draft the CEO Strategy Outline Monday afternoon (`13:30–16:30`) to target Tuesday `14:00` delivery, while treating it as the first item to flex if a hard deadline collides.** | Achieves the Tuesday `16:00` leadership review opportunity without breaking working hours or lunch/meeting preferences, while explicitly preserving hard deadlines (Security, Finance, Support) as higher priority. | **Mon `13:30–16:30`**, send by **Tue `12:00–14:00`**. |
| **D7** | **Target Friday `10:30–11:00` for the 30-minute security patch change window, with Friday `14:00–14:30` as fallback.** | Deploying Friday morning gives full Engineering, QA, and your coverage for post-deploy monitoring and 5 hours of margin before Friday `16:00` (safer than deploying right before Wednesday's afternoon absence or Thursday's QA outage). | **Fri `10:30–11:00`** (fallback **Fri `14:00–14:30`**). |

---

## 2. Unresolved Contradictions & Risks

| # | Contradiction / Conflict | Why It Matters | Current Assumption / Mitigation |
|---|---|---|---|
| **C1** | **Product's preferred demo slot (Wed `15:00`) vs. your hard unavailability (Wed `13:00–17:30`).** | Direct calendar impossibility unless you are not required to attend the demo. | Declining Wed `15:00` and proposing the customer's **Thu `16:00`** alternative. If Product insists on Wed `15:00`, someone else must cover your role. |
| **C2** | **Tuesday `16:00–17:00` recurring meeting vs. CEO's "Tuesday `16:00` leadership meeting."** | Both sit on the exact same Tuesday `16:00` slot. If they are two separate meetings, you are double-booked. | Treating them as the **same meeting** pending confirmation. If separate, one must be rescheduled or declined. |
| **C3** | **Lina's vendor export delay risk vs. Finance's Thursday `12:00` hard deadline + Wednesday schedule squeeze.** | Wednesday only has `09:30–13:00`, and Sam's `10:00–11:30` rehearsal splits it so no 2-hour uninterrupted block exists Wednesday. If Lina's corrections slip past **Wednesday EOD / Thursday `09:45`**, the Thursday `12:00` deadline becomes mathematically unmeetable without moving Thursday's `09:30` meeting or changing Finance's cutoff. | Holding **Thu `10:00–12:00`** open until Lina confirms status at **Mon `15:00`**; will escalate immediately Monday afternoon if the revised ETA threatens Thursday morning. |
| **C4** | **Unstated security patch readiness vs. QA's Thursday outage + Friday `16:00` hard deadline.** | `INBOX.md` does not say when the patch will be ready for review. If it isn't ready until Wednesday afternoon or Thursday, QA is forced onto Friday morning (`09:30–13:30`), leaving almost no margin for defect fixes and re-testing before Friday `16:00`. | Asking Engineering Monday AM to confirm patch readiness no later than **Tue `09:30`** (ideally **Mon `11:15`**). |
| **C5** | **Unspecified Support SLA cutoff times vs. Wednesday `13:00–17:30` unavailability.** | Even if initial responses go out Tuesday morning, Wednesday afternoon customer follow-ups could breach an SLA if no one is covering while you are offline. | Completing #2 & #3 Tuesday AM and confirming Wednesday afternoon handoff coverage with Support. |

---

## 3. Open Questions Assigned by Owner

### Product (and Sam)
- **Demo slot & length (Product — need answer Monday AM):** Can we lock the customer demo for **Thursday `16:00`** (since Wednesday `13:00–17:30` is unavailable), and how long is the session (assuming 60 min; hard stop is `17:30`)?
- **Rehearsal & demo attendance (Sam / Product — need answer Monday AM):** Can **Sam** confirm **Wednesday `10:00–11:30`** for the 90-minute rehearsal? Does Sam also need to attend Thursday's `16:00` customer demo?
- **Environment fix ownership (Product — need answer by Wednesday `11:30`):** If the Wednesday rehearsal surfaces environment bugs, who can address them Wednesday afternoon while you are offline so we can re-verify Thursday `13:00–15:30`?

### Lina & Finance
- **Vendor export status & revised ETA (Lina — due Monday `15:00`):** Are corrections on track for **Tuesday `11:00`**? If delayed, what is the earliest realistic ETA—specifically, will they arrive before **Wednesday EOD**?
- **Late-export fallback protocol (Finance — need answer Monday PM if Lina flags a delay):** If the vendor export slips past Thursday `09:45` (making 2 uninterrupted hours before `12:00` impossible), would you prefer to (a) move/skip Thursday's `09:30` recurring meeting to recover 30 minutes, (b) submit provisional numbers with caveats by `12:00`, or (c) shift the internal cutoff?

### Engineering (and QA)
- **Patch readiness for review (Engineering — need answer Monday AM):** Is the security patch ready for a 90-minute review **Monday `11:15–12:45`** (or latest **Tuesday `09:30–11:00`**) so QA can complete testing before their Thursday outage?
- **Change window logistics (Engineering / QA — need answer by Tuesday EOD):** Do you need me and QA online during the 30-minute deploy window? Does **Friday `10:30–11:00`** work as our primary window (with **Friday `14:00–14:30`** as fallback if QA needs Friday morning)?

### CEO / Leadership
- **Calendar overlap (CEO / EA — need answer Monday):** Is the **Tuesday `16:00–17:00`** recurring meeting the leadership meeting referenced for the strategy outline, or are those two separate meetings?
- **Expectations & flexibility (CEO — need answer Monday):** Confirming that **Tuesday `14:00`** is a target rather than a hard cutoff—I'm planning to have a focused first draft to you by then, barring any hard-deadline escalation (renewals, security patch, or board numbers). Any specific sections you want prioritized, and does it need finalized board numbers?

### Support
- **Exact SLA deadlines & Wed PM coverage (Support — need answer Monday AM):** What are the exact cutoff times for Monday's renewal escalation and Wednesday's two SLAs, and who can pick up any customer replies during **Wednesday `13:00–17:30`**?
