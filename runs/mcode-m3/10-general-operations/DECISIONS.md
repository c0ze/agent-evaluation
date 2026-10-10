# Decisions Log

Status: **D** = decided, **P** = pending confirmation, **?** = open contradiction, **→ owner** = who needs to answer.

---

## Confirmed decisions (mine, based on inbox)

| # | Decision | Why |
|---|---|---|
| D1 | **Customer demo moves to Thursday 16:00** (from Wed 15:00 preferred). | Wed 15:00 sits inside my 13:00–17:30 unavailability. Thu 16:00 is the customer-acceptable alternative already offered. |
| D2 | **Demo rehearsal: Wed 10:00–11:30 with Sam.** | Sam's only window is Wed 10:00–12:00; rehearsal is 90m; this fits exactly. |
| D3 | **Strategy outline: 3h focused = Mon 13:30–16:30** (1.5h + 1.5h, with a break at 15:00 for the Lina vendor sync). | Fits the CEO's "three focused hours" ask and lands before the Tue 14:00 send deadline. |
| D4 | **Strategy outline sent by Tue 14:00**, ahead of the 16:00 leadership meeting. | Stated requirement for the meeting to be useful. |
| D5 | **Board numbers: 2h uninterrupted block = Tue 14:00–16:00**, immediately after Lina's 11:00 corrections (assuming vendor on time). | Matches Finance's stated requirement literally. |
| D6 | **Board pack finalised and submitted Thu 09:30–12:00**, final by **12:00**. | Hard Finance deadline; uses recurring 09:30 slot and protects the Tue 2h block. |
| D7 | **Security patch review: Tue 09:30–11:00 (90m).** | Only window that doesn't collide with rehearsal, strategy send, or board block. |
| D8 | **QA runs the half-day Wed 13:00–17:30** (in parallel with my unavailability). | QA unavailable Thu → must start Wed PM. |
| D9 | **Deploy change window: Fri 14:00–14:30**, deploy verified by 16:00. | Leaves 1.5h buffer to the Fri 16:00 hard deadline. |
| D10 | **Support escalations: #1 Mon 10:30, #2 Mon 12:45, #3 Wed 11:30.** | Renewal one is Mon; the two Wed SLAs split across Mon afternoon (early, keeps Wed morning free) and Wed morning (on time). |
| D11 | **Lunch ≥45m every day, meetings ≤4h/day** — enforced in the schedule. | Personal preference, stated. |

---

## Resolved contradictions

- **Demo Wed 15:00 vs. Wed PM unavailability** → moved to Thu 16:00 (decision D1).
- **Sam only Wed, demo was Wed PM** → rehearsal Wed AM (D2), demo Thu PM (D1) — they no longer collide with my unavailability.
- **QA half-day vs. QA unavailable Thu** → QA runs Wed PM (D8). I am unavailable then too, but QA does not need me present for the test pass — only for the change window.
- **Strategy "early this week" vs. demo + review on Tue** → Mon afternoon focus block satisfies "early this week" while leaving Tue 14:00 send clean.

---

## Unresolved contradictions / risks

| # | Risk | Trigger | Mitigation |
|---|---|---|---|
| R1 | **Lina corrections late** (vendor export slip) | She'll know Mon 15:00 | If late, board numbers 2h block moves to **Thu 10:00–12:00**; warn Finance by **Tue 11:30** with revised ETA. |
| R2 | **Strategy review at 16:00 demands major rework** | Possible | Reserve Thu 13:45–15:30 for revisions; protects the demo at 16:00. |
| R3 | **QA finds a blocker Wed** | Possible | Thu is **not** available (QA off); emergency triage Thu AM, deploy at risk. Pre-agree with Engineering a rollback owner. |
| R4 | **Customer rejects Thu 16:00** | Possible | Need confirmation fast — see questions below. |
| R5 | **Security patch review runs over 90m** | Possible | If so, push to Tue 11:00–12:30 and eat into corrections triage; board block could compress to 90m. Flag Finance same-day. |
| R6 | **Two Wed-SLA escalations in 3.5h** | Tight | Mitigated by doing #2 early on Mon; #3 on Wed 11:30 right after rehearsal. No spare capacity for a third surprise. |

---

## Questions, routed

**→ Product (urgent, by EOD Monday):**
- Confirm the customer is happy with **Thursday 16:00** instead of Wednesday 15:00. If not, what other Thu slot works?
- Does the customer need anything specific in the rehearsal (assets, pre-read)?

**→ Lina (urgent, by Monday 15:00):**
- Will the vendor export be on time? Hard pivot for the whole board flow.
- If late, what's the worst-case ETA, and is there a partial export we can start from?

**→ Finance (by Tuesday 09:30):**
- Is the **Thursday 12:00** board deadline firm, or is there a 1–2h grace window if Lina's corrections slip? I want to know in advance rather than negotiate under pressure.

**→ Sam (by Tuesday EOD):**
- Confirm attendance at **Wed 10:00–11:30 rehearsal**.
- Anything you want pre-read by Tue EOD?

**→ Engineering / QA lead (by Tuesday 09:30):**
- Confirm QA can start **Wed 13:00 sharp** on the patch after my Tue review.
- Who owns the rollback decision on Friday if QA flags something at the change window?

**→ CEO (by Monday EOD):**
- Which sections of the strategy are non-negotiable for the **Tue 16:00** review, and which can be rough? Helps me spend the 3h on the parts that matter.

**→ Support lead (informational, Monday morning):**
- Heads-up that escalation #2 will land Mon afternoon and #3 Wed late morning — flag if either needs different handling.