# DECISIONS.md

## A. Confirmed decisions (I own these; no one needs to be asked)

1. **Start the security-patch review Monday 11:15.** Friday 16:00 is a hard
   deadline, but review → ½-day QA → 30-min change window is the longest chain
   in the week and QA cannot run Thursday. Starting Monday lets QA run Tuesday
   and the patch deploy Tuesday — three days of buffer. "Deploy by Friday" is a
   latest deadline, so deploying earlier is legitimate.
2. **Move the customer demo from the preferred Wednesday 15:00 to the
   customer-offered Thursday 16:00.** Wednesday 13:00–17:30 is unavailable, so
   Wed 15:00 is impossible. Thursday 16:00 is the customer's own alternative,
   so moving is within what was offered, not an invented slot.
3. **Schedule the 90-min rehearsal Wednesday 10:00–11:30 with Sam.** Sam is
   unavailable Tuesday and free only Wednesday 10:00–12:00; this is the single
   window that satisfies the rehearsal requirement. The remaining 30 min of
   Sam's window is kept as buffer.
4. **Hold board numbers in a protected two-hour block Tuesday 13:00–15:00,
   after Lina's corrections (due by 11:00), and protect Thursday 10:00–12:00 as
   the fallback.** Finishing Tuesday is well before the hard Thursday 12:00
   cutoff; the Thursday block is insurance if corrections slip.
5. **Respond to the renewals escalation Monday 10:30–11:15** (it needs a Monday
   response and affects revenue) and **clear the other two escalations Tuesday
   09:30–11:00** — ahead of their Wednesday SLAs, buying a day of buffer.
6. **Draft the CEO strategy outline Monday 13:30–16:30** (three focused hours)
   so it can reach the Tuesday 16:00 leadership meeting before the 14:00
   cutoff. Treated as a preference/opportunity, so it yields to hard items.
7. **Honor every stated constraint without exceptions:** 09:30–17:30 hours,
   Wednesday afternoon blackout, QA off Thursday, Sam off Tuesday, all three
   recurring meetings, ≥45 min lunch daily, and ≤4 h of meetings/day (the
   busiest day, Tuesday, has 1 h of meetings).

## B. Unresolved contradictions (need a decision from someone)

1. **"Demo preferred Wednesday 15:00" vs. "Wednesday 13:00–17:30
   unavailable."** These cannot both hold. I resolved it in the plan by taking
   the customer's stated alternative (Thursday 16:00). **This must be confirmed
   with the customer/Product before the Wednesday rehearsal is locked.**
2. **"Board numbers final by Thursday 12:00" and "two uninterrupted hours after
   Lina sends corrections Tuesday morning" vs. "Lina will know by Monday 15:00
   whether the vendor export is late."** If the export is late, corrections may
   miss Tuesday 11:00 and the two hours after them could collide with the
   Thursday noon cutoff. The Thursday 10:00–12:00 fallback covers a short slip,
   but a slip past Thursday 10:00 breaks the deadline. **Lina must give a firm
   revised ETA at the Monday 15:00 status check.**
3. **"Strategy outline early this week / useful first draft takes three focused
   hours / Tue 16:00 leadership review if sent by 14:00" vs. a Monday already
   carrying the renewals response, the patch review, and a recurring meeting.**
   Three contiguous hours fit Monday only if the renewals escalation and review
   stay on schedule. "Early this week" is soft; **CEO should confirm whether the
   Tuesday 16:00 review is mandatory or whether a Wednesday/Thursday draft is
   acceptable**, so we know what yields when Monday is disrupted.

## C. Open questions — assigned to the right person

| # | Question | Assigned to | Why them | Needed by |
|---|---|---|---|---|
| 1 | Is the vendor export on time? If late, what is the firm revised ETA for corrections? | **Lina** | She owns the corrections and said she'll know by Monday 15:00 | Mon 15:00 (I check ~16:30) |
| 2 | Confirm the demo moves to **Thursday 16:00** (customer's stated alternative), since Wed 15:00 is impossible. | **Product** (with the customer) | Product owns the demo and the customer relationship | Before Wed 10:00 rehearsal |
| 3 | How long is the demo, exactly? I assumed ~60 min. | **Product** | Owns the demo format | Before Thu 16:00 |
| 4 | Is "half day" QA a contiguous 4-hour block, and can QA start Tuesday right after the Monday review? | **Engineering / QA lead** | They own QA scheduling; QA is unavailable Thursday | Monday, before review handoff |
| 5 | Confirm Sam can hold Wed **10:00–11:30** for the rehearsal (within his stated 10:00–12:00 window). | **Sam** | His availability is the binding constraint | Tue EOD |
| 6 | Is the Tuesday 16:00 strategy review **mandatory** (draft by 14:00) or optional? If optional, is a Wednesday/Thursday draft acceptable? | **CEO** | Sets whether "early this week" is hard or soft | Mon EOD |
| 7 | If board numbers are finalized Tuesday, should they be delivered Tuesday or held until nearer the Thursday 12:00 cutoff? | **Finance** | They own the board-number deliverable and its acceptance | Tue 15:00 |
| 8 | Which single escalation affects renewals? Confirm the Monday response content/owner for sign-off. | **Support** | They own the escalations and the customer relationship | Mon 10:30 |

## D. Hard vs. soft, for the record

- **Hard (no renegotiation):** renewals response Monday; two support SLAs
  Wednesday; board numbers final Thursday 12:00; patch deploy by Friday 16:00;
  working hours, recurring meetings, all unavailability windows, lunch ≥45 min,
  ≤4 h meetings/day, QA off Thursday, Sam off Tuesday, rehearsal ≥90 min with
  Sam.
- **Soft (yields first):** "early this week" strategy and the Tue 16:00 review;
  demo Wed 15:00 (already infeasible, moved to Thu 16:00); exact rehearsal start
  within Sam's window; deploying the patch on Tuesday rather than nearer Friday;
  clearing the Wednesday-SLA escalations on Tuesday rather than Wednesday.
