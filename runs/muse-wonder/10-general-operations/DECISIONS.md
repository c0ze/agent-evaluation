# Decisions & Open Questions

## Confirmed decisions

These follow directly from the constraints in `INBOX.md`; no availability has been invented beyond what was stated.

1. **Customer demo moves from Wed 15:00 to Thu 16:00.** You are unavailable Wed 13:00–17:30, so Wed 15:00 is impossible. Thu 16:00 was offered by the customer as the alternative and is used in the plan.
2. **Demo rehearsal is Wed 10:00–11:30 with Sam.** Sam is unavailable Tuesday and offered Wed 10:00–12:00; Wed morning is your only Wednesday availability. The 90-minute rehearsal fits inside both.
3. **Finance work is a protected Tue 11:00–13:00 block.** Finance needs two uninterrupted hours after Lina's corrections (due Tue 11:00) and the board deadline is Thu 12:00. Tue is the earliest possible slot; Thu morning is held as verification/contingency, not the main effort.
4. **Security patch review happens Monday afternoon.** The chain review → QA half-day → 30-min change window must end Fri 16:00, and QA is unavailable Thursday. Reviewing Monday leaves Wed for QA and Fri for the change window, instead of compressing QA and deploy into Friday.
5. **Strategy draft is written mainly on Monday.** Three focused hours plus Tue 14:00 send (to reach Tue 16:00 leadership) cannot fit on Tuesday alongside the finance block, so Monday carries the drafting.
6. **The two Wednesday-SLA escalations are planned for Tuesday afternoon.** Wednesday morning (09:30–13:00) cannot reliably hold a 90-minute rehearsal plus two 45-minute escalations plus prep. Wed 09:30 remains the fallback.
7. **Meeting load and lunch preferences are respected.** No day exceeds 4 hours of meetings (max ~1.5 h) and every day has ≥45 minutes for lunch; Wednesday lunch sits in the unavailable afternoon block.

## Unresolved contradictions

1. **Demo Wed 15:00 preference vs your Wed 13:00–17:30 unavailability.** Contradiction in the inbox itself. Resolved in plan by using Thu 16:00, but Product/customer have not yet confirmed in these notes.
2. **Wednesday capacity.** 3.5 available hours vs 90-min rehearsal + 2×45-min Wed-SLA escalations + demo prep. Not all fit well on Wednesday; the plan pre-empts the SLAs on Tuesday, but if Tuesday slips, Wednesday is over-full.
3. **Tuesday clustering.** Finance 2 h (from 11:00), strategy send 14:00, and leadership 16:00 all land Tuesday. Feasible only because strategy drafting moved to Monday — any Monday slip makes Tuesday impossible.
4. **Lina dependency risk.** Corrections due Tue 11:00 "unless the vendor export is late", known only Mon 15:00. If late, the Thu 12:00 board deadline is immediately at risk; no revised Lina delivery time is given for that case.
5. **QA timing is unspecified.** QA needs "half day after review" and is unavailable Thursday, but no QA day/time is confirmed. The plan assumes Wednesday; if QA can only do Friday, review + QA + change window all compress into the deploy day.
6. **Demo duration and environment needs are unstated.** Thu 16:00 is planned as ~60 minutes; rehearsal is 90 minutes but the demo length, environment owner, and whether Sam must attend the demo itself are not specified.

## Questions — assigned

| # | Question | Owner to answer | Needed by |
|---|---|---|---|
| 1 | Is the vendor export on time? If late, when exactly will corrections land? | **Lina** | Mon 15:00 (as promised) |
| 2 | Does Tue 11:00–13:00 as the uninterrupted finance block work, and is Thu 12:00 immovable if Lina slips? | **Finance** | Mon EOD |
| 3 | Confirm Thu 16:00 demo with the customer; how long is it, who owns the environment, must Sam attend the demo itself? | **Product** (customer via Product) | Tue EOD |
| 4 | Confirm rehearsal Wed 10:00–11:30 and that 10:00–12:00 covers any overrun fixes. | **Sam** | Mon EOD |
| 5 | Confirm QA can take the half-day on Wednesday after Monday's review, and confirm change-window time/owner for Friday (plan holds 14:00). | **Engineering / QA** | Tue EOD |
| 6 | What scope/length makes the strategy outline useful, and is a Tue 14:00 send the right target? | **CEO / leadership organiser** | Mon EOD |
| 7 | For the two Wednesday escalations: is the SLA Wed end-of-day or a specific time, and is a Tuesday response acceptable? Details for the Monday renewal escalation? | **Support** | Mon morning |
| 8 | Patch review estimate is 60–90 min — is 90 min the right planning figure, and what blocks QA starting? | **Engineering** | Mon 15:00, before review |
