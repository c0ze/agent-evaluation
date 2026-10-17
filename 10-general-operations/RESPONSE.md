# Reasoning behind the top three priorities

Ranking rule: **immovability of the deadline × length of the dependency
chain × consequence of missing it.** Note that *priority* (what must not
fail) differs from *scheduling order* (what I touch first each day) — the
strategy outline is scheduled early Mon/Tue without being a top priority,
because its Tue 14:00 review opportunity expires, whereas the items below
are prioritised because their deadlines do not move.

## 1. Board numbers — final by Thu 12:00 (Finance, hard)

The hardest constraint in the week. It needs **2 uninterrupted hours that
can only start after Lina's corrections (Tue 11:00)**, and uninterrupted
2h slots are scarce: Wed AM is consumed by the Sam rehearsal (his only
window), Wed PM I'm unavailable, and Thu AM is broken by the 09:30 meeting
with the deadline at 12:00. That leaves Tue 11:00–13:00 as effectively the
*only* safe slot — so everything else on Tue (strategy send, lunch,
Support C) is arranged around protecting it, and the Mon 15:00 vendor
signal from Lina is treated as a same-day escalation point, not a status
update. A board deadline also isn't a "send it Friday instead" item: the
consequence lands outside the team. Hence #1.

## 2. Security patch — deployed by Fri 16:00 (Engineering, hard)

Latest deadline, but the **longest sequential chain**: my review (60–90m)
→ QA half day → 30m change window, with a **Thu QA blackout** in the
middle. Working backwards from Fri 16:00, a Thu review would compress QA
and deploy into Fri with zero slack; a Wed review is barely possible
(rehearsal + PM unavailability). The chain is only comfortable if my
review happens Mon/Tue — counter-intuitively, the Friday deliverable
demands Monday action. It's also a security fix: missing the window
extends exposure, not just embarrassment. Deploy is therefore targeted at
Fri 10:30 (~5h of rollback margin), with the review Mon 15:15–16:45 and
QA Tue. Ranked below the board numbers only because its deadline is later
and its chain, once started Mon, has Wed/Fri buffer — whereas the board
chain has exactly one viable slot.

## 3. Renewals support escalation — response Mon (Support, hard)

The **only Monday-hard item**, and the one with a stated revenue link
("affects renewals"). It's small (~45m) but time-boxed to today: unlike
everything else, it cannot be rescheduled within the week at all.
Clearing it Mon 13:15–14:00 removes the week's most urgent external
commitment before the two big chains (board, patch) consume Tue–Fri, and
its two Wed-SLA siblings are pulled forward to Mon/Tue for the same
reason — Wed itself (rehearsal + unavailable PM) cannot honour a Wed SLA
that is left until Wed.

## Why the visible items rank below these

- **Strategy outline (CEO):** important, but worded softly — "early this week." Tue 14:00 is a *cutoff for an opportunity* (review at Tue 16:00), not a stated hard deadline. The plan still aims for it (Mon 2h + Tue 1h, sent before the board block), but if Tue forces a choice, the hard Thu 12:00 board deadline should win — that's Q5 in DECISIONS.md, asked rather than assumed.
- **Customer demo:** high visibility, but the inbox itself supplies a fallback (Thu 16:00) for the impossible Wed 15:00 preference. The urgent Monday action is *getting Thu confirmed and booked* (Q1/Q2), after which Wed rehearsal → Thu demo follows mechanically. It is a coordination problem first, a time problem second.
