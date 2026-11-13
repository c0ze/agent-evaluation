# Operating Week Plan (Monday–Friday)

## 1. Constraints, Deadlines & Preferences

### Hard Working-Hours & Availability Constraints
- **Standard working hours:** `09:30–17:30`, Monday–Friday (8.0h/day gross).
- **Unavailable block:** **Wednesday `13:00–17:30`** (only `09:30–13:00` is available on Wednesday = 3.5h).
- **Fixed recurring meetings:** Monday `10:00–10:30`, Tuesday `16:00–17:00`, Thursday `09:30–10:00`.
- **Collaborator availability constraints stated:**
  - **Sam:** Unavailable Tuesday; stated rehearsal availability is **Wednesday `10:00–12:00`**.
  - **QA:** Unavailable **Thursday** (all day).
  - **Lina:** Corrections expected **Tuesday by `11:00`**, unless vendor export is late (status known **Monday `15:00`**).
  - **Customer:** Available Wednesday `15:00` (Product preference — **blocked by your unavailability**) or **Thursday `16:00`**.

### Hard Deadlines vs. Preferences / Opportunities
| Item | Classification | Target / Constraint | Effort & Dependencies |
|---|---|---|---|
| **Support #1 (Renewals)** | **Hard Deadline** | Response **Monday** | ~45 min; no upstream blocker |
| **Support #2 & #3** | **Hard Deadlines** | **Wednesday SLAs** (exact hour TBD) | 2 × ~45 min (90 min); no upstream blocker |
| **Board Numbers Final** | **Hard Deadline** | Final by **Thursday `12:00`** | 2 uninterrupted hours **after** Lina sends Tue morning corrections (export check Mon `15:00`) |
| **Security Patch Deploy** | **Hard Deadline** | Deploy by **Friday `16:00`** | Your review (60–90 min) → QA (half day; **out Thu**) → 30-min change window (patch readiness TBD) |
| **Customer Demo + Rehearsal** | **Commitment / Preference** | Demo **Thu `16:00`** (Wed `15:00` is a rejected preference); rehearsal **90 min** with Sam | Rehearsal in Sam's Wed `10:00–12:00` slot; demo env readiness TBD |
| **CEO Strategy Outline** | **Soft Target / Opportunity** | "Early this week"; **Tue `14:00`** cutoff *if* reviewed at Tue `16:00` leadership meeting | 3 focused hours; no upstream blocker |
| **Meeting Cap** | **Personal Preference** | `<= 4 hours` of meetings/day | Maintained every day (max 1.5–2.0h/day) |
| **Lunch** | **Personal Preference** | Reserve `>= 45 minutes`/day | Scheduled Mon–Fri (`12:00–13:45` window; Wed `12:15–13:00` or post-`13:00`) |

---

## 2. Priority Order & Critical Dependency Chains

1. **Priority 1 — Board Numbers (Hard deadline: Thu `12:00`):**
   - Dependency chain: `Lina export status (Mon 15:00)` → `Lina corrections (target Tue <=11:00)` → `2 uninterrupted hours (you)` → `Final by Thu 12:00`.
   - Critical geometry: Because Wednesday afternoon is unavailable and Sam's rehearsal inside `10:00–12:00` splits Wednesday morning, **zero 2-hour uninterrupted blocks exist on Wednesday**. Missing Tuesday leaves only `Thu 10:00–12:00` with zero slack.
2. **Priority 2 — Security Patch Release (Hard deadline: Fri `16:00`):**
   - Dependency chain: `Patch ready (Engineering, ETA TBD)` → `Your review (60–90m)` → `QA (half day; QA out Thu)` → `30-min change window`.
   - Critical geometry: Reviewing **Mon afternoon or Tue `09:30–11:00`** lets QA finish Tue afternoon or Wednesday (while QA is available), keeping Thursday/Friday morning as defect and rollback buffer.
3. **Priority 3 — Support Escalations (Hard deadlines: Mon renewal + Wed SLAs):**
   - Pulling the two Wednesday-SLA escalations into Monday/Tuesday prevents a Wednesday-morning squeeze before your `13:00` hard stop.
4. **Priority 4 — CEO Strategy Outline (Soft opportunity: Tue `14:00` for Tue `16:00` review):**
   - Scheduled **Monday (`12:45–15:45`)** so it captures the Tuesday leadership review without colliding with Tuesday's Finance and Engineering blocks. Yields first if a hard-deadline crisis emerges Monday.
