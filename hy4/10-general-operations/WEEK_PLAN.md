# WEEK_PLAN.md — Monday–Friday

**How to read.** All times are within working hours 09:30–17:30. `FIXED` = an
immovable recurring meeting. `HARD` = hard deadline/constraint. `SOFT` = a
preference. `FOCUS` = an uninterrupted work block. `CONTINGENCY` = time
deliberately left free. Every day keeps a ≥45 min lunch and stays under the
4 h/day meeting cap.

I have **not** invented any availability: nothing is scheduled Wednesday
13:00–17:30 (unavailable), QA is never placed on Thursday (QA unavailable),
Sam is never scheduled Tuesday (unavailable), and Lina's corrections are never
assumed to land before Tuesday 11:00. Assumptions I had to make are listed in
§8 and flagged as open questions in `DECISIONS.md`.

---

## 1. Constraints at a glance

| Constraint | Kind |
|---|---|
| Work 09:30–17:30, Mon–Fri | HARD |
| Wednesday 13:00–17:30 unavailable | HARD |
| Recurring meetings: Mon 10:00–10:30; Tue 16:00–17:00; Thu 09:30–10:00 | FIXED |
| Lunch ≥ 45 min/day | HARD (stated personal rule) |
| ≤ 4 h of meetings/day | HARD (stated personal rule) |
| Sam unavailable Tue; can rehearse only Wed 10:00–12:00 | HARD |
| QA unavailable Thursday | HARD |
| Lina's corrections arrive Tue by 11:00, *unless* vendor export is late | dependency with a known slip risk; status known Mon 15:00 |
| CEO strategy "early this week"; Tue 16:00 leadership review if sent by 14:00 | SOFT |
| Demo *preferred* Wed 15:00; customer can also do Thu 16:00 | SOFT; Wed 15:00 is infeasible |

## 2. Priority order (what actually shapes the week)

1. **Board numbers** — HARD Thursday 12:00, board-level, and dependent on
   external corrections that carry a known slip risk. Needs a protected 2 h
   block *plus* a Thursday fallback.
2. **Security patch** — HARD Friday 16:00, but the longest dependency chain
   (review → ½-day QA → 30-min change window → deploy) with a Thursday QA
   blackout. This forces the earliest possible start (review Monday).
3. **Customer demo** — customer-facing, carries a timing contradiction
   (Wed 15:00 impossible), and its rehearsal is locked to Sam's only free
   window (Wed 10:00–12:00), which anchors the only usable Wednesday morning.

Handled immediately but not week-shaping: the Monday renewal escalation (a
single 45-min, revenue-impacting task) and the two Wednesday-SLA escalations
(cleared Tuesday as contingency). Rationale for the top three is in
`RESPONSE.md`.

## 3. Dependency chains

- **Board numbers:** Lina corrections (Tue ≤ 11:00; on-time status known
  Mon 15:00) → 2 uninterrupted hours → final by Thu 12:00.
  Fallback: Thu 10:00–12:00 protected block.
- **Security patch:** my review (60–90 min, Mon) → QA ½-day (Tue 09:30–13:30,
  **not** Thu) → 30-min change window (Tue 15:00) → deploy Tue, well before the
  Fri 16:00 deadline. Fallback chain: review ≤ Thu, QA Fri 09:30–13:30, window
  Fri 14:00–14:30, deploy ≤ Fri 16:00.
- **Demo:** rehearsal with Sam (Wed 10:00–11:30) → demo (Thu 16:00, pending
  confirmation). Wed 15:00 demo is impossible and is dropped.

## 4. Hard deadlines vs. preferences

**HARD:** renewals response Monday; board numbers final Thursday 12:00;
security patch deploy by Friday 16:00; two support SLAs Wednesday; all
working-hours, recurring-meeting, unavailability, lunch and meeting-cap rules.

**SOFT / preference:** "early this week" strategy and the Tue 16:00 leadership
review (an opportunity, not a promise); demo Wed 15:00 (infeasible) / Thu 16:00
(to confirm); the exact 90-min start inside Sam's Wed 10:00–12:00 window.

Rule applied throughout: if a hard item slips, the soft items move first —
never the reverse.

## 5. Decision gates

- **Mon 15:00** (I action it ~16:30, after the focus block — the status is
  *available by* 15:00, not only at 15:00): get Lina's vendor-export status.
  If late, obtain a revised corrections ETA and move board numbers to the
  Thu 10:00–12:00 fallback.
- Before Wednesday's rehearsal is locked: Product/customer + Sam confirm the
  Thu 16:00 demo.
- CEO confirms the Tue 16:00 strategy review is optional, not mandatory.

---

## 6. Day-by-day plan

### Monday (09:30–17:30) — urgent response + start the long-lead chains
| Time | Block | Type |
|---|---|---|
| 09:30–10:00 | Inbox triage, lock the week | admin |
| 10:00–10:30 | Recurring meeting | FIXED |
| 10:30–11:15 | **Support escalation #1 (renewals) — respond Monday** | HARD, 45 min |
| 11:15–12:45 | **Security patch review** (90 min; 60–90 needed) — earliest start to unblock QA | HARD chain start |
| 12:45–13:30 | Lunch | 45 min |
| 13:30–16:30 | **CEO strategy outline — 3 FOCUS hours** (enables optional Tue 16:00 review) | SOFT |
| 16:30–16:45 | **Decision gate:** Lina's vendor-export status → confirm Tue board-numbers block or activate Thu fallback | gate |
| 16:45–17:30 | Buffer; send strategy draft to leadership (< Tue 14:00) | slack |

