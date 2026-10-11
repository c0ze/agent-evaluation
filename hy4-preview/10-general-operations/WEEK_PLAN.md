# Week Plan — Monday to Friday

**Scope note / sources:** everything below is derived only from `INBOX.md`. Where the
inbox is silent, I have flagged an assumption rather than invented an input. In
particular I have **not** treated Wednesday 13:00–17:30 as available (no reason was
given and none is assumed), I have not scheduled outside 09:30–17:30, and I have not
assumed availability for Sam, Lina, QA or the customer beyond what they stated.

## 0. Hard deadlines vs. preferences

| # | Item | Type | Timing | Consequence if missed |
|---|------|------|--------|-----------------------|
| H1 | Board numbers final | **Hard** | Thu 12:00 | Board pack circulated with wrong numbers; not recoverable quietly |
| H2 | Security patch deployed | **Hard** | Fri 16:00 | Change window missed; security exposure carries into the weekend |
| S1 | Renewals escalation response | Soft-ish, stated as "needs a response Monday" | Mon EOD | Revenue at risk; trust cost with that account |
| S2 | Two other escalations | **Hard-ish (SLA)** | Wed | SLA breach |
| P1 | Customer demo | Preference | preferred Wed 15:00, alt Thu 16:00 | Rescheduling cost with the customer only |
| P2 | CEO strategy outline "early this week" | **Preference, vague** | no date given | Disappointed CEO; no external consequence |
| P3 | Strategy outline into Tue 16:00 leadership if sent by 14:00 | Preference (a pull-forward opportunity) | Tue 14:00 | Draft waits another week for review |

Only H1 and H2 have external, non-negotiable dates. Everything else is a
preference that I protect *with* slack, not *instead of* slack.

## 1. Dependency chains

**Chain A — Board numbers (deadline Thu 12:00)**
```
Lina corrections due Tue 11:00  ──▶  2h uninterrupted work  ──▶  Thu 12:00
        ▲
   vendor export risk;
   Lina confirms Mon 15:00  ──▶  DECISION POINT: on-time? late?
```
- Primary window: **Tue 11:00–13:00** (exactly 2h, uninterrupted).
- Contingency window: **Thu 10:00–12:00** — legal, but it lands *on* the 12:00
  deadline with zero slack. Two hours, not negotiable in length.

**Chain B — Security patch (deadline Fri 16:00)**
```
my review (60–90m)  ──▶  QA half day  ──▶  30m change window  ──▶  verify  ──▶  Fri 16:00
        Mon 15:15            Wed (QA unavail Thu)     Fri 14:30        15:00–16:00
```
- QA is unavailable Thursday, so QA can only run **Wednesday** or **Friday morning**.
  Wednesday is the safe leg; Friday morning is the slip lane and leaves no room for a
  second slip.
- My review must therefore land **Monday**, not Tuesday — Tuesday has no spare 90
  minutes once the board numbers and the CEO draft are in.
- Go/no-go gate: **Thu 16:30** (I am the one who decides; QA cannot be consulted
  Thursday, so their lead confirms capacity Wednesday).

**Chain C — Customer demo**
```
90m rehearsal w/ Sam (only slot: Wed 10:00–12:00) ──▶ demo
                                          Wed 15:00 ✗ CONFLICT | Thu 16:00 ✓ (to confirm)
```

## 2. Capacity check

- Gross: 5 × 8h = 40h
- Less lunch 5 × 45m = −3h45
- Less Wednesday 13:00–17:30 = −4h30
- Less recurring meetings (Mon 30m, Tue 60m, Thu 30m) = −2h00
- **Net available ≈ 29h45**
- Committed work ≈ 18–19h (patch review 1.5, change window 0.5, verification 1,
  board numbers 2, CEO draft 3 + revisions 1, three escalations 2.25, rehearsal 1.5,
  demo 1, triage/handoffs ≈ 2, admin/wrap ≈ 2)
- **Unassigned ≈ 9–10h**, of which **2h is a named contingency block** (Thu
  10:00–12:00) and the rest sits in Friday plus end-of-day buffers.

Daily meeting load stays at 0.5–1.5h, well under the 4h personal ceiling. Lunch is
45 minutes every day, including Wednesday, where it must finish by 13:00.

## 3. Daily plan

### Monday — clear the blocking work
| Time | Item | Type |
|------|------|------|
| 09:30–10:00 | Triage, confirm the Monday-dependent unknowns | Admin |
| 10:00–10:30 | Recurring meeting | Fixed |
| 10:30–11:15 | **Escalation A — renewals** (respond today) | S1 |
| 11:15–12:45 | CEO strategy outline — focused block 1 | P2 |
| 12:45–13:30 | Lunch | Break |
| 13:30–15:00 | CEO strategy outline — focused block 2 (3h complete) | P2 |
| 15:00–15:15 | **Lina check-in: is the vendor export on time?** | Gate |
| 15:15–16:45 | **Security patch review (90m) → hand to QA** | H2 |
| 16:45–17:30 | Send team alignment note, republish plan | Admin |

