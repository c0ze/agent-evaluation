# Decisions — confirmed, unconfirmed, and who owns what

Status labels: **CONFIRMED** = follows from the inbox and I will act on it ·
**NEEDS OWNER** = a real contradiction or missing input; someone must answer.

## A. Confirmed (I am proceeding on these)

| # | Decision | Basis | Risk if basis is wrong |
|---|----------|-------|------------------------|
| A1 | Wednesday 13:00–17:30 stays blocked. No meetings, no demo, no catch-up. | Stated as unavailable | — |
| A2 | My patch review happens **Monday 15:15–16:45**. | Only free 90-minute slot before QA's Wednesday lane; Tuesday cannot hold it | QA must start Friday morning (no slip room) |
| A3 | QA gets the patch for a **Wednesday** half day; Thursday is written off for QA. | QA unavailable Thursday; Friday morning is the fallback | Patch change window has to survive on Friday afternoon only |
| A4 | Change window is **Friday 14:30–15:00**, verification 15:00–16:00. | Deploy hard deadline Fri 16:00; leaves 1h verification + Friday morning as slip lane | None — this is the back-solved safe position |
| A5 | CEO draft is written **Monday** (3h) and circulated **Tuesday by 11:00**, ahead of the 14:00 cut-off for the 16:00 leadership review. | Monday has the only 3h run | If Tuesday's board numbers overrun, the 14:00 send is the first casualty — acceptable, the outline can go to the following leadership meeting |
| A6 | Both Wednesday-SLA escalations are done **Tuesday**, not Wednesday. | Wednesday has 1h30 usable outside the rehearsal; that is the contingency, not the plan | None — beating an SLA is safe |
| A7 | Renewals escalation is handled **Monday 10:30**, response same day. | "needs a response Monday" | — |
| A8 | Thursday 10:00–12:00 is held empty as the board-numbers contingency and is only released after Tuesday sign-off. | The 2h block must land after corrections; no other 2h uninterrupted window exists before Thu 12:00 | — |

## B. Unresolved contradictions — **these need a human answer**

### B1 — The demo slot is impossible as requested *(owner: Product)*
Product prefers **Wednesday 15:00**, but that is inside the Wednesday 13:00–17:30
unavailable block. This is not a scheduling inconvenience I can absorb; it is a direct
conflict.
- **Proposal:** take the customer's **Thursday 16:00** alternative.
- **Needs:** Product to re-confirm Thursday 16:00 with the customer **Monday**.
- **Only alternative:** someone with authority approves using Wednesday afternoon. I
  am not assuming that.

### B2 — Thursday 12:00 has no slack *(owner: Finance)*
The only 2h uninterrupted window before the deadline is Thu 10:00–12:00, which ends
*at* the deadline.
- **Needs (Finance):** is 12:00 the moment the pack circulates, or an internal
  working target? Do the two hours have to be mine, or can part be delegated?
  Can the two hours be split if needed?

### B3 — "Early this week" is not a date *(owner: CEO)*
- **Needs:** confirm that a first draft circulated Tuesday morning and reviewed at
  Tuesday 16:00 counts as "early this week", or state a real date.
- **Note:** a useful first draft is three focused hours. I have scheduled that
  Monday. I am not promising a polished strategy document this week.

### B4 — QA "half day" is unquantified, and QA has one usable day *(owner: Eng/QA lead)*
- **Needs (Wed):** confirm QA can take the patch for Wednesday and what "half day"
  means in hours, and whether Wednesday morning is genuinely free on their side, or
  whether they intend Friday morning.
- If QA cannot commit to Wednesday, **Chain B has no Thursday fallback** and the
  Friday 16:00 deadline rests on a single Friday-morning QA lane.

### B5 — Sam's rehearsal window is 2h for a 90m need, but it is the only window *(owner: Product/Sam)*
- **Plan:** rehearsal **Wednesday 10:00–11:30**.
- **Needs:** confirmation Sam can make 10:00–11:30 (or 10:30–12:00). Tuesday is out
  per the inbox.

### B6 — Renewals escalation is underspecified *(owner: Support)*
- **Needs:** which account, what the renewal value/timing is, and whether "response
  Monday" means a holding reply or a full answer. 45 minutes buys one substantive
  reply, not an investigation.

## C. What I am explicitly *not* deciding alone
- Moving the demo into Wednesday afternoon (needs approval, see B1).
- Softening the Friday 16:00 deploy date (external/hard).
- Treating the CEO request as a hard deadline (it is not one).
- Assuming anything about *why* Wednesday afternoon is blocked.

## D. Escalation rule
If by **Wednesday 12:15** QA has not confirmed the patch is on track, the patch goes
to Engineering leadership the same day with the options: (a) accept Friday morning QA
with zero slip room, (b) move the deploy date — only Engineering/CEO can authorise,
(c) reduce review scope with a named risk owner.
