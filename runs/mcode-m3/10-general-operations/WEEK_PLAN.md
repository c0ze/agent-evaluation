# Week Plan — Monday → Friday

Working window: **09:30–17:30, Mon–Fri**. Wed **13:00–17:30 unavailable**.
Cap: ≤4h meetings/day, ≥45m lunch daily. Times below are local and concrete.

Legend: `[F]` focus block · `[M]` meeting · `[D]` hard deadline · `[SLA]` customer SLA · `[C]` contingency buffer.

---

## Monday — clear the renewal lane, start the strategy draft

| Time | Block | Notes |
|---|---|---|
| 09:30–10:00 | Triage & inbox sweep | Check Lina's vendor signal informally |
| 10:00–10:30 | `[M]` Recurring 1 | |
| 10:30–11:15 | Support escalation #1 — **renewal** `[SLA Mon]` | 45m |
| 11:15–12:00 | Email, vendor prep, brief Lina check-in | |
| 12:00–12:45 | Lunch | |
| 12:45–13:30 | Support escalation #2 `[SLA Wed]` — get ahead | 45m, frees Wed morning |
| 13:30–15:00 | `[F]` Strategy outline — block 1 (1.5h of 3h) | |
| 15:00 | Lina sync — vendor export timing confirmed? | Hard pivot point for Tue/Fri flow |
| 15:00–16:30 | `[F]` Strategy outline — block 2 (1.5h, **completes 3h**) | |
| 16:30–17:30 | Buffer / Friday deploy prep | Review security patch ticket |

Daily meeting load: **30m** (≤4h ✓). Lunch: **45m** (≥45m ✓).

---

## Tuesday — review, send strategy, lock board numbers v1

| Time | Block | Notes |
|---|---|---|
| 09:30–11:00 | Security patch review (90m) | Hands clean spec to QA for Wed |
| 11:00 | Lina's corrections arrive (if vendor on time) | If late → trigger `[C]` flow |
| 11:00–12:00 | Triage corrections, raise questions | |
| 12:00–12:45 | Lunch | |
| 12:45–13:45 | Strategy outline polish, light edits | Buffer before send |
| **14:00** | `[D]` Send strategy outline to leadership | Must be in by 14:00 for 16:00 review |
| 14:00–16:00 | `[F]` Board numbers — **2h uninterrupted** (after Lina) | Per Finance requirement |
| 16:00–17:00 | `[M]` Recurring 2 — leadership meeting | Strategy review happens here |
| 17:00–17:30 | Wrap, confirm Sam for Wed rehearsal | |

Daily meeting load: **60m** (≤4h ✓).

Contingency trigger if Lina late:
- 14:00–16:00 board block slips; push to **Thursday 10:00–12:00** as primary 2h block instead.
- Flag Finance at 11:30 Tuesday with revised ETA.

---

## Wednesday — rehearsal, last SLA, hand off QA *(half day available)*

| Time | Block | Notes |
|---|---|---|
| 09:30–10:00 | Inbox triage, quick pre-rehearsal prep | |
| 10:00–11:30 | `[M]` Demo rehearsal with Sam — **90m** | Only window; Sam otherwise unavailable Tue |
| 11:30–12:15 | Support escalation #3 `[SLA Wed]` | 45m |
| 12:15–13:00 | Lunch | |
| 13:00 | Hand QA the security patch + start signal | Brief async note to QA lead |
| **13:00–17:30** | **Unavailable — personal** | QA team runs their half-day in parallel |

Meeting load: **90m** (rehearsal counts; ≤4h ✓). Critical: this day is **3.5h of working time** plus a 90m rehearsal — anything not done by 13:00 shifts to Thu/Fri.

---

## Thursday — finalize board pack, ship the demo

| Time | Block | Notes |
|---|---|---|
| 09:30–10:00 | `[M]` Recurring 3 | |
| 10:00–12:00 | `[F]` Board numbers — finalize, sanity-check, submit | `[D]` Final by **Thursday 12:00** |
| **12:00** | `[D]` Board pack sent to Finance | |
| 12:00–12:45 | Lunch | |
| 12:45–13:45 | `[C]` Contingency / overflow | Catches anything pushed from earlier |
| 13:45–15:30 | Strategy revisions from Tue meeting feedback | Keeps CEO thread warm |
| 15:30–16:00 | Demo final prep | |
| **16:00–17:00** | `[M]` Customer demo (Thursday alt slot) | Moved from Wed — see DECISIONS.md |
| 17:00–17:30 | Notes, follow-ups, hand-offs | |

Meeting load: **30m + 60m = 90m** (≤4h ✓).

---

## Friday — deploy the patch

| Time | Block | Notes |
|---|---|---|
| 09:30–11:00 | Email, inboxes, week close-out, deploy runbook | |
| 11:00–12:00 | Final QA sign-off confirmation | |
| 12:00–12:45 | Lunch | |
| 12:45–14:00 | `[C]` Buffer for any QA rollbacks or last fixes | |
| **14:00–14:30** | `[M]` Deploy change window (30m) | Engineering on standby |
| 14:30–15:30 | Monitor, verify, comms | |
| **15:30** | Buffer inside the 16:00 deadline | |
| **16:00** | `[D]` Security patch deployed | |

Meeting load: **30m** (≤4h ✓).

---

## Dependencies at a glance

```
Lina vendor status (Mon 15:00)
        │
        ▼
Lina corrections (Tue 11:00) ──► Board numbers 2h block (Tue 14:00 or Thu 10:00)
                                       │
                                       ▼
                              Finance deadline Thu 12:00 [D]

Security patch review (Tue AM) ──► QA half-day (Wed 13:00–17:30)
                                       │
                                       ▼
                              Change window Fri 14:00
                                       │
                                       ▼
                              Deploy Fri 16:00 [D]

Strategy draft (Mon PM, 3h) ──► Send Tue 14:00 [D] ──► Leadership review Tue 16:00

Sam rehearsal (Wed 10:00–11:30) ──► Customer demo (Thu 16:00)
```

## Contingency space

- **Thu 12:45–13:45**: catch anything that drifted (e.g., board numbers spillover, late Lina corrections, demo prep gap).
- **Fri 12:45–14:00**: pre-deploy buffer for QA rework.
- If Lina's corrections are late and board pack slips past Thu 12:00: pre-warn Finance on Tue at 11:30 with a revised ETA so they can pre-brief the chair.
- If security QA finds a blocker Wed: Thursday is **not** an option (QA unavailable); Thursday morning becomes an emergency triage block, with Friday change window at risk.