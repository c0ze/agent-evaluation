# Week Plan (Mon–Fri)

Working hours: 09:30–17:30 daily. **Wednesday 13:00–17:30 unavailable.**
Preferences respected: max 4h meetings/day, 45-min lunch, hard deadlines
prioritized over preferences.

## Legend

- 🔴 Hard deadline / commitment
- 🟡 Preferred / soft target
- 🔵 Scheduled commitment (recurring meeting, rehearsal)
- ⬜ Contingency / buffer

## Key dependencies

1. **Board numbers**: 2h uninterrupted block must start *after* Lina's
   corrections (due Tue 11:00, at risk if vendor export is late — Lina
   confirms Mon 15:00). Final numbers due **Thu 12:00**.
2. **Security patch**: my review (60–90 min) → QA (half day, QA **unavailable
   Thursday**) → 30-min change window. Deploy by **Fri 16:00**. So review
   Tuesday morning at the latest; I schedule it Tue 09:30 to keep Friday as a
   full buffer day.
3. **Customer demo**: needs 90-min rehearsal with Sam (only overlap: Wed
   10:00–12:00, since Sam is out Tuesday). Preferred slot Wed 15:00 is
   **impossible for me** (unavailable Wed 13:00–17:30) → plan for the
   customer's alternative, **Thu 16:00**, pending Product's confirmation.
4. **Strategy outline**: 3 focused hours of drafting; send by Tue 14:00 to get
   review at the Tue 16:00 leadership meeting. Drafting Monday satisfies the
   CEO's "early this week" ask.

## Monday

| Time | Activity | Type |
|---|---|---|
| 09:30–10:00 | Triage; send confirmations (demo slot → Product, rehearsal → Sam, QA slot → Engineering/QA, corrections → Lina) | 🔵 |
| 10:00–10:30 | Recurring meeting | 🔵 |
| 10:30–11:15 | **Renewals escalation — respond today** | 🔴 |
| 11:15–12:00 | Strategy outline, part 1 | 🟡 |
| 12:00–12:45 | Lunch | |
| 12:45–15:00 | Strategy outline, parts 2–3 (2h15) — draft complete | 🟡 |
| 15:00–15:15 | **Checkpoint: Lina confirms whether vendor export is late** → adjust Tuesday | 🔴 |
| 15:15–15:45 | Send strategy draft to CEO ("early this week" ✓, ahead of Tue 14:00 cutoff) | 🟡 |
| 15:45–17:30 | Contingency / overflow (patch review prep, pull a Wed-SLA escalation forward if Tuesday looks tight) | ⬜ |

Meetings: 0.5h ✓

## Tuesday

| Time | Activity | Type |
|---|---|---|
| 09:30–11:00 | **Security patch review** (90 min) — hand to QA immediately | 🔴 |
| 11:00–13:00 | **Finance board numbers: 2h uninterrupted block** (gated on Lina's corrections by 11:00) | 🔴 |
| 13:00–13:45 | Lunch | |
| 13:45–14:30 | Escalation #2 (Wed SLA, done early) | 🔴 |
| 14:30–15:15 | Escalation #3 (Wed SLA, done early) | 🔴 |
| 15:15–16:00 | Buffer; confirm strategy outline sent (14:00 cutoff) | ⬜ |
| 16:00–17:00 | Recurring leadership meeting (strategy outline reviewed here) | 🔵 |
| 17:00–17:30 | Wrap-up; confirm QA has the patch for Wednesday | ⬜ |

Meetings: 1h ✓

*If corrections arrive late:* shift the 2h finance block into the afternoon
(14:00–16:00) and move escalations #2/#3 to the freed morning slot; if
corrections slip past Tuesday, the Thu 12:00 deadline is at risk — escalate to
Finance the same day (see DECISIONS.md).

## Wednesday (available only 09:30–13:00)

| Time | Activity | Type |
|---|---|---|
| 09:30–10:00 | Demo prep; QA check-in (QA runs today, half day) | ⬜ |
| 10:00–11:30 | **Demo rehearsal with Sam** (90 min — his only window is 10:00–12:00) | 🔵 |
| 11:30–12:00 | Rehearsal feedback fixes | ⬜ |
| 12:00–13:00 | Buffer; optional early change window (12:00–12:30) if QA finishes ahead of schedule | ⬜ |
| 13:00 onward | Unavailable | |

Meetings: 1.5h ✓

## Thursday

| Time | Activity | Type |
|---|---|---|
| 09:30–10:00 | Recurring meeting | 🔵 |
| 10:00–10:30 | **Board numbers final check & sign-off (deadline 12:00)** | 🔴 |
| 10:30–11:00 | **Security patch change window** (30 min; fallback Friday morning) | 🔴 |
| 11:00–12:00 | Buffer | ⬜ |
| 12:00–12:45 | Lunch | |
| 12:45–15:45 | Contingency; leadership-meeting follow-ups; demo prep | ⬜ |
| 15:45–16:00 | Demo setup | ⬜ |
| 16:00–17:00 | **Customer demo** (assumed ~60 min — duration TBC with Product) | 🔴* |
| 17:00–17:30 | Wrap-up | ⬜ |

Meetings: 1.5h ✓  *Demo slot pending Product's confirmation with the customer —
see DECISIONS.md.*

## Friday

| Time | Activity | Type |
|---|---|---|
| 09:30–10:30 | Verify security patch post-deploy; check escalation threads | ⬜ |
| 10:30–12:00 | Week wrap-up, loose ends, demo follow-ups | ⬜ |
| 12:00–12:45 | Lunch | |
| 12:45–17:30 | Contingency + next-week prep. **Emergency lane:** if the patch slipped, re-QA this morning and run the change window by 15:30 (deadline 16:00) | ⬜ |

Meetings: 0h ✓

## Contingency space built in

- Mon 15:45–17:30 (~1.75h)
- Tue 15:15–16:00 (~45m)
- Wed 12:00–13:00 (~1h) — and Wed 13:00+ is a hard no, not buffer
- Thu 11:00–12:00 + 12:45–15:45 (~3.5h)
- Fri 12:45–17:30 (~4.75h, reserved as the patch's last-resort lane)

## Hard deadlines summary

| Deadline | Item | Covered by |
|---|---|---|
| Mon EOD | Renewals escalation response | Mon 10:30–11:15 |
| Tue 14:00 | Strategy outline to leadership (to be reviewed at 16:00) | Sent Mon, confirmed Tue |
| Wed EOD | Escalations #2, #3 SLAs | Done Tue PM (early) |
| Thu 12:00 | Board numbers final | Tue 2h block + Thu sign-off |
| Thu 16:00 | Customer demo (alternative slot) | Thu 16:00 |
| Fri 16:00 | Security patch deployed | Thu change window; Fri fallback |