### Tuesday (09:30–17:30) — corrections land; finalize board numbers; deploy
*QA team runs 09:30–13:30 in parallel (after Mon review, never Thursday). I
stay reachable for QA questions; QA does not consume my focus block.*
| Time | Block | Type |
|---|---|---|
| 09:30–11:00 | Support escalations #2 & #3 (2 × 45 min) — cleared ahead of Wed SLA | HARD, early = contingency |
| 11:00–11:15 | Receive Lina's corrections (due by 11:00) | external |
| 11:15–12:00 | Send strategy draft (< 14:00); light admin | SOFT |
| 12:00–12:45 | Lunch | 45 min |
| 12:45–13:00 | Buffer; skim corrections | slack |
| 13:00–15:00 | **Board numbers — TWO uninterrupted hours** (after corrections; final ≪ Thu 12:00) | HARD, FOCUS |
| 15:00–15:30 | **Security change window (30 min) → deploy** (after QA sign-off) | HARD chain end |
| 15:30–16:00 | Deploy verification / buffer | slack |
| 16:00–17:00 | Leadership meeting (reviews strategy if sent by 14:00) | FIXED |
| 17:00–17:30 | Wrap | slack |

*Deploy lands Tuesday — three days of slack before the Friday 16:00 hard deadline.*

### Wednesday (available 09:30–13:00 ONLY) — rehearsal + protect the afternoon
| Time | Block | Type |
|---|---|---|
| 09:30–10:00 | Admin / backup slot for any support-SLA slip | slack |
| 10:00–11:30 | **Demo rehearsal with Sam** (90 min; Sam's only window Wed 10:00–12:00) | HARD constraint |
| 11:30–12:15 | Contingency / demo prep / support backup | slack |
| 12:15–13:00 | Lunch | 45 min |
| 13:00–17:30 | **UNAVAILABLE — deliberately left empty** | HARD |

*Note: the "preferred" Wed 15:00 demo is impossible here; it is moved to Thu 16:00.*

### Thursday (09:30–17:30) — hard noon cutoff + demo
| Time | Block | Type |
|---|---|---|
| 09:30–10:00 | Recurring meeting | FIXED |
| 10:00–12:00 | **PROTECTED CONTINGENCY** — primary fallback for board numbers if corrections slipped (still before Thu 12:00); else security-review fallback / strategy overflow. Do not book over. | CONTINGENCY |
| 12:00–12:45 | Lunch (*board numbers HARD final by 12:00 — no work past noon on them*) | 45 min |
| 12:45–15:30 | Flexible FOCUS + contingency (strategy overflow, support follow-ups, deploy verification, demo prep) | slack |
| 15:30–16:00 | Demo final prep / buffer | slack |
| 16:00–17:00 | **Customer demo** (moved from Wed 15:00; ~1 h assumed; pending confirmation) | SOFT / to confirm |
| 17:00–17:30 | Debrief / wrap | slack |

### Friday (09:30–17:30) — light by design; safety net for the hard deadline
| Time | Block | Type |
|---|---|---|
| 09:30–12:00 | Follow-ups, renewal follow-up, strategy polish — absorb any earlier slip | slack |
| 12:00–12:45 | Lunch | 45 min |
| 12:45–15:30 | **CONTINGENCY** — fallback deploy chain if the primary plan slipped (QA Fri 09:30–13:30 → window Fri 14:00–14:30); otherwise free | CONTINGENCY |
| 15:30–16:00 | Final verification that the patch is deployed **before Fri 16:00** | HARD buffer |
| 16:00–17:30 | Weekly wrap / buffer | slack |

## 7. Contingency space (where the slack lives)
- **Thursday 10:00–12:00** — protected for board numbers if corrections slip;
  this is the main insurance on the Thursday noon hard deadline.
- **Friday afternoon** — kept light as the safety net for the Friday 16:00 patch
  deadline and for anything that slipped earlier in the week.
- **Tuesday deploy (vs. Friday deadline)** — three days of buffer on the patch.
- **Support #2/#3 cleared Tuesday** — one day of buffer on the Wednesday SLAs.
- **Wed 11:30–12:15 / Thu 12:45–15:30 / Fri mornings** — general absorption.
- Soft items (strategy polish, exact rehearsal start) yield first if needed.

## 8. Assumptions (not stated in the inbox — flagged, not silently invented)
- Demo duration is unspecified → assumed ~60 min (Thu 16:00–17:00); to confirm.
- QA "half day" → assumed a contiguous 4 h block inside one working day; to
  confirm. Wednesday (only 3.5 h available) therefore cannot hold QA.
- Review length 60–90 min → scheduled 90 min to be safe.
- The change window may be Tuesday: "deploy by Friday 16:00" is a latest
  deadline, so deploying earlier is allowed.
- "Sent by 14:00" for the Tue 16:00 leadership review is treated as a soft
  cutoff for an optional review, not a hard deadline.
- Sam's 90-min rehearsal fits inside Wed 10:00–12:00 → chose 10:00–11:30.
