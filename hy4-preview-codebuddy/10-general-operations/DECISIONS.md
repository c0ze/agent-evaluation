# Decisions — confirmed, unresolved, and who owns each question

## A. Confirmed (I decided these from what was stated)

1. **Wednesday 13:00–17:30 stays empty.** It is stated unavailability, not a
   preference, so the Wednesday 15:00 demo slot is off the table for me.
2. **Demo moves to Thursday 16:00** — the customer's stated alternative, and the
   only slot in the week that works. Still needs sign-off (see B1).
3. **Rehearsal is Wednesday 10:00–11:30.** Sam is unavailable Tuesday and can
   only rehearse Wednesday 10:00–12:00; that is the only 90-minute window inside
   my available time.
4. **Security review is Monday 11:15–12:45.** It gates a chain with two other
   teams and one of them (QA) has a broken calendar. Doing it Monday is the only
   way the chain survives a surprise.
5. **QA runs Wednesday afternoon** (while I am unavailable), change window is
   Friday 14:00–14:30, deploy complete ~14:30 against a 16:00 deadline.
6. **Board numbers get Tuesday 11:00–13:00**, immediately after Lina's
   corrections, with Thursday 10:00–12:00 held as the fallback.
7. **Strategy outline is drafted Monday 13:30–16:30** (three focused hours) and
   sent Tuesday 10:00, ahead of the 14:00 cutoff for the 16:00 leadership
   meeting.
8. **Both Wednesday-SLA escalations are handled Wednesday morning**,
   11:30–13:00. The renewals escalation is handled Monday 10:30–11:15.
9. **Lunch is 45 minutes every day and the 4-hour meeting cap holds.** Worst day
   is Wednesday at 3h00.
10. **"Early this week" for the CEO draft is interpreted as Tuesday morning**,
    because that is the earliest interpretation that also makes the Tuesday 16:00
    leadership review possible. Confirming this either way (B4).

## B. Unresolved contradictions

**B1. The demo slot is internally contradictory.** Product prefers Wednesday
15:00; I am unavailable 13:00–17:30. The customer's alternative (Thursday 16:00)
resolves it, but Sam's Thursday availability was never stated — Sam was only
described as unavailable Tuesday and free Wednesday 10:00–12:00.
→ *Owner: Product* to confirm Thursday 16:00 with the customer.
→ *Owner: Sam* to confirm Thursday 16:00.
Fallback: no slot remains this week; the demo moves to next week, or someone
else runs it.

**B2. Board numbers depend on an input that may not arrive.** Lina's corrections
are due Tuesday 11:00 "unless the vendor export is late" — she will know Monday
15:00. If it is late, my two uninterrupted hours fall on Thursday 10:00–12:00,
which ends exactly at the 12:00 deadline with zero slack.
→ *Owner: Lina* — Monday 15:00 status, and an earliest-realistic-time estimate
if the export slips.
→ *Owner: Finance* — if corrections slip past Tuesday 12:00, is a preliminary
set at Thursday 12:00 acceptable, or does the deadline move, or does the scope
of "final" narrow? I cannot answer this myself.

**B3. QA's half day sits inside my unavailable block.** The patch chain assumes
QA can work Wednesday afternoon without me. If QA needs me in the loop, the
chain breaks, because QA is unavailable Thursday and Friday morning is the last
slot before a 16:00 Friday deploy.
→ *Owner: Engineering / QA lead* — confirm QA can take Wednesday afternoon
unattended, and confirm "half day" means roughly four hours.

**B4. "Early this week" is undefined, and the 14:00 cutoff is an opportunity,
not a requirement.** I am treating Tuesday 10:00 as the target. The open
question is whether the CEO wants a rough first draft for Tuesday's leadership
meeting, or a more finished document later in the week in exchange for missing
that review.
→ *Owner: CEO.*

**B5. Support priority order is only partly specified.** One escalation is
identified as affecting renewals and due Monday, but the relative severity of
the other two — and whether the Monday item needs a full resolution or an
acknowledgement-plus-plan — is not stated.
→ *Owner: Support lead* — confirm the ranking and whether a same-day holding
response satisfies the renewals commitment.

**B6. Change-window attendance is unstated.** The 30-minute window needs someone
from Engineering; I have assumed they will be there but have not been told.
→ *Owner: Engineering* — confirm who joins Friday 14:00–14:30.

## C. What I deliberately did not decide

- I did not invent availability for Sam (Thursday), QA (Wednesday afternoon), or
  myself (Wednesday afternoon).
- I did not treat "preferred Wednesday 15:00" as movable-with-permission; I
  moved it only because the customer's own alternative covers it.
- I did not compress lunch or the meeting cap to fit more in. If something new
  arrives, it goes into the listed contingency or next week — it does not go
  into lunch.
