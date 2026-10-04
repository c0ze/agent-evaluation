# Decisions

## Part 1 — Confirmed decisions (made, no longer open)

### D1. Customer demo moves from Wednesday 15:00 to Thursday 16:00
**Decided by me. Needs external confirmation — see Q1.**
Wednesday 13:00–17:30 is unavailable, so the preferred 15:00 slot cannot happen under any arrangement. The customer's stated alternative, Thursday 16:00, is the only viable option. Wednesday 15:00 is not a preference I can trade against something else; it is not on the table.
**Consequence:** rehearsal and demo are now three days apart rather than same-day. The 90-minute rehearsal on Wednesday is therefore a proof-of-concept, not a dress rehearsal, and I have booked Thursday 14:00–15:00 as a re-run slot in case it surfaces gaps.
**Status change needed:** a message goes to Product and the customer Monday 09:30 — the sooner the better, since it moves *their* calendar.

### D2. Strategy outline moves to Monday afternoon, not Tuesday
**Decided by me.**
Tuesday's post-corrections window (11:00–14:00) is three hours, and both board numbers (2h) and the strategy outline (3h) claim it. They cannot coexist. Board numbers has a Thursday 12:00 external deadline; the strategy outline has a preference-based 14:00 gate. So the outline moves to Monday 14:30–17:30, where it lands 20.5 hours before the gate and before the leadership meeting can possibly slip.
**Consequence:** the CEO's "early this week" is satisfied — the draft exists Monday, not Tuesday evening.
**Note:** I did not treat the 14:00 Tuesday deadline as hard. It is derived from a meeting time, not stated as a requirement. If the CEO genuinely needs it Tuesday 11:00, this decision reverses — but something must give, and it will not be the board numbers.

### D3. Patch review starts Monday, 60 minutes
**Decided by me.**
The review must precede QA, which must precede the change window, which must clear Friday 16:00. QA is unavailable Thursday. Starting Monday gives the chain maximum room and puts the review in the same day as the renewal escalation, so any finding can be discussed before Tuesday.
**On the 60–90 minute range:** I planned 60 minutes, the low end. The extra 30 minutes of stated capacity is deliberately left unspent as Monday's only true buffer. If the review genuinely needs 90, Monday 14:15–14:30 absorbs it and nothing else moves.

### D4. Patch deploys Wednesday 09:30, two days early
**Decided by me.**
The chain is serial and QA is unavailable Thursday, so Tuesday QA → Wednesday deploy is the last clean path. Deploying Wednesday 09:30 puts the Friday 16:00 deadline two days out with the patch already live. Friday 15:00–15:30 is held in reserve as the only retry window, and stays empty in the happy path.
**Consequence:** if the change window fails Wednesday morning, we do not lose the week — we lose a slot that is already protected.

### D5. All three support escalations finish by Tuesday
**Decided by me.**
Only escalation #1 is Monday-hard. #2 and #3 have Wednesday SLAs. Moving them to Tuesday costs nothing against the SLA and buys Wednesday's short 3.5-hour morning for the rehearsal, the change window, and the 45-minute lunch. Wednesday has no room for a 45-minute escalation without breaking lunch or the rehearsal.
**Consequence:** all escalation risk closes Monday–Tuesday, leaving Wednesday and Thursday free of support load.

### D6. Thursday 10:00–12:00 is reserved and not scheduled with other work
**Decided by me.**
It is the only remaining time that still clears the Thursday 12:00 board-numbers deadline. It is held as insurance even though the expected path closes board numbers Tuesday afternoon. An unbooked block that might be needed is worth more than a booked block that might be needed.

### D7. Lunch is protected on all five days
**Decided by me.**
This is a stated preference and I have treated it as real, not aspirational. Wednesday is the tight case: 09:30–13:00 is 210 minutes, the rehearsal takes 90, the change window 30, leaving 45 for lunch and 40 for buffer. It fits — but only because escalation #3 was pulled to Tuesday. If Wednesday ever gains a fourth commitment, lunch is what gives, and that is a signal to re-plan rather than compress.

---

## Part 2 — Unresolved contradictions (I am not resolving these unilaterally)

### C1. Product's preferred demo slot is impossible
**Product wants Wednesday 15:00. Wednesday 13:00–17:30 is unavailable.** These cannot both be true. I have defaulted to Thursday 16:00 because it is the only slot the customer has already said they can do, but I have not told Product their stated preference is impossible — that conversation belongs to Product, and it needs to happen Monday morning.
**Risk if left unresolved:** Product may spend Monday building a Wednesday rehearsal plan that cannot happen.

### C2. "Board numbers final by Thursday 12:00" versus corrections arriving Tuesday 11:00
**This is the real risk in the week, and it is a gap in the instructions, not a scheduling choice.**
The deadline is hard. The corrections are the input. The dependency is: corrections → 2 uninterrupted hours → final numbers. If corrections arrive Tuesday 11:00 as expected, there is roughly 25 hours of slack. If they arrive Wednesday 12:30 or later, **the Thursday 12:00 deadline cannot be met by anyone** — there is simply no working time left before the deadline after the 2-hour block.
Nobody has said what happens in that case. I will not invent a fallback date. Finance owns this.
**What I need:** a stated latest-arrival time that still protects Thursday 12:00, and a decision on what to do if it is missed. My read is that the answer is roughly **Wednesday 12:30** — after that, Finance has to decide between a partial submission and a delay. That is their call, not mine.

### C3. Chain risk on the patch has no stated owner for rework
**The chain is serial and I am a single point of failure in it.** I do the review; QA cannot start until I finish; the change window cannot open until QA finishes. QA is unavailable Thursday, so the entire chain fits in Monday → Wednesday with no room for a second pass.
If Monday's review finds a blocker requiring rework, the chain does not slip one day — it collapses onto Wednesday 09:30 or Friday 15:00, and the Friday 16:00 deadline is at risk. Engineering has not named a backup reviewer or accepted this risk. I have planned around it; I have not eliminated it.

### C4. The CEO wants an outline "early this week" but Tuesday is fully committed
Even with the outline moved to Monday, the CEO should know the draft is a **first pass**, not a finished product. "Three focused hours" is what the ask requires, and a strategy outline produced in exactly three hours is a framing document, not a considered plan. I am not going to let the Tuesday 16:00 meeting imply more confidence than three hours of work can support.
**This is a framing gap, not a scheduling conflict** — and it is better raised by me on Monday than discovered by the CEO on Tuesday.

---

## Part 3 — Assumptions I made (flagging, not hiding)

| # | Assumption | Why | If wrong |
|---|------------|-----|----------|
| A1 | Escalation #1's 45 minutes is deliverable Monday | Support's own estimate | The only Monday-hard item slips; escalate Monday, do not absorb silently |
| A2 | Support's "response Monday" means a drafted reply, not a sent one | Ambiguous | If it means sent, approval rights are needed and I don't have them stated |
| A3 | The customer demo fits in 60 minutes | No length given | Extends to 17:30; debrief moves to Friday |
| A4 | Patch review needs prep time (45 min Monday morning) | Judgment | Cut it and the 60-minute review becomes unrealistic |
| A5 | The renewal escalation has context I can obtain Monday morning | Not in inbox | If I need more prep than 09:30 allows, it competes with the patch review |
| A6 | Strategy "3 focused hours" means 3 contiguous hours | Reasonable reading | If it can be split, Monday gets easier; the 14:00 Tuesday gate is already comfortably met |

**A5 is the one I am least comfortable with.** The renewal escalation is Monday-hard and I am opening the week without knowing the account history. If Monday 09:30 turns out to be insufficient prep time, the collision is with the patch review — and the patch review is harder to move than the escalation is to start slightly late.

---

## Part 4 — Questions, by owner

### → Product *(ask Monday morning)*
- **Q1 (blocking):** Wednesday 15:00 is impossible — Wednesday 13:00–17:30 is unavailable. Confirm the customer accepts **Thursday 16:00** so I can tell them today.
- **Q2:** Is the demo 60 minutes or 90? Thursday 16:00–17:30 is all I have.
- **Q3:** What does Sam need *before* Wednesday 10:00? He is unavailable Tuesday, so anything not ready by Tuesday 11:00 will not reach him in time to prepare.

### → Finance
- **Q4 (most important open question this week):** What is the **latest corrections arrival time that still protects Thursday 12:00**? My estimate is Wednesday 12:30, but Finance owns the answer.
- **Q5:** Is Thursday 12:00 a genuine board-materials hard stop, or a target with tolerance? The whole contingency structure depends on which.
- **Q6:** If the cutoff is missed, is a partial submission acceptable, or does the date move? This has no current answer and needs one *before* it is needed.

### → Lina *(confirm at Monday 15:00)*
- **Q7:** Is the vendor export on track for Tuesday 11:00?
- **Q8:** If it slips, what is the realistic arrival time? I need this *before* Monday ends, not Tuesday morning.

### → Engineering
- **Q9:** Confirm QA can start Tuesday 09:30 and finish within the half-day.
- **Q10:** Is there a **backup reviewer** if Monday's patch review finds a blocker? The chain has no slack for rework and QA is unavailable Thursday.
- **Q11:** Confirm the Wednesday 09:30–10:00 change window is booked on their side, and that Friday 15:00–15:30 is held as a retry slot.

### → Sam
- **Q12:** Confirm Wednesday 10:00–11:30. It is the only slot that works all week — he is unavailable Tuesday, and Wednesday afternoon is blocked.

### → CEO
- **Q13:** Monday 14:30–17:30 for the outline still meets "early this week" — or does he need something by Tuesday 11:00? If the latter, something else has to move, and I would rather he chooses than discover it.
- **Q14:** Should the Tuesday 16:00 meeting expect a framing document or a finished plan? Three hours produces the former.

### → Support
- **Q15:** Which account is the renewal-affecting escalation, and what context do I need? I am starting Monday without it.
- **Q16:** Does "response Monday" mean drafted or sent?
