# Decisions

## A. Confirmed decisions (proceeding on these unless someone objects by Monday 12:00)

1. **Security patch review: Monday 11:15–12:45.** QA is off Thursday and needs a
   half day after my review; Monday is the only start that leaves a re-test
   loop before Friday 16:00.
2. **Change window: Friday 10:00–10:30 by default, 14:00–14:30 as fallback.**
   Engineering can pull it earlier if they want — Wednesday 09:30–10:00 is
   possible but I go straight into the rehearsal afterwards, and Thursday
   afternoon has no QA cover.
3. **Board numbers block: Tuesday 11:00–13:00, do-not-disturb.** Plan B Tuesday
   14:00–16:00; Plan C Thursday 10:00–12:00 (zero margin).
4. **Escalation #1 (renewals) is answered Monday 10:30–11:15**, before anything
   that can move.
5. **Escalations #2 and #3 close Monday 16:30 and Tuesday 13:45.** Not left for
   Wednesday: the morning is the only rehearsal slot and the afternoon is out.
6. **Strategy outline: drafted Monday 13:30–16:30, sent Tuesday morning (target
   11:00).** If it isn't ready by 13:45 Tuesday it goes Wednesday morning for
   async review rather than being rushed for the 16:00 meeting.
7. **Demo rehearsal: Wednesday 10:00–11:30 with Sam** — the only slot Sam gave.
8. **I will not attend anything Wednesday 13:00–17:30**, including a 15:00 demo.
   I'm proposing Thursday 16:00 to Product.
9. **Nothing outside 09:30–17:30; 45 minutes for lunch every day; no day above
   two hours of meetings** (the four-hour cap is never close).

## B. Unresolved contradictions

| # | Contradiction | Proposed resolution | Who decides |
|---|---|---|---|
| 1 | Product prefers the demo **Wed 15:00**; I am **unavailable Wed 13:00–17:30**. | Take the customer's **Thu 16:00** option. If Product insists on Wednesday, it runs without me — and Sam's Wednesday-afternoon availability was never stated. | Product (with the customer) |
| 2 | Finance assumes Lina's corrections arrive **Tuesday morning** and wants two uninterrupted hours; Lina says **"unless the vendor export is late"**; the board cutoff (**Thu 12:00**) is fixed. | Tue 11:00–13:00 primary; Tue 14:00–16:00 if late; Thu 10:00–12:00 last resort. There is **no** two-hour slot on Wednesday. Corrections later than Wednesday put Thursday 12:00 at risk. | Lina (ETA, Mon 15:00); Finance (what "final" means; whether a preliminary set helps) |
| 3 | Patch needs review → QA half day → change window by **Fri 16:00**, and **QA is off Thursday**. | Review Mon, QA Tue, deploy Fri 10:00. A single QA re-test loop fits only if QA can work Friday morning. Two loops do not fit. | Engineering / QA |
| 4 | CEO wants the outline **"early this week"**, ideally by **Tue 14:00**; Monday is also the only day for the renewals escalation and the patch review. | Draft Monday afternoon, send Tuesday morning. Tuesday 14:00 is a target, not a promise; fallback is Wednesday morning. | CEO (is async/next meeting acceptable?) |
| 5 | Wednesday morning is over-subscribed under Plan B/C: rehearsal (fixed), Wednesday SLAs, and possibly board work. | Clear both Wednesday-SLA escalations by Tuesday; never put board work on Wednesday. | Me |
| 6 | "Sam must join" — the rehearsal is explicit; whether Sam must also be in the **demo** is not. | Assume rehearsal only until told otherwise; ask. | Product / Sam |
| 7 | 45-minute lunch preference vs. a 3.5-hour Wednesday. | Lunch held 12:15–13:00 inside working hours; if the afternoon block already covers lunch, that becomes buffer. | Me |
| 8 | Exact **Wednesday SLA times** are not stated; if either is before 09:30 Wednesday, Tuesday is the real deadline. | Plan already closes both by Tuesday 14:30. | Support (confirm times) |

## C. Questions, by owner

**Lina**
- Your Monday 15:00 call on the vendor export: on time, or late? If late, what
  is the revised ETA (even rough)?
- If late, can you send a partial set of corrections so I can start?

**Finance**
- Does "final by Thursday 12:00" mean delivered to you, or approved by you? If
  approved, what is your turnaround, so I know my real cutoff?
- If corrections slip past Tuesday, my only remaining two-hour slot is Thursday
  10:00–12:00. Would a preliminary set on Wednesday morning help, and what goes
  to the board if corrections arrive after Wednesday?
- Does anyone need to be in the room during the two-hour block, or is it mine
  alone?

**Product**
- Can we take the customer's Thursday 16:00 option? Wednesday 15:00 is inside my
  unavailable block.
- How long is the demo? It has to end by 17:30.
- Must I attend the demo, or is the rehearsal my part?
- Is the demo environment ready before Wednesday 10:00?

**Sam**
- Confirm Wednesday 10:00–11:30 for the rehearsal.
- Are you needed at (and available for) a Thursday 16:00 demo?
- Any Thursday time for a 15-minute pre-demo check? Not assumed.

**Engineering**
- Does Friday 10:00–10:30 work for the change window? Do you want it earlier?
- Who needs to be in the window — me, QA, both?
- Rollback plan if the deploy misbehaves, and who owns it?
- If QA finds issues Tuesday, can a fix be ready Wednesday for my re-review on
  Thursday?

**QA**
- Can you take the half day Tuesday (or Monday afternoon, if you have room)?
- Are you available Friday morning for a re-test if it comes to that?

**CEO**
- Is Tuesday 14:00 a hard need, or is Wednesday morning for async review
  acceptable if Monday gets eaten by the escalation or the patch?
- What shape is "useful first draft" — one page of headings, or fuller?

**Support**
- Exact SLA times for escalations #2 and #3 on Wednesday.
- Anything I need to know about the renewals one before Monday 10:30?
- Does a holding response count against the SLA, or does it need a full answer?

## D. Assumptions I am making (say so if wrong)

- The Tuesday 16:00–17:00 recurring meeting is the leadership meeting the CEO
  referred to.
- The 30-minute change window needs me present; I've blocked it either way.
- The demo is at most 90 minutes and I'm expected to attend.
- Lina's Monday 15:00 update reaches me without chasing; I act on it at 17:15
  the same day.
- "Half day" for QA is roughly four hours inside one calendar day.
- Wednesday lunch sits at 12:15–13:00 inside working hours.
