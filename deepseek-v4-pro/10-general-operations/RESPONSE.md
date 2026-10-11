# Top Three Priorities — Reasoning

**1. Security patch (deploy by Friday 16:00).** It has the longest and strictest
dependency chain: my 60–90 min review → a QA half-day → a 30-minute change window.
QA is unavailable Thursday, which eats the slack, so review must happen early
(Monday) to give QA Tuesday/Wednesday and leave Wednesday for the change window.
Shipping it Wednesday also leaves all of Friday as a genuine backstop rather than
the only path. This is a hard deadline, so it outranks everything softer.

**2. Board numbers (final Thursday 12:00).** Also a hard deadline, but it is gated
on an external dependency — Lina's corrections landing Tuesday by 11:00, itself
conditional on the vendor export. Because I can't produce them until that input
arrives, the priority is about *protecting* the two uninterrupted hours (Tuesday
11:00–13:00) and *chasing* Lina Monday 15:00 so a slip doesn't silently eat the
Thursday cut. It ranks second because, unlike the patch, it has a second final
look Thursday morning if anything drifts.

**3. Customer demo (Thursday 16:00).** The customer's preferred Wednesday 15:00 is
inside my blocked Wednesday afternoon, so it cannot happen without either moving
(from Thursday, which the customer already allowed) or asking someone else to
cover — which I won't assume. It also bundles two coordination risks: Sam's
attendance (rehearsal Wednesday 10:00–12:00, plus the live demo) and the
customer's re-confirmation. It ranks third because the deadline is movable and
negotiable, whereas #1 and #2 are fixed.

Why the CEO strategy outline and the support escalations sit below these: the
outline's "early this week" is a preference (I self-impose Tuesday 14:00), and
the escalations are short, discrete 45-minute items with clear SLAs that fit into
the gaps rather than shaping the week's shape.