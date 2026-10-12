# Why these three are the top priorities

## 1. Security patch — my review on Monday

It is the only task whose deadline I cannot move, whose duration I do not fully
control, and whose failure is not mine alone. The chain is: my review (60–90 min)
→ QA half day → 30-minute change window → deploy by Friday 16:00. Two things make
my piece urgent rather than merely early:

- **QA is unavailable Thursday.** That deletes the natural mid-week buffer. If my
  review slips past Monday, QA is pushed into Friday morning and the deploy lands
  on the 16:00 deadline with nothing left to absorb a failed verification.
- **My review is the gate.** Everyone downstream is waiting on a 90-minute block
  that only I can do. Delaying it costs the team far more than 90 minutes.

So I do it Monday 11:15–12:45. It costs me a Monday that is already busy, and it
buys a Friday afternoon with 90 minutes of slack. Prioritising by dependency
position, not by deadline distance: Friday's deadline is really Monday's problem.

## 2. Board numbers — the two hours after Lina's corrections

This is the highest-consequence external commitment of the week: Finance says
final by Thursday 12:00, and a board pack that is late is late for everyone,
not just for me. Two features push it up the list:

- **It is blocked on an input I don't control.** Lina's corrections are due
  Tuesday 11:00 and are contingent on a vendor export she won't know about until
  Monday 15:00. The window in which I can do the work is therefore narrow and
  partly outside my control, which is exactly the kind of task that should be
  scheduled the moment its input can arrive.
- **My fallback is thin.** If corrections slip, the only remaining two hours
  before the deadline are Thursday 10:00–12:00, which ends precisely at 12:00 —
  zero slack. That asymmetry is why Monday 15:00 is a real decision point and why
  I've already asked Finance what "final" means under a slip.

I get it done Tuesday 11:00–13:00, roughly 47 hours early, so Thursday 12:00
becomes a non-event.

## 3. Renewals escalation — Monday

Smallest of the three in effort (45 minutes) but it is a hard, already-committed
response with revenue attached, and it is the only item in the week where the
deadline is *today relative to the request*. An unanswered renewal escalation
compounds: the customer's renewal decision does not wait for my Wednesday.
It goes Monday 10:30–11:15, before anything else that day.

## What this ranking deliberately demotes

- **CEO strategy outline (4th).** It is a CEO ask, which usually wins by
  default — but "early this week" is a preference with no stated consequence,
  while the three above have real ones. Rather than demoting it, I front-loaded
  it into Monday afternoon anyway, so it still reaches the Tuesday 16:00
  leadership meeting with four hours to spare. Ranking it 4th costs it nothing
  this week; it only means that if something breaks, this is the first thing I'd
  move — and I'd say so out loud rather than quietly miss Tuesday.
- **Customer demo (5th).** It has fixed external participants, which makes it
  feel urgent, but both the rehearsal and the demo sit on confirmed slots and
  neither is at risk unless Sam or the customer says otherwise. It needs
  confirmation, not prioritisation.
- **The two Wednesday-SLA escalations** ride Wednesday morning, where the SLA
  and my availability agree.

## The general rule I applied

Rank by **deadline hardness × how many other people are blocked by me**, not by
who asked. Patch (hard, blocks QA), board numbers (hard, blocks Finance and the
board), renewals (hard, blocks a customer). Then preferences, however senior the
asker. Where a hard item depends on someone else's input, schedule it against the
earliest moment that input can arrive and reserve the fallback in advance rather
than discovering it later.
