# Week Plan — Mon–Fri

**Working hours:** 09:30–17:30, Monday–Friday. **Wednesday unavailable from 13:00.**
**Rules respected:** ≤4h meetings/day (worst day is 1.5h); ≥45m lunch reserved every day; no availability invented.

---

## The one finding that reshapes the week

**The preferred Wednesday 15:00 demo cannot happen.** Wednesday 13:00–17:30 is unavailable, so 15:00 is physically impossible. The customer's stated alternative — **Thursday 16:00** — is therefore the only viable slot, and it is adopted here.

This also forces the rehearsal onto **Wednesday 10:00–11:30** (Sam's only stated availability, and 90 minutes matches the 90-minute rehearsal requirement exactly). Rehearsal and demo are now three days apart, not one. See `DECISIONS.md` → Q1.

---

## Deadline classification

| # | Item | Type | Deadline | Slack |
|---|------|------|----------|-------|
| 1 | Renewal-affecting support escalation | **HARD** | Monday EOD | None — must be Monday |
| 2 | Security patch deployed | **HARD** (external, board-visible) | Friday 16:00 | ~2 days at planned deploy (Wed 09:30) |
| 3 | Board numbers final | **HARD** (external, board-visible) | Thursday 12:00 | ~1 working day (Thu 10:00–12:00) |
| 4 | Board numbers 2h uninterrupted block | **HARD** on the timebox | Tue 11:15–13:15 | Thu contingency if corrections slip |
| 5 | Strategy outline to leadership pre-read | **SOFT** (14:00 Tue gate) | Tue 14:00, then 16:00 mtg | Delivered Mon 17:30 → 20.5h early |
| 6 | Customer demo | **HARD** slot (external) | Thu 16:00 | Thu 14:00–15:00 re-run slot |
| 7 | Other two escalations | **SOFT** | Wednesday SLAs | Pulled to Tuesday → 1 day early |

The 14:00 Tuesday gate is a *preference* derived from a meeting, not a stated deadline. The CEO's actual ask is "early this week." It is met either way.

---

## Monday — kick off the serial chains, protect the one Monday-hard item

| Time | Block | Type |
|------|-------|------|
| 09:30–09:55 | **Send demo date change** Wed 15:00 → Thu 16:00 to Product + customer | Hard-ish (external courtesy) |
| 09:55–10:00 | Buffer | — |
| 10:00–10:30 | Recurring meeting | Meeting |
| 10:30–11:15 | **Support escalation #1** — renewal-affecting | **HARD: Monday** |
| 11:15–12:00 | Patch review prep — read diff, changelog, CVEs | Deep work |
| 12:00–12:45 | **Lunch** | — |
| 12:45–13:45 | **Security patch review** (60 min, low end of 60–90 range) | **HARD: chain start** |
| 13:45–14:15 | Hand patch to QA; book Wed 09:30 change window; notify Engineering | Dependency handoff |
| 14:15–14:30 | Buffer | — |
| 14:30–17:30 | **Strategy outline — 3 focused hours, contiguous** | Soft deadline, done early |
| ~15:00 | 5-min async check of Lina's vendor-export status | Decision gate |

**Load:** 385 min work / 405 min capacity → **20 min slack**.
**Note:** Monday is the only day where the strategy block can be genuinely protected. Tuesday's post-corrections window is already spoken for by board numbers.

**Decision gate at 15:00** — Lina will know by Monday 15:00 whether the vendor export is late. This determines whether Tuesday runs as planned or the board-numbers block moves to the Thursday contingency window. The rest of the week is already planned for the on-time case, so this is a checkpoint, not a scramble.

---

## Tuesday — corrections land, board numbers get their protected block

| Time | Block | Type |
|------|-------|------|
| 09:30–10:15 | **Support escalation #2** (Wed SLA → 1 day early) | Soft, pulled forward |
| 10:15–11:00 | Demo run-of-show draft for Wednesday rehearsal (Sam unavailable Tue) | Prep |
| 11:00–11:15 | Receive Lina's corrections; scope the delta | Dependency |
| 11:15–13:15 | **BOARD NUMBERS — 2 uninterrupted hours** | **HARD: protects Thu 12:00** |
| 13:15–14:00 | **Lunch** | — |
| 14:00–14:10 | Send strategy outline as leadership pre-read | Soft gate |
| 14:10–14:55 | **Support escalation #3** (Wed SLA → 1 day early) | Soft, pulled forward |
| 14:55–15:40 | Patch QA status check; confirm Wed change window + rehearsal with Sam | Dependency mgmt |
| 15:40–16:00 | Prep / buffer | — |
| 16:00–17:00 | Leadership meeting (recurring) — strategy reviewed | Meeting |
| 17:00–17:30 | Notes; final confirmations for Wednesday | — |

**Load:** 355 min work / 375 min capacity → **20 min slack**.

**Why corrections are protected over the strategy outline:** board numbers carries a Thursday 12:00 external deadline; the strategy outline is a preference with a movable gate. Both cannot fit in 11:00–14:00 (5 hours of work in a 3-hour window), so the hard deadline wins. Moving the outline to Monday removes the conflict entirely rather than trading one against the other.

**All three escalations now sit before Wednesday**, which protects Wednesday's short 3.5-hour window for the rehearsal and keeps the 45-minute lunch intact.

---

## Wednesday — morning only (unavailable from 13:00)

| Time | Block | Type |
|------|-------|------|
| 09:30–10:00 | **Security patch change window** (30 min) | **HARD: chain step 3** |
| 10:00–11:30 | **Demo rehearsal with Sam** (90 min) | Hard — Sam's only availability |
| 11:30–12:15 | **Lunch** | — |
| 12:15–12:55 | Rehearsal re-run buffer / demo polish | Contingency |
| 12:55–13:00 | Close; confirm Thursday 16:00 demo | — |

**Load:** 180 min work + 45 min lunch, in a 210-minute window → **40 min genuine buffer**.

**Why deploy Wednesday morning:** it completes the whole review → QA → change-window chain two full days before the Friday 16:00 deadline, and it is the only morning slot that both follows Tuesday's QA and leaves room before Sam arrives at 10:00.

**Contingency:** if the rehearsal overruns, the 12:15–12:55 buffer absorbs it. If the change window fails and rolls past 10:00, it moves to **Friday 15:00–15:30** — the last window that still clears 16:00.

---

## Thursday — contingency in the morning, demo in the afternoon

| Time | Block | Type |
|------|-------|------|
| 09:30–10:00 | Recurring meeting | Meeting |
| 10:00–12:00 | **RESERVED: board-numbers contingency** (must close by 12:00) | Hard-deadline insurance |
| 12:00–12:45 | **Lunch** | — |
| 12:45–14:00 | Carry-over; renewal escalation follow-up; strategy second draft | Flex |
| 14:00–15:00 | **Demo re-run slot** + demo environment check | Contingency |
| 15:00–15:45 | Float / contingency | — |
| 15:45–16:00 | Demo setup | — |
| 16:00–17:00 | **Customer demo** (60 min reserved — length unconfirmed) | **HARD: external slot** |
| 17:00–17:30 | Debrief, follow-ups, patch confirmation | — |

**Load:** meetings 1.5h. QA unavailability Thursday is moot — QA completed Tuesday.

**The 10:00–12:00 block is insurance, not plan.** If corrections arrived on time, board numbers closed Tuesday afternoon and this block is released for carry-over work. Hold it anyway: it is the *only* remaining time that still clears the Thursday 12:00 deadline, and it costs nothing to protect.

**If corrections arrive after Wednesday 12:30, the Thursday 12:00 deadline cannot be met.** This is a genuine gap, not a scheduling choice — see `DECISIONS.md` → Q2, which is why Finance is being asked for a stated cutoff.

---

## Friday — confirmation and clean carry-over

| Time | Block | Type |
|------|-------|------|
| 09:30–11:00 | Thursday spillover; renewal escalation follow-up | Flex |
| 11:00–12:00 | Board numbers sign-off package (if not already closed) | Flex |
| 12:00–12:45 | **Lunch** | — |
| 12:45–14:00 | Week review, next-week prep | Flex |
| 14:00–15:00 | Float | — |
| 15:00–15:30 | **RESERVED: emergency change window — only if Wed deploy failed** | Contingency |
| 15:30–16:00 | Deploy confirmation buffer | — |
| 16:00–16:30 | **Confirm patch deployed**; close item | **HARD: 16:00** |
| 16:30–17:30 | Carry-over / next week | — |

**The 15:00–15:30 block stays empty in the happy path.** It is the last legal slot to deploy and still meet 16:00. Leaving it unbooked is what makes the Friday deadline survivable if anything upstream slips. Do not fill it with other work.

---

## Dependencies

```
Lina's corrections (Tue 11:00, confirmed Mon 15:00)
        │
        ▼
Board numbers 2h block (Tue 11:15–13:15)
        │
        ▼
Board numbers FINAL ──────────────► Thu 12:00 (hard)

Patch review (Mon 12:45) ──► QA (Tue, half day) ──► Change window (Wed 09:30)
                                                            │
                                                            ▼
                                              Fallback: Fri 15:00–15:30
                                              Hard stop: Fri 16:00

Strategy outline (Mon 14:30–17:30) ──► Pre-read (Tue 14:00) ──► Leadership mtg (Tue 16:00)

Rehearsal w/ Sam (Wed 10:00–11:30, only slot) ──► Demo (Thu 16:00)
                                                     Re-run slot: Thu 14:00–15:00
```

**Single points of failure:**
- **Lina** — one person gates board numbers. No stated backup.
- **Me** — the patch review requires me specifically. I am also the only person holding the strategy block and the renewal escalation. If Monday's patch review finds a blocker, it compresses the review buffer first, then the handoff.
- **Sam** — the rehearsal has exactly one viable window in the entire week.

---

## Contingency space at a glance

| Risk | Trigger | Response | Capacity lost |
|------|---------|----------|---------------|
| Vendor export late | Lina signals Mon 15:00 | Board numbers → Thu 10:00–12:00 | Thursday flex block |
| Corrections late on Tuesday | After 11:15 | Board numbers → Tue 15:00–17:00; Thu 10:00–12:00 stays armed | Strategy pre-read slips (already sent Mon) |
| Corrections after Wed 12:30 | — | **Thursday 12:00 deadline is unreachable** — escalate to Finance same day | Deadline, not time |
| Patch review overruns to 90 min | Monday | Absorbed by Mon 14:15–14:30 buffer | 15 min |
| Review finds a blocker | Monday | Chain → Wed 12:55 / Fri 15:00; escalate to Engineering | Demo re-run slot |
| Change window fails Wed | Wed 10:00 | Friday 15:00–15:30 retry | Float block |
| Rehearsal overruns | Wed 12:00 | 12:15–12:55 buffer; then Thu 14:00–15:00 re-run | Buffer |
| Demo runs over 60 min | Thu 17:00 | Extends to 17:30; debrief moves to Friday | Debrief |
| Escalations #2/#3 slip | Tuesday | Wed 12:15–12:55, then Thursday flex | Buffer |

**Total unplanned capacity this week: roughly 20 min Monday, 20 min Tuesday, 40 min Wednesday, 75 min Thursday + flex, 3h Friday.** The week is front-loaded and back-loaded with slack, which is deliberate: Monday and Tuesday carry the serial chains, Friday absorbs everything that moves.
