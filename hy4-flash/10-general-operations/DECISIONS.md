# Decisions, Contradictions & Open Questions

## Confirmed decisions
1. **Customer demo → Thursday 16:00.** Wednesday 15:00 is impossible: I am unavailable Wednesday 13:00–17:30. Thursday 16:00 is the stated alternative; I have built the plan around it.
2. **Demo rehearsal → Wednesday 10:00–11:30.** It is the only window where I am available and Sam can join (Sam free Wed 10:00–12:00; unavailable Tuesday).
3. **Board-numbers work → Tuesday 11:00–13:00.** Two uninterrupted hours immediately after Lina's corrections (due Tue ≤11:00) and safely before the Thursday 12:00 hard deadline.
4. **Security patch:** I will review Monday 15:15–16:30, QA runs Tuesday (half day), change window Friday 14:00–14:30 — comfortably before the Friday 16:00 hard deadline. QA is not scheduled Thursday.
5. **Renewal escalation → Monday** (hard); the other two escalations → Tuesday/Wednesday within their Wednesday SLAs.
6. **CEO strategy outline:** draft Monday (3 focused hours), send by Tuesday 14:00 so the leadership meeting can review it. Treated as an opportunity, not a hard commitment.
7. **Send vs. hold strategy draft:** hold the draft Monday; only send by Tue 14:00 if it is genuinely useful by then — I will not rush a low-quality draft to hit a soft time.

## Unresolved contradictions / conflicts
- **Demo preferred slot vs. my availability.** Product prefers Wed 15:00, but that falls in my unavailable window. Resolved in favor of Thu 16:00 — **requires Product/customer confirmation**.
- **Vendor-export risk to corrections.** Lina's Tue 11:00 estimate depends on the vendor export; she confirms status Monday 15:00. If late, the board-numbers block must move — fallback exists but increases risk to the Thu 12:00 hard deadline.
- **Tuesday is overloaded if corrections arrive late.** The 2-h board block, strategy send, one escalation, and the leadership meeting all compress into Tuesday. Contingency blocks are allocated, but late corrections could squeeze them.
- **CEO "early this week" is vague** — not a hard deadline. The Tue 14:00 leadership slot is the only concrete anchor and is an opportunity, not a mandate.
- **Strategy Q could be answered in Tue's leadership meeting** (ending 17:00), which is later than the 14:00 send, so the meeting may not be a useful review point unless the draft is sent early.

## Questions — assigned to the right person
| Question | Owner | Needed by | Why |
|---|---|---|---|
| Confirm Thu 16:00 works for the customer (Wed 15:00 is impossible for me) | **Product** | Monday | Locks the demo slot and rehearsal timing |
| Will vendor export arrive on time for Tue ≤11:00 corrections? | **Lina** | **Monday 15:00** (she already committed to know by then) | Gates the board-numbers block |
| Is Tue 14:00 leadership review still useful, or can the strategy be reviewed later / async? | **CEO** | Monday | Clarifies whether the 14:00 send is worth prioritizing |
| Confirm QA can run half-day Tuesday after my Monday review (QA is off Thursday) | **Engineering / QA lead** | Monday | Protects the Fri 16:00 deploy hard deadline |
| Confirm renewal-escalation content/recipient so it goes out Monday | **Support** | Monday AM | Hard SLA today |
