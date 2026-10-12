# Decisions

## Confirmed (taken from the inbox, no new commitments invented)

1. **Demo runs Thursday 16:00, not Wednesday 15:00.** Wednesday 15:00 sits inside my stated unavailable block (Wed 13:00–17:30). Thursday 16:00 is the slot the customer already offered, so nothing new is being asked of them. *Pending confirmation from Product/customer — see U1.*
2. **Rehearsal is Wednesday 10:00–12:00.** It is Sam's only free window, it is 90 minutes as specified, and Sam's attendance is required. Nothing else is scheduled on Wednesday.
3. **Escalations #2 and #3 move from Wednesday to Tuesday.** Wednesday has 3.5 usable hours; the 2h rehearsal plus 45 min lunch leaves 45 minutes. Answering Tuesday is earlier than the Wednesday SLA, so this is safe unless Support objects to early handling.
4. **Escalation #1 is answered Monday morning.** It is the one with a Monday deadline and renewal impact, so it takes the first working slot after the recurring meeting.
5. **Security patch deploys Tuesday 13:45–14:15.** Review Monday, QA half-day Monday afternoon, then the 30-minute change window. This is three days ahead of the Friday 16:00 deadline, which matters because QA is unavailable Thursday — a Friday deploy would have no recovery path.
6. **Board numbers get Tuesday 11:00–13:00 as a protected block.** Finance needs two uninterrupted hours *after* Lina's corrections, which arrive by 11:00. Starting the block as soon as they land is the only way to keep it uninterrupted on a Tuesday that also holds QA go/no-go and the change window.
7. **Strategy outline is drafted Monday afternoon and sent Monday evening**, with Tuesday 14:00 as the hard cutoff for the Tuesday 16:00 leadership review. Monday is the only day with a clean 3-hour stretch.
8. **Lunch is reserved every day (45 min minimum)** and meetings stay under 4 hours per day on every day of the plan.
9. **No weekend, no evening-only work, and no schedule built on Wednesday afternoon.** Availability comes only from the inbox.

## Unresolved contradictions / open items

**U1 — Demo slot conflict (needs a decision, not just a confirmation).**
Product prefers Wednesday 15:00; I am unavailable Wednesday 13:00–17:30. I have planned on the customer's alternative, Thursday 16:00, but that is my assumption, not an agreement. If Thursday 16:00 doesn't work, no other slot exists in the notes and the demo slips. **Owner: Product, with the customer.**

**U2 — Lina's corrections might slip, and the fallback is bad.**
Corrections are due Tuesday by 11:00, but depend on the vendor export; Lina will know Monday 15:00. If they slip past ~13:00 Tuesday, the numbers block moves to Tuesday late afternoon. If they slip further, the only remaining window is Thursday 10:00–12:00, which meets the Thursday 12:00 deadline with **zero buffer**. This needs a decision now, not Thursday: either Finance accepts the tight window, or the CEO extends it. **Owner: Lina (timing), then Finance/CEO (consequence).**

**U3 — QA's Monday availability is assumed, not stated.**
The inbox says QA is unavailable Thursday and needs a half-day after review, but never says QA is free Monday afternoon. My whole early-deploy plan rests on that. If QA can't start Monday, the change window moves to Wednesday 09:30–10:00, which still beats Friday but erases the buffer. **Owner: QA lead / Eng.**

**U4 — "Board numbers final by Thursday 12:00" is ambiguous.**
Does final mean *I stop working*, or *Finance has the numbers*? I've planned to send Thursday morning, which satisfies both readings with buffer, but if Finance means something stricter (e.g. a review meeting) the plan changes. **Owner: Finance.**

**U5 — Demo length and attendees are not specified.**
I've allocated 16:00–17:00 Thursday. If the demo is two hours it runs past my day. **Owner: Product.**

**U6 — Who owns Wednesday afternoon.**
Anything landing Wednesday 13:00–17:30 currently has no owner. The escalations were already pulled forward, but demo logistics and the patch deploy could drift there. **Owner: me to state, or delegation needed.**

**U7 — "Early this week" for the strategy outline is a preference, not a deadline.**
I've treated Tuesday 14:00 (the review cutoff) as the real constraint. If the CEO would rather have it Thursday with more depth, that is a legitimate trade and I'd take it. **Owner: CEO.**

## Questions by person

**Lina**
- Q1: Will the vendor export make the Tuesday 11:00 corrections date? (You said you'd know by Monday 15:00 — please tell me either way that afternoon.)
- Q2: If it's late, what's the latest point where corrections still arrive before end of Tuesday?

**Product**
- Q3: Can you confirm with the customer that Thursday 16:00 works instead of Wednesday 15:00? I'm unavailable Wednesday afternoon.
- Q4: How long is the demo, and who else from our side attends?
- Q5: Who runs the demo if I'm pulled into the patch deploy that afternoon?

**QA / Engineering**
- Q6: Can QA take the half-day Monday 13:00–17:00, right after my review?
- Q7: Is Tuesday 13:45–14:15 acceptable for the 30-minute change window, and who sign-offs do we need?
- Q8: Who owns the rollback plan if the deploy fails?

**Sam**
- Q9: Confirming rehearsal Wednesday 10:00–12:00 — that's your only window, right?
- Q10: Are you at the demo Thursday 16:00? I'm assuming yes unless you say otherwise.

**Finance**
- Q11: Does Tuesday 11:00–13:00 still give you what you need for the Thursday 12:00 deadline?
- Q12: What exactly does "final" mean at 12:00 — I'm done, or you have it?

**CEO**
- Q13: Is a first draft Monday evening, reviewed Tuesday 16:00, acceptable — or do you want it earlier/otherwise?
- Q14: How deep should the outline go at this stage?

**Support**
- Q15: Is answering the two Wednesday-SLA escalations on Tuesday OK, or is there a reason to hold them?
