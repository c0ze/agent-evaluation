# Week Plan

## Constraints (from the inbox, not invented)

**Hard**

| Item | Deadline / fixed |
|---|---|
| Security patch deployed | Friday 16:00 |
| Board numbers final | Thursday 12:00 |
| Lina's corrections arrive | Tuesday by 11:00 (external, may slip — see risks) |
| Support escalation #1 (renewals) | Response Monday |
| Support escalations #2, #3 | Response by Wednesday SLA |
| Demo rehearsal with Sam | Wednesday 10:00–12:00 (Sam's only slot) |
| My availability | 09:30–17:30 Mon–Fri; **Wednesday 13:00–17:30 out** |
| Recurring meetings | Mon 10:00–10:30, Tue 16:00–17:00, Thu 09:30–10:00 |

**Preferences**

| Item | Note |
|---|---|
| Customer demo Wednesday 15:00 | Customer's alternative: Thursday 16:00 |
| Strategy outline "early this week" | Tuesday 16:00 leadership review **if sent by 14:00** |
| Max 4h meetings/day | All days under 2h |
| Lunch ≥ 45 min | Reserved every day |

## The two scheduling facts that drive everything

1. **Wednesday is a half day.** 09:30–13:00 minus the 2h rehearsal minus 45 min lunch leaves **45 minutes**. The two Wednesday-SLA escalations cannot be done on Wednesday, so they are pulled forward to Tuesday.
2. **The preferred demo slot is impossible.** Wednesday 15:00 falls inside my unavailable block, so the plan uses the customer's stated alternative, **Thursday 16:00**. This needs Product/customer to confirm — see DECISIONS.md.

## Day-by-day

### Monday

| Time | Block |
|---|---|
| 09:30–10:00 | Triage; confirm with Lina when she expects the vendor export (she knows by 15:00) |
| 10:00–10:30 | Recurring meeting (fixed) |
| 10:30–11:15 | **Escalation #1 — renewals** (response goes out today) |
| 11:15–12:45 | **Security patch review** (90 min allowance for a 60–90 min task) |
| 12:45–13:30 | Lunch |
| 13:30–16:30 | **Strategy outline — 3 focused hours**, no interruptions except a QA blocker |
| 16:30–17:00 | QA check-in, hand over anything review found |
| 17:00–17:30 | Buffer; send outline to CEO tonight (Tuesday 14:00 is the fallback cutoff) |

*Parallel:* QA takes the half-day patch run at 13:00–17:00, immediately after the review. QA's hours are not stated in the inbox — confirm Monday morning (question Q3).

### Tuesday

| Time | Block |
|---|---|
| 09:30–10:00 | QA go/no-go on the patch; confirm change window with Eng |
| 10:00–11:00 | Finance prep — pre-stage numbers, chase missing inputs |
| 11:00–13:00 | **Board numbers — 2 uninterrupted hours.** Starts as soon as corrections land (due by 11:00) |
| 13:00–13:45 | Lunch |
| 13:45–14:15 | **Security patch change window (30 min) — deploy** |
| 14:15–15:00 | **Escalation #2** |
| 15:00–15:45 | **Escalation #3** |
| 15:45–16:00 | Send outline to CEO if it somehow didn't go Monday night (14:00 cutoff was for the review) |
| 16:00–17:00 | Recurring meeting (fixed) — reviews the outline |

Deploying Tuesday rather than Friday is deliberate: QA is out Thursday, so a Friday deploy has no recovery path.

### Wednesday (09:30–13:00 only)

| Time | Block |
|---|---|
| 09:30–10:00 | Demo prep — environment check, deck, notes |
| 10:00–12:00 | **Demo rehearsal with Sam** (fixed slot, 90 min) |
| 12:00–12:45 | Lunch |
| 12:45–13:00 | Handoff note for the afternoon, close the laptop |

Nothing else fits. By design: escalations and finance work were moved off this day in advance.

### Thursday

| Time | Block |
|---|---|
| 09:30–10:00 | Recurring meeting (fixed) |
| 10:00–11:00 | **Board numbers final check and send to Finance** (deadline Thu 12:00; numbers were built Tuesday) |
| 11:00–12:00 | Demo run-through — talking points, environment final check |
| 12:00–12:45 | Lunch |
| 12:45–15:30 | **Contingency**: patch verify/rollback, finance rework, escalation follow-ups |
| 15:30–16:00 | Pre-demo: environment check, join the customer call |
| 16:00–17:00 | **Customer demo** (alternative slot; length TBC) |

### Friday

| Time | Block |
|---|---|
| 09:30–10:30 | Patch post-deploy verification and close-out (Friday 16:00 deadline met on Tuesday) |
| 10:30–11:15 | Demo follow-up — notes, open questions, next steps to Product |
| 11:15–12:00 | Buffer |
| 12:00–12:45 | Lunch |
| 12:45–14:00 | Strategy outline revisions from Tuesday's leadership feedback |
| 14:00–16:00 | Contingency / overflow |
| 16:00 | Security patch deadline checkpoint — met |
| 16:00–17:00 | Week wrap, handoff notes, sketch next week |

## Dependency chain

```
Lina corrections (Tue ≤11:00) ──► Board numbers 2h (Tue 11:00–13:00) ──► send (Thu ≤12:00)
My review (Mon) ──► QA half-day (Mon 13:00–17:00) ──► change window 30m (Tue 13:45) ──► deploy
Sam (Wed 10:00–12:00) ──► rehearsal 90m ──► demo (Thu 16:00, pending confirmation)
Strategy draft 3h (Mon) ──► send ──► leadership review (Tue 16:00)
Escalations ──► #1 Mon, #2/#3 Tue (pulled forward off Wednesday)
```

## Contingency space

- Tuesday 09:30–10:00 and 13:45–16:00 hold the QA-to-deploy and escalation hand-offs, with slack inside each.
- Thursday 12:45–15:30 is a real, protected buffer, not a parking lot.
- Friday 11:15–12:00 and 14:00–16:00 are overflow.
- The patch is deployed three days early, so Wed–Fri are all available for a rollback.

## Risks and fallbacks

| Risk | Fallback |
|---|---|
| Vendor export late, corrections slip Tuesday | Lina tells me Monday 15:00. If corrections won't land before ~13:00 Tuesday, move the numbers block to Tuesday 13:45–15:45. If they land later, the only remaining window is Thursday 10:00–12:00 with **zero** buffer — escalate to Finance/CEO Monday, not Thursday. |
| QA can't take Monday afternoon | Deploy Wednesday 12:45–13:00 is too tight (rehearsal + lunch). Push QA to Tuesday, change window to Wednesday 09:30–10:00, deploy Wednesday. Still ahead of Friday. |
| Thursday 16:00 demo rejected by the customer | No other slot is stated. Ask Product to secure one Monday; otherwise the demo slips. |
| Board numbers need rework after Finance review | Thursday 12:45–15:30 buffer absorbs it; the 12:00 Thursday deadline is untouched because numbers are sent Thursday morning, not Thursday midday. |
| Demo rehearsal overruns Wednesday | Rehearsal is the only Sam slot; there is no second one. Cap it at 90 minutes and move polish notes to Thursday 11:00–12:00. |
