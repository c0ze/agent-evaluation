# Reasoning: Top Three Priorities

---

## 1. Board Numbers Final by Thursday 12:00 (Finance)

**Why this is #1:**
- **Hard external deadline:** Board meeting is immovable; numbers feed directly into materials leadership presents.
- **Longest dependency chain:** Lina (Tue 11:00) → Me (Tue 11–13) → Finance polish (Thu AM) → Board (Thu 12:00). Any slip cascades.
- **Zero slack on Wednesday:** I'm unavailable 13:00+, so Tuesday is the *only* day for my 2-hour uninterrupted block. If Lina is late, the entire chain breaks before Wednesday even starts.
- **Business impact:** Wrong or late numbers = credibility hit with Board, potential funding/decision delays.

**What makes it fragile:** Single dependency on Lina's vendor export (confirmed Mon 15:00). No parallel path.

---

## 2. Security Patch Deployed by Friday 16:00 (Engineering)

**Why this is #2:**
- **Hard compliance/ops deadline:** "Must deploy by Friday 16:00" — likely regulatory or customer-facing SLA.
- **Sequential technical dependency:** Review (90 min) → QA (4h) → Change window (30 min). QA *unavailable Thursday* forces Friday QA, compressing the chain into one day.
- **No recovery if Friday breaks:** If QA finds issues, no time for fix + re-QA + re-deploy before 16:00. Rollback plan is the only safety net.
- **My review unblocks everyone:** Engineering cannot start QA until I sign off. My Thu 10:00 review is the gate.

**What makes it fragile:** QA unavailability Thursday is a fixed constraint; any review delay pushes QA past 13:30, leaving <90 min for deploy + verify.

---

## 3. Customer Demo Thursday 16:00 (Product)

**Why this is #3:**
- **Customer commitment:** External party scheduled; rescheduling damages trust and sales cycle.
- **Wednesday 15:00 was a preference, not a hard deadline** — but it's *impossible* given my 13:00 unavailability. Thursday 16:00 is the only viable slot.
- **Sam dependency:** Rehearsal *requires* Sam (Wed 10–12 only). If Sam cancels, no rehearsal → demo quality risk. No backup window exists.
- **Reputational impact:** A poorly rehearsed demo with a prospect is worse than a rescheduled one, but rescheduling signals disorganization.

**What makes it fragile:** Sam is a single point of failure for rehearsal. Customer confirmed for Thu 16:00? (Need Product confirmation Monday).

---

## Why These Three (and Not Others)

| Item | Deadline | Dependency Depth | Slack | My Unique Role | Rank |
|------|----------|------------------|-------|----------------|------|
| Board numbers | Thu 12:00 | 3-step chain | 0 days | Only one who can do the 2h Finance block | 1 |
| Security patch | Fri 16:00 | 3-step technical | 0.5 days | Review gatekeeper | 2 |
| Customer demo | Thu 16:00 | 2-step (Sam → me) | 0 days | Rehearsal lead + presenter | 3 |
| CEO strategy | Tue 14:00 send | 1-step (me only) | 1 day | Sole author | 4 |
| Support escalations | Mon/Wed SLA | None | 1 day | Responder | 5 |

**CEO strategy** is important but has 1 full day of slack (Mon–Tue) and no external dependencies. **Support** is reactive but bounded (45 min each) and front-loaded to clear Wednesday. Both fit *around* the top three.

---

## The Common Thread

All three top priorities share: **external immovable deadline + multi-step dependency chain + zero or negative slack on Wednesday**. They cannot be compressed, delegated, or moved without consequence. Everything else in the week is scheduled to protect the critical path for these three.