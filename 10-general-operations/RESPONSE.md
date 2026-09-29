# Reasoning Behind the Top Three Priorities

I ranked by four things: how hard the deadline is, how little slack the work has, how much of it depends on people I do not control, and how expensive a miss would be. The ranking is not the same as the running order. Monday's order is set by which item is earliest and smallest.

## 1. Board numbers final by Thursday 12:00

- **Hard and unforgiving.** Finance says "must", and the notes give no fallback.
- **Externally gated.** I cannot start until Lina's corrections land (Tuesday by 11:00, unless the vendor export is late). I will not know whether they are late until Monday 15:00.
- **It has the worst fallback.** Wednesday cannot hold 2 uninterrupted hours. The rehearsal splits the morning and the afternoon is unavailable. If the corrections slip past Tuesday, the only clean window is Thursday 10:00-12:00, right after a 09:30 meeting and with zero slack.
- **What I did about it.** I protected Tuesday 11:00-13:00 above everything else. I left Tuesday 13:45-15:45 open as a fallback for late corrections. I held Thursday 10:00-12:00 as reserve even if the numbers are finished early. I also put the Monday 15:00 checkpoint in the plan, so a late export is handled Monday, not Thursday.

## 2. Security patch live by Friday 16:00

- **Hard, and it has the longest chain.** Review (60-90 min), then half a day of QA, then a 30 min change window. Three steps, with QA out on Thursday. That leaves QA on Monday, Tuesday, Wednesday or Friday.
- **Each day of delay removes options.** If QA slips to Friday, there is no retry before 16:00. This is the only priority where an early small action, the Monday review, buys a lot of later safety.
- **What I did about it.** I put the review Monday 11:15-12:45, budgeted at the 90 min upper bound, so QA can start as early as possible. The Monday 09:30 triage includes asking Engineering to book QA. I set Friday 14:30 as the latest change-window start, so 90 min is left for a retry or rollback.
- **Why it is not first.** Its deadline is later than the board numbers, and it has one more fallback day (Friday). If both were at risk at once, I would protect the board numbers first, because they have less slack.

## 3. Renewals escalation response on Monday

- **Earliest hard deadline in the week, and small.** It takes about 45 min and has revenue impact. Missing it costs a lot relative to the effort.
- **Why it is ranked third but scheduled first.** It is the least difficult and least uncertain of the three, so it ranks lowest. Because it is due Monday and costs only 45 min, I do it at 10:30, right after the recurring meeting, before anything can push it out.
- **The other two escalations** have Wednesday SLAs. I schedule both by Tuesday 11:00, because I am gone after 13:00 Wednesday and the SLA times are unknown.

## What I deliberately ranked lower

- **Strategy outline.** It is a soft ask ("early this week"). The 14:00 Tuesday cut-off only matters if the outline is to be reviewed at the 16:00 meeting. It is still the largest block of time (3 h), and Monday afternoon is the only place it fits, because Tuesday morning cannot hold 3 focused hours before 14:00. So it is scheduled, but it is the first thing I would send as a rough draft if the week goes wrong.
- **Customer demo.** The rehearsal is fixed (Wednesday 10:00-11:30, inside Sam's only stated window). The demo date is a preference, and the preferred slot, Wednesday 15:00, is inside my unavailable time. I proposed Thursday 16:00. That is Product's and the customer's decision, not something I can lock in myself.

## What I did not invent

- I did not assume QA's free days or hours. I did not assume Sam's availability outside Wednesday 10:00-12:00. I did not assume the demo length, the SLA cut-off times, or who attends the change window. I did not plan any work outside 09:30-17:30 or after 13:00 Wednesday.
- Each of these is listed as a question with a named owner in `DECISIONS.md` and appears in `DRAFT_REPLY.md`.
- I assumed the Tuesday 16:00 leadership meeting is the recurring Tuesday 16:00-17:00 meeting, and I flagged that as a question.