Rationale: Monday is the only day with three consecutive free hours, so the CEO draft
lives here; the patch review is pulled to Monday so QA can own Wednesday.

### Tuesday — board numbers + leadership
| Time | Item | Type |
|------|------|------|
| 09:30–11:00 | Polish CEO outline, circulate by 11:00 (due 14:00) | P2 |
| 11:00–13:00 | **Board numbers — 2h uninterrupted** (on Lina's corrections) | H1 |
| 13:00–13:45 | Lunch | Break |
| 13:45–14:30 | Escalation B (Wed SLA, done early) | S2 |
| 14:30–15:15 | Escalation C (Wed SLA, done early) — *fallback: Wed 11:30* | S2 |
| 15:15–16:00 | Buffer: board-numbers overrun, QA questions | Slack |
| 16:00–17:00 | Leadership meeting (reviews strategy outline) | Fixed |
| 17:00–17:30 | Wrap-up, Wednesday prep | Admin |

### Wednesday — short day (13:00–17:30 unavailable)
| Time | Item | Type |
|------|------|------|
| 09:30–10:00 | Triage, confirm QA has started the patch | Admin |
| 10:00–11:30 | **Demo rehearsal with Sam** (only slot Sam can do) | P1 |
| 11:30–12:15 | Flexible: QA support / rehearsal overflow / Escalation C | Slack |
| 12:15–13:00 | Lunch | Break |
| 13:00–17:30 | **Unavailable — nothing scheduled, no exceptions** | — |

Wednesday is the most fragile day: 3h30 total, of which 1h30 is a fixed external
commitment. That is why both Wednesday-SLA escalations sit on Tuesday.

### Thursday — deadline day
| Time | Item | Type |
|------|------|------|
| 09:30–10:00 | Recurring meeting | Fixed |
| 10:00–12:00 | **CONTINGENCY HOLD — board numbers** (release if signed off Tue) | H1 |
| 12:00 | **Board numbers hard deadline** | H1 |
| 12:00–12:45 | Lunch | Break |
| 12:45–14:30 | Demo prep, rehearsal follow-ups | P1 |
| 14:30–16:00 | Strategy outline revisions from leadership feedback | P2 |
| 16:00–17:00 | **Customer demo (Thu 16:00 slot — pending confirmation)** | P1 |
| 17:00–17:30 | Demo notes, follow-ups | Admin |

### Friday — deploy day
| Time | Item | Type |
|------|------|------|
| 09:30–11:00 | **QA slip lane** / strategy outline revisions | H2 / P2 |
| 11:00–12:00 | Open focus, backlog | Slack |
| 12:00–12:45 | Lunch | Break |
| 12:45–13:30 | Change-window prep: approvals, rollback plan, comms | H2 |
| 13:30–14:30 | Go/no-go with QA + Eng; absorb slips | H2 |
| 14:30–15:00 | **Change window (30m)** | H2 |
| 15:00–16:00 | Verification, smoke test, comms — **done by Fri 16:00** | H2 |
| 16:00–17:00 | Weekly review, handoffs | Admin |
| 17:00–17:30 | Unused buffer | Slack |

## 4. Contingency space (in the order I would spend it)

1. **Friday 09:30–11:00** — absorbs a QA slip. Costs nothing; there is no other
   Friday-morning commitment.
2. **Thursday 10:00–12:00 hold** — absorbs late corrections from Lina. Legal but
   hits the 12:00 deadline exactly, so only usable if Tuesday's two hours were
   genuinely blocked.
3. **Friday 17:00–17:30 + end-of-day wraps** — absorbs small overflows.
4. **CEO outline revision time (Friday)** — the designated *absorber*. If the patch
   needs more of me, the outline revision drops first. It is the only top-level item
   with no external date.

**I will not spend:** lunch (45m), the Wednesday 13:00–17:30 block, or the Friday
16:00 deploy deadline. If both H1 and H2 are at risk simultaneously, patch
deployment wins and Finance gets a Wednesday heads-up that the board pack may carry
preliminary numbers.

## 5. Monitoring points

- **Mon 15:00** — Lina's vendor-export verdict. Late → activate the Thursday hold and
  tell Finance the same day.
- **Wed 12:15** — confirm QA is genuinely half-way/half-day complete. If not, the
  patch moves to the Friday-morning lane.
- **Thu 16:30** — patch go/no-go; if no, escalate to Engineering before end of day.
