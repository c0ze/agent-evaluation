# Decisions, Contradictions & Open Questions

Source: `INBOX.md` only. "Confirmed" = stated as fact in the inbox, so the
plan treats it as fixed. Nothing below invents availability for anyone.

## Confirmed (treat as decided)

- **My hours:** 09:30–17:30 Mon–Fri; **Wed 13:00–17:30 unavailable.** No evening/weekend availability stated — none assumed.
- **Finance / board numbers:** final by **Thu 12:00 (hard)**; needs **2 uninterrupted hours after** Lina's corrections (Finance).
- **Lina:** corrections due **Tue by 11:00**; she will know **Mon by 15:00** whether the vendor export puts that at risk (Lina).
- **Sam:** unavailable Tue; **can rehearse Wed 10:00–12:00**. Demo needs a 90m rehearsal and Sam must join the rehearsal (Product/Sam) — so Wed 10:00–11:30 is the only viable rehearsal slot.
- **Security patch:** deploy by **Fri 16:00 (hard)**; order is fixed: my review (60–90m) → QA half day → 30m change window (Engineering). **QA unavailable Thu.**
- **Support escalations:** 3 × ~45m; renewals one needs a response **Mon**; other two have **Wed SLAs** (Support).
- **Recurring meetings (fixed):** Mon 10:00–10:30, Tue 16:00–17:00, Thu 09:30–10:00.
- **Customer fallback exists:** the customer *can also do* Thu 16:00 (Product) — an available alternative, **not yet a confirmed booking**.
- **My preferences (respected in the plan, but preferences — not deadlines):** ≤4h meetings/day; ≥45m lunch.

Decisions the plan makes on that basis (reversible if owners object):
patch review Mon PM → QA Tue; Wed-SLA escalations pulled to Mon/Tue;
board block Tue 11:00–13:00; deploy targeted Fri 10:30, not Fri 16:00.

## Unresolved contradictions

1. **Demo Wed 15:00 (preferred) vs my Wed PM unavailability — direct clash.** Wed 15:00 is impossible for me. Must move to Thu 16:00, be covered by someone else, or be rescheduled — Product/customer to decide. The plan assumes Thu 16:00 *proposed, not confirmed*.
2. **Tue late-morning squeeze.** Strategy send-by Tue 14:00 (3h of work) and the 2h uninterrupted board block (only possible *after* Tue 11:00 corrections) both want Tue 11:00–14:00, which also contains lunch. They cannot both be done Tue late morning. The plan resolves it by doing strategy Mon + Tue 09:30–11:00 and the board block 11:00–13:00 — but if either slips on Tue, the other fails. Needs a priority ruling if Tue goes wrong (board Thu 12:00 is hard; Tue 14:00 is only a review opportunity — see Q5).
3. **Wed SLAs vs Wed capacity.** Two 45m escalations + 90m rehearsal + 45m lunch = 3h45m into a 3.5h Wed morning (09:30–13:00). They do not fit on Wed. The plan pulls both forward to Mon/Tue — Support should confirm early handling is acceptable (it should only help the SLA, but it is a change worth stating).
4. **Patch chain vs Thu QA blackout.** Review → QA half day → deploy by Fri 16:00 leaves no room for a late review: a Thu review would force QA and deploy into Fri alone. The chain only works if my review happens Mon/Tue (plan: Mon). Any pressure to defer the review is a direct threat to Fri 16:00.
5. **Late-corrections fallback has zero margin.** If Lina's Tue 11:00 corrections slip, the only remaining 2h uninterrupted slot is Thu 10:00–12:00 — ending *at* the hard deadline, blocked from starting earlier by the Thu 09:30 meeting, with Wed unusable (rehearsal + unavailable PM). A late vendor export therefore puts Thu 12:00 genuinely at risk; it is not a scheduling detail.
6. **Possible Tue 16:00 double-booking.** The inbox lists both a "Tue 16:00 leadership meeting" (CEO item) and a recurring "Tue 16:00–17:00" meeting. Same meeting, or two? The plan assumes one; if they are two, Tue PM needs rework.

## Questions — assigned to the right person

| # | Question | Owner | Needed by |
|---|---|---|---|
| Q1 | Please confirm Thu 16:00 is **booked** with the customer (Wed 15:00 is impossible — I'm unavailable Wed PM). How long is the demo? If the customer refuses Thu, do you want cover on Wed or a new date? No Fri customer availability is known — please don't assume it. | **Product** | Mon, so Wed rehearsal targets the right session |
| Q2 | Confirming rehearsal **Wed 10:00–11:30** with you. Do you also need to attend the demo itself (proposed Thu 16:00), and are you available then? The inbox only confirms your rehearsal window. | **Sam** | Mon |
| Q3 | At **Mon 15:00**: is the vendor export on track for corrections Tue 11:00? If not, when — and can you send partial corrections Tue so part of the 2h board work can still happen Tue? | **Lina** | Mon 15:00 (her own checkpoint) |
| Q4 | If corrections are late, is **Thu 12:00 immovable**? The fallback slot (Thu 10:00–12:00) has zero margin. Also: happy to receive the Tue handoff, and who proofs before Thu? | **Finance** | Mon 15:00, same escalation as Q3 |
| Q5 | Is the strategy send-by **Tue 14:00 a hard deadline**, or is it only "in time for Tue 16:00 review if possible"? If Tue forces a choice, should the board numbers (hard Thu 12:00) win and strategy slip to later in the week? Also: is Tue 16:00 leadership the same as the recurring Tue 16:00–17:00? | **CEO** (meeting identity: recurring-meeting owner) | Mon |
| Q6 | Confirming: my review Mon PM → your **half-day QA Tue** → proposed **change window Fri 10:30** (well before Fri 16:00). Workable? Who owns rollback if deploy fails? | **Engineering / QA** | Mon, before the review starts |
| Q7 | Renewals escalation gets its response Mon. I plan to clear the two Wed-SLA escalations Mon/Tue (Wed AM is full + I'm off Wed PM) — any reason not to handle them early? | **Support** | Mon |
