# Week Plan — Monday to Friday

Hours: 09:30–17:30. Wednesday 13:00–17:30 unavailable — nothing is
scheduled then. Lunch (45 min) and ≤4 hours of meetings/day are respected
every day. All times below are within those hours.

## Hard deadlines vs preferences

| Item | Type | Deadline |
|---|---|---|
| Board numbers final (Finance) | **Hard** | Thu 12:00; needs 2h uninterrupted *after* Lina's corrections (due Tue 11:00) |
| Security patch deployed (Engineering) | **Hard** | Fri 16:00; sequence: my review 60–90m → QA half day → 30m change window. QA unavailable Thu |
| Support escalation A (renewals) | **Hard** | Response Mon |
| Support escalations B & C | **Hard (SLA)** | Wed — effectively Wed 13:00 for me (unavailable Wed PM), so pulled forward to Mon/Tue |
| Customer demo Thu 16:00 | **Fallback — needs booking** | Wed 15:00 *preferred* but impossible (see below); Thu 16:00 is the customer's stated alternative |
| Strategy outline (CEO) | **Soft / opportunity** | "Early this week"; Tue 14:00 send-by *only* to make the Tue 16:00 leadership review. No hard deadline stated |

Dependencies that drive the whole week:
`Lina Tue 11:00 → 2h board block → Thu 12:00` ·
`My patch review → QA half day (not Thu) → deploy Fri ≤16:00` ·
`90m rehearsal with Sam (only Wed 10:00–12:00) → demo`.

## Monday — clear the Monday-hard item, start the two long chains

- 09:30–10:00 — Triage. Send team message ([DRAFT_REPLY.md](DRAFT_REPLY.md)): propose demo Thu 16:00, ask for confirmations below.
- 10:00–10:30 — Recurring meeting (fixed).
- **10:30–12:30 — FOCUS: Strategy outline, hours 1–2 of 3.** Front-loaded because Tue late morning belongs to the board numbers.
- 12:30–13:15 — Lunch.
- **13:15–14:00 — Support A: renewals escalation (hard Mon).**
- 14:00–14:45 — Support B (Wed SLA, pulled forward — Wed morning has no slack).
- 15:00–15:15 — **Decision point: Lina confirms whether vendor export is on time** for Tue 11:00 corrections.
- **15:15–16:45 — FOCUS: Security patch review (90m).** Done Mon so QA can run Tue, well clear of the Thu QA blackout.
- 16:45–17:30 — Contingency: hand patch to QA, chase demo/Thu confirmation.

Meetings: ~0.75h. If Lina signals a late export at 15:00, escalate to Finance *today* (see Contingency) — do not wait until Tue.

## Tuesday — board-numbers day; strategy sent before the 2h block

- **09:30–10:30 — Strategy outline, hour 3 of 3.**
- 10:30–11:00 — Polish and **send strategy outline** (ahead of the 14:00 cutoff). Receive Lina's corrections (due 11:00).
- **11:00–13:00 — FOCUS: Board numbers, 2h uninterrupted.** No meetings, no interruptions. This is the only clean slot: Wed AM is the rehearsal, Thu AM has the 09:30 meeting and the 12:00 deadline.
- 13:00–13:45 — Lunch (late, because the 2h block cannot be split).
- 13:45–14:30 — Finance handoff / queries on corrections. Target: numbers substantively final today, ~2 days before the hard deadline.
- 14:30–15:15 — Support C (Wed SLA — last one, cleared before Wed).
- 15:15–16:00 — QA check-in on patch; demo prep checklist for Wed rehearsal.
- 16:00–17:00 — Leadership / recurring meeting — strategy review. *Assumed to be the same meeting; to confirm (see DECISIONS.md).*
- 17:00–17:30 — Contingency / notes.

Meetings: ~1–1.5h. Note the squeeze this resolves: strategy (send by 14:00)
and the board block (2h after 11:00) cannot both sit in Tue 11:00–14:00 —
hence strategy is finished Mon/Tue-early and sent *before* the board block.

QA runs the patch half-day today (QA's time, following Mon review).

## Wednesday — morning only; unavailable 13:00–17:30

- 09:30–10:00 — Demo environment smoke check; join Sam.
- **10:00–11:30 — Demo rehearsal with Sam (90m)** — inside Sam's only window (10:00–12:00; Sam is unavailable Tue).
- 11:30–12:15 — Rehearsal fixes; write Thu demo run-sheet.
- 12:15–13:00 — Lunch + handover note, then off.
- **13:00–17:30 — UNAVAILABLE. Nothing scheduled. In particular, no Wed 15:00 demo.**

By design, no deadline depends on Wed PM: Wed SLAs were cleared Mon/Tue,
board numbers were done Tue. QA may continue patch QA Wed PM without me if
Tue QA needs follow-up.

## Thursday — board deadline AM, demo PM; no QA today

- 09:30–10:00 — Recurring meeting (fixed).
- 10:00–11:30 — **Held as contingency** (see below). In the base plan: final board proof only.
- **By 11:30 — Board numbers submitted (hard deadline 12:00).** 30m margin, not zero.
- 12:30–13:15 — Lunch (12:00–12:30 buffer if submission needs it).
- 13:15–14:30 — Demo final prep (apply Wed rehearsal fixes).
- 14:30–15:30 — Patch deploy readiness: review QA results (QA itself is done — QA is unavailable Thu and nothing QA-shaped is scheduled today).
- 15:30–16:00 — Demo setup.
- **16:00 — Customer demo (Thursday option).** Duration and Sam's attendance at the demo itself are *not stated in the inbox — to confirm with Product/Sam.* Plan holds 16:00–17:00; do not assume longer without confirmation.
- 17:00–17:30 — Demo follow-ups / contingency.

Meetings: ~1.5h.

## Friday — deploy early, keep the afternoon as buffer

- 09:30–10:30 — Patch pre-deploy checks.
- **10:30–11:00 — Change window: deploy security patch (30m).** Target is deliberately ~5h before the hard 16:00 deadline (latest safe start 15:30) to leave rollback/fix room.
- 11:00–12:30 — Post-deploy monitoring / verification.
- 12:30–13:15 — Lunch.
- 13:15–15:00 — **Contingency block (held empty):** patch issues, demo follow-ups, board queries, anything that slipped.
- 15:00–16:00 — Confirm patch live ahead of 16:00 hard deadline; week wrap / handoffs.
- 16:00–17:30 — Admin / next-week prep. No hard deliverable is stacked at the deadline itself.

## Contingency space — explicitly held, not assumed

- **If Lina's corrections are late** (known Mon 15:00): Tue 11:00–13:00 is released to QA/demo prep, and the 2h board block falls back to **Thu 10:00–12:00 uninterrupted — which ends exactly at the 12:00 deadline with zero margin**, and cannot start earlier (09:30 recurring meeting). Wed cannot host it (rehearsal + PM unavailable). This fallback is fragile: escalate to Finance on Mon at 15:00 and ask whether partial corrections Tue or any flex on Thu 12:00 exists, rather than silently relying on Thu.
- **If QA finds a patch issue:** Tue QA + Wed follow-up buffer, Fri 10:30 deploy target (5.5h slack). Thu cannot be used for QA — a review slipping to Thu would force QA + deploy into Fri with no slack, which is why the review is Mon.
- **If the customer will not do Thu 16:00:** Wed 15:00 remains impossible for me. Product must find a new time or cover — no Friday customer availability is stated, so none is assumed here.
- **Daily slack:** Mon 16:45–17:30, Tue 17:00–17:30, Thu 10:00–11:30 (base plan), Fri 13:15–15:00 are held empty on purpose.