5. **Priority 5 — Customer Demo & Rehearsal (Rehearsal Wed `10:00–11:30`; Demo Thu `16:00`):**
   - Declines Wed `15:00` (unavailable) and takes customer's confirmed **Thu `16:00`** option.

---

## 3. Day-by-Day Schedule

> **Capacity Summary:** Net available work time (excluding 45-min lunch) is ~7h15m on Mon/Tue/Thu/Fri and 2h45m–3h30m on Wed (~31.75–32.5h total) against ~14h of committed tasks—meaning this week is **window- and dependency-constrained**, not total-hour-constrained.

### Monday (`09:30–17:30` | Meetings: `0.5h` | Lunch: `45m`)
| Time | Block Type | Activity & Purpose | Dependencies / Notes |
|---|---|---|---|
| `09:30–10:00` | Coordination | Week triage; send alignment message (`DRAFT_REPLY.md`) | Confirm patch ETA, Thu `16:00` demo, Tue `16:00` meeting, Support SLA cutoffs |
| `10:00–10:30` | **Fixed Meeting** | Recurring team meeting | Scheduled commitment |
| `10:30–11:15` | **Deadline Work** | **Support Escalation #1 (Renewals)** | **HARD DEADLINE: Monday.** Completed early to allow same-day follow-ups |
| `11:15–12:00` | **Proactive SLA** | **Support Escalation #2 (Wednesday SLA)** | Pulled forward to protect tight Wednesday morning |
| `12:00–12:45` | Personal | **Lunch (45m)** | Personal preference |
| `12:45–15:45` | **Focus Block (3h)** | **CEO Strategy Outline — First Draft** | Uninterrupted 3h block; keeps Tuesday clear for Finance & Engineering |
| `15:45–16:00` | Gate Check | **Lina Vendor Export Check** (status due by `15:00`) | Trigger Finance/Board contingency immediately if export is delayed |
| `16:00–17:30` | **Contingency / Focus** | **Option A:** Early **Security Patch Review (60–90m)** if ready<br>**Option B:** **Support Escalation #3 (45m)** + CEO outline polish/send | Doing patch review Monday lets QA start Tuesday morning |

