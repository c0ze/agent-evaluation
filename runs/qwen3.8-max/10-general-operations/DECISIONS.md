# Decisions Log

## Confirmed decisions (made from stated facts)

| # | Decision | Basis |
|---|---|---|
| D1 | Security patch review Monday 10:30–12:00; QA Tuesday 09:30–13:30; change window Wednesday 09:30–10:00 | Deploy-by-Friday-16:00 is hard; QA is unavailable Thursday, so the chain must complete review→QA by Wednesday. Starting Monday buys ~2 days of buffer. |
| D2 | Board-numbers finalization block Tuesday 11:00–13:00, meetings-free | Corrections arrive by Tue 11:00; finance needs two uninterrupted hours; hard deadline Thu 12:00. Doing it Tuesday leaves Thursday 10:00–12:00 as a safety net. |
| D3 | Demo rehearsal Wednesday 10:00–11:30 with Sam | Sam is out Tuesday and only available Wed 10:00–12:00; rehearsal needs 90 min. This is the only feasible overlap — treated as immovable. |
| D4 | Strategy draft Monday 13:30–16:30, sent to CEO Monday EOD | Needs 3 focused hours; "early this week" is a preference; Tuesday 14:00 is a soft cutoff to enable review at the Tue 16:00 leadership meeting. Monday EOD meets both. |
| D5 | Renewals escalation answered Monday 12:00–12:45; other two escalations done Tuesday (ahead of Wednesday SLA) | Monday response is required; Wednesday is short (unavailable 13:00) so SLA work is pulled earlier. |
| D6 | Thursday 10:00–12:00 held open as board-numbers fallback | Protects the only hard financial deadline against a late vendor export. |
| D7 | No work scheduled Wednesday 13:00–17:30 or any QA-dependent work on Thursday | Stated unavailability; not negotiable and not worked around. |

## Unresolved contradiction

**C1 — Demo timing conflict.** Product *prefers* Wednesday 15:00, but Wednesday 13:00–17:30 is a
hard unavailability. Both cannot hold. Proposal: take the customer's offered alternative,
**Thursday 16:00**, and confirm quickly (Q1). Until confirmed, the rehearsal (Wed 10:00–11:30)
proceeds anyway — it is valid for either outcome and Sam has no other window. Note: if product
insists on Wednesday, the demo would have to run **without me** or move earlier than 13:00,
which collides with the rehearsal — flag, don't absorb.

**C2 — "Early this week" vs. 3 focused hours.** The CEO's ask is vague ("early this week") while a
useful draft needs three focused hours, and Tuesday morning is the only other large free block
but is reserved for board numbers (hard deadline). Resolved in favor of the hard deadline:
strategy goes Monday afternoon. If Monday's block is lost, the fallback is Tuesday 09:30–12:30
with board numbers moved to Tuesday 14:30–16:30 — only viable if corrections still arrive by
~14:00. This fallback is a decision I should not make alone (Q4).

## Questions, assigned

| # | Question | To | Needed by | Why it matters |
|---|---|---|---|---|
| Q1 | Wed 15:00 is impossible for me (unavailable 13:00–17:30). Can we lock the customer for **Thu 16:00**, and how long is the demo (I assumed 60 min)? | Product (customer-facing) | **Monday EOD** — drives rehearsal framing and Thursday layout | Only unresolved scheduling contradiction; customer already offered Thu 16:00 |
| Q2 | Is the vendor export on track? You'll know by Mon 15:00 — please confirm either way. If late: when will corrections actually land, and can partial corrections come first? | Lina | Monday 15:00–17:00 | Determines whether board numbers stay Tuesday or fall back to Thursday 10:00–12:00 (zero slack) |
| Q3 | If corrections slip past Wednesday noon, is Thu 12:00 truly immovable, and what is the minimum viable "final" (e.g., provisional numbers with a delta note)? | Finance | Tuesday morning | The Thursday fallback has zero buffer; I need a degrade option before committing to one |
| Q4 | Is Monday EOD delivery of the strategy draft acceptable for "early this week," given Tuesday morning is reserved for board numbers? | CEO (or chief of staff) | Monday, with the draft | Confirms a preference is satisfied without silently trading away a hard deadline |
| Q5 | Can QA take the patch **Tuesday 09:30–13:30** (half day after my Monday review), and is the **Wed 09:30–10:00** change window bookable? Fallbacks: Thu 10:00–10:30, Fri 10:00–10:30. | Engineering / QA lead | Monday 10:00 | QA is out Thursday; losing Tuesday pushes the window late against a hard Friday 16:00 deadline |
| Q6 | Confirm you can rehearse **Wed 10:00–11:30** — it's the only overlap we have. | Sam | Monday EOD | No alternative rehearsal slot exists; if Sam loses it, the demo quality is at risk and we should tell the customer early |
| Q7 | Renewals escalation: does the Monday response need to come from me personally, or can support send it with my sign-off? | Support lead | Monday 10:00 | If sign-off suffices, Monday's block becomes extra contingency |

## Decision rules adopted (to avoid re-litigating)

1. Hard deadlines (board Thu 12:00, patch Fri 16:00, escalations Mon/Wed) outrank preferences
   (demo Wed 15:00, "early this week," Tue 14:00 send).
2. Stated unavailability (Wed 13:00–17:30, QA Thu, Sam Tue) is never worked around silently —
   conflicts get surfaced with a proposal, not absorbed.
3. Single-possible-window items (Sam's Wed 10:00–12:00) are locked first; everything else flexes
   around them.
4. Every day keeps ≥45 min lunch and ≤4h of meetings; ~9h of contingency slack is preserved
   across the week rather than back-filled.
