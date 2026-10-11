# RESPONSE.md — Reasoning behind the top three priorities

## How I ranked

I scored every demand on three axes: (1) is the deadline **hard or a preference**, (2) how much
**dependency on other people** sits in front of it, and (3) how much **float** exists before it
breaks. Items with hard deadlines, upstream dependencies, and thin float go first, because those
are the ones that fail silently and take other teams down with them. Preferences (demo Wed 15:00,
"early this week") were scheduled only after hard items were protected, and never by inventing
availability I don't have.

## Priority 1 — The security-patch chain (review → QA → deploy by Fri 16:00)

This is the only item that is **hard-deadline + multi-hop + other-team-dependent**. It is not one
task but a chain: my review (60–90 min) gates QA (a half day), which gates a 30-minute change
window. QA is unavailable Thursday, so the chain has exactly two clean days to run (Tue/Wed)
before the buffer collapses. If I let the review slip to Tuesday, QA lands Wednesday, the change
window lands Thursday (QA out) or Friday — right on top of the hard deadline with no recovery
room. I therefore start the review **Monday 10:30–12:00**, the earliest point that doesn't collide
with the renewals escalation or the 10:00 standup. Front-loading this converts a just-in-time
deadline into a done-by-Wednesday one and buys two days of float. It's #1 because its failure mode
is the worst (missed hard deadline) and its dependencies are outside my control.

## Priority 2 — Board numbers (final by Thu 12:00)

Hard deadline, and the **only one with an external input risk attached**: the two uninterrupted
hours can't start until Lina's corrections arrive Tuesday morning, which in turn depend on a
vendor export that may be late. This is a genuine single point of failure, so I protected it two
ways. First, I booked the **Tue 11:00–13:00** block meeting-free the moment corrections are due,
so the two focused hours are real and uninterrupted. Second, I kept **Thu 10:00–12:00** open as a
fallback and pre-committed to a check-in with Lina Monday afternoon (she knows the export status
by 15:00). It ranks above the strategy draft because a late vendor export is a plausible,
partly-outside-my-control event, whereas the strategy draft's inputs are entirely mine. I also
flagged a degrade option to Finance (Q3) rather than promise the Thursday fallback will hold with
zero slack — I'd rather negotiate the definition of "final" in advance than miss quietly.

## Priority 3 — Demo readiness: resolve the timing conflict + lock the rehearsal

I put the demo third in *execution* order but first in *things-to-surface*, because it contains
the week's one real **contradiction**: Product prefers Wed 15:00, but I am hard-unavailable Wed
13:00–17:30, and I won't silently pretend otherwise. The customer already offered **Thu 16:00**,
so the resolution is cheap *if it's confirmed early*. The rehearsal is the binding constraint:
Sam is out Tuesday and free only Wed 10:00–12:00, so **Wed 10:00–11:30** is the sole possible
slot and I locked it first, treating it as immovable and building the rest of Wednesday around it.
This is priority three rather than one because the demo is a strong preference, not a hard
deadline — but its dependency (Sam's single window) is fragile, so it needs an early decision and
an explicit confirmation request rather than optimistic scheduling. Note the rehearsal proceeds
whether or not the timing question is settled, since it's valid for either outcome.

## What I deliberately did *not* prioritize

The **strategy draft** is real work but rests entirely on a preference ("early this week," a soft
Tue 14:00 cutoff). I gave it the Monday 13:30–16:30 focused block and a Monday-EOD send — which
actually *beats* the soft cutoff and lets Tuesday's leadership meeting review it — but I refused
to trade a hard deadline (board numbers, Tuesday morning) to protect a preference. The three
**escalations** are hard but self-contained and short (45 min each), so I fit them into existing
gaps (renewals Monday, the two SLA ones Tuesday, a day early) without letting them displace the
dependent chains. Roughly **9 hours of slack** stay unscheduled across the week on purpose: a plan
with no contingency isn't a plan, it's a hope, and this week has at least two things (vendor
export, QA Tuesday) that can slip for reasons outside my control.