### Tuesday (`09:30–17:30` | Meetings: `1.0h` | Lunch: `45m`)
| Time | Block Type | Activity & Purpose | Dependencies / Notes |
|---|---|---|---|
| `09:30–11:00` | **Focus Block (90m)** | **Security Patch Review (60–90m)** *(if not done Mon)* | Target completion by `11:00` so QA can run Tue afternoon or Wednesday. *(Backup: Support #3 + CEO draft polish)* |
| `11:00–13:00` | **Focus Block (2h)** | **Board Numbers Finalization** *(uninterrupted)* | **Depends on Lina's `<=11:00` corrections.** Completes ~47h ahead of **Thu `12:00` hard deadline** |
| `13:00–13:45` | Personal | **Lunch (45m)** | Personal preference |
| `13:45–14:00` | Cutoff Check | **Final send of CEO Strategy Outline** | Must be sent by **`14:00`** for `16:00` leadership review |
| `14:00–16:00` | **Contingency / SLA** | **Support Escalation #3 (45m)** *(if not done Mon)* + **1h15m–2h Contingency Space** | Absorbs minor Lina delay (corrections arriving `11:00–14:00`) or overflow patch review |
| `16:00–17:00` | **Fixed Meeting** | Recurring meeting / **Leadership Strategy Review** | Confirm both refer to the same `16:00` slot |
| `17:00–17:30` | Wrap-up | Confirm demo environment readiness & QA status | Prepares clean handoff before short Wednesday |

### Wednesday (`09:30–13:00` ONLY | Meetings: `1.5h` | Lunch: `45m` before `13:00` or after)
| Time | Block Type | Activity & Purpose | Dependencies / Notes |
|---|---|---|---|
| `09:30–10:00` | Prep / Check | Demo environment smoke-check; check QA progress | Verify Wed SLAs are already closed |
| `10:00–11:30` | **Meeting (90m)** | **Customer Demo Rehearsal (with Product & Sam)** | Inside Sam's confirmed `10:00–12:00` window; leaves `11:30–13:00` contiguous |
| `11:30–12:15` | **Contingency (45m)** | Rehearsal follow-up / QA questions / SLA overflow | Hand off any demo fixes to Product/Sam before `13:00` sign-off |
| `12:15–13:00` | Personal | **Lunch (45m)** | Reserved inside work hours in case `13:00` commitments start immediately *(flexes to buffer if lunch occurs after `13:00`)* |
| `13:00–17:30` | **UNAVAILABLE** | **Blocked — No work or meetings** | **Wed `15:00` demo rejected.** *(Note: QA can run its half-day pass Wed afternoon independently if your review finished earlier)* |

### Thursday (`09:30–17:30` | Meetings: `~1.5h` | Lunch: `45m`)
| Time | Block Type | Activity & Purpose | Dependencies / Notes |
|---|---|---|---|
| `09:30–10:00` | **Fixed Meeting** | Recurring meeting | Request reschedule *only* if severe Lina delay forces Board numbers into Thu morning |
| `10:00–12:00` | **Contingency / Deadline** | Final Finance verification for Board numbers *(or emergency 2h Board-numbers block if Lina slipped past Tue `14:00`)* | **HARD DEADLINE `12:00`: Board numbers final.** Otherwise use for demo prep or deep work |
| `12:00–12:45` | Personal | **Lunch (45m)** | Personal preference |
| `12:45–16:00` | **Contingency / Focus** | Strategy outline follow-ups, demo final prep, or **late-fallback Security Patch Review (60–90m)** | **QA is unavailable all day Thursday.** Reviewing Thu afternoon forces QA onto Fri morning with minimal buffer |
| `16:00–17:00` | **Customer Meeting** | **Customer Demo** *(duration assumed <=60–90m; confirm with Product)* | Replaces Wed `15:00` preference; customer confirmed available `16:00` |
| `17:00–17:30` | Wrap-up | Post-demo notes & Friday deployment readiness check | Ends cleanly at `17:30` |

### Friday (`09:30–17:30` | Meetings: `0.5h` | Lunch: `45m`)
| Time | Block Type | Activity & Purpose | Dependencies / Notes |
|---|---|---|---|
| `09:30–10:00` | Gate Check | Verify Wednesday QA pass & go/no-go *(or start QA half-day pass `09:30–13:30` on fallback)* | Must preserve buffer before `16:00` |
| `10:00–10:30` | **Deployment (Primary)** | **Security Patch 30-Minute Change Window** | Leaves **5.5h buffer** before **Fri `16:00` hard deadline** |
| `10:30–12:30` | **Contingency (2h)** | Post-deploy monitoring / hotfix buffer *(on fallback: support QA during `09:30–13:30` pass)* | Protects `16:00` cutoff |
| `12:30–13:15` | Personal | **Lunch (45m)** | *(Shifts to `13:30–14:15` if supporting Friday-morning QA)* |
| `13:15–16:00` | **Contingency (2h45m)** | Weekly overflow *(on fallback: `14:15–14:45` 30-min change window + `14:45–16:00` verification)* | **HARD DEADLINE `16:00`: Security patch deployed** |
| `16:00–17:30` | Wrap-up | Weekly closeout & next-week planning | — |

---

## 4. Contingency Playbooks (If Upstream Dates Slip)

- **If Lina reports a late vendor export at Monday `15:00`:**
  - *Arrives Tue `11:00–14:00`:* Shift Board numbers into Tue `12:00–14:00` or `14:00–16:00`; move Support #3 to Tue `09:30–10:15` or Mon `16:00–16:45`.
  - *Arrives after Tue `14:00` (Tue late afternoon or Wed):* Wednesday morning cannot hold an uninterrupted 2h block while Sam rehearses `10:00–12:00`. Either (1) move Board numbers to **Thu `10:00–12:00`** (zero buffer—confirm Finance doesn't need post-review time and ask to shift Thu `09:30` recurring meeting if needed), OR (2) ask Sam if rehearsal can move to Monday/Thursday morning to unlock Wed `09:30–11:30`.
- **If Engineering's security patch isn't ready until Wednesday or Thursday:**
  - Review Thu afternoon (`13:00–14:30`) → QA runs **Fri `09:30–13:30`** → 30-min change window **Fri `14:15–14:45`**. Flag explicitly to Engineering that this leaves <90 minutes for defects before the `16:00` hard deadline.
- **If Product insists on Wednesday `15:00` for the Customer Demo:**
  - Confirm whether your live attendance is required. If yes, Wed `15:00` is impossible (`13:00–17:30` unavailable) and Product must book the customer's **Thu `16:00`** option. If Product and Sam can run Wed `15:00` without you, you still join the Wed `10:00–11:30` rehearsal.
