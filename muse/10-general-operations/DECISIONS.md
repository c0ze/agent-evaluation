# Decisions

## Confirmed decisions (derived from stated constraints)

1. Customer demo moves to Thursday 16:00 (pending customer confirmation).
   Reason: the preferred Wednesday 15:00 falls inside your hard
   unavailability (Wednesday 13:00–17:30). No alternative interpretation
   makes Wednesday 15:00 work without inventing availability.
2. Demo rehearsal is Wednesday 10:00–11:30 with Sam. Reason: Sam is
   unavailable Tuesday and available Wednesday 10:00–12:00; your only
   Wednesday availability is 09:30–13:00. This is the sole overlap for a
   90-minute joint session.
3. Security review happens Monday (90-minute block). Reason: the
   review → QA half day → change window → Friday 16:00 chain cannot pass
   through Thursday (QA unavailable), so the review must start Monday to
   leave Tuesday/Wednesday for QA and preserve Friday morning as fallback.
4. Board-numbers work gets a protected 2-hour block Tuesday 11:00–13:00,
   contingent on Lina delivering by 11:00. Reason: Finance requires two
   uninterrupted hours after corrections; Thursday 12:00 is hard.
5. Renewal-affecting escalation is answered Monday. Reason: explicitly
   required Monday; all other support items have Wednesday SLAs.
6. Strategy draft gets 3 focused hours Monday to allow a Tuesday 14:00 send.
   Reason: this is the only way to make the Tuesday 16:00 leadership review
   without colliding with Tuesday's board-numbers block.

## Unresolved contradictions

1. Finance expects Tuesday-morning corrections → 2-hour block, but Lina
   conditions Tuesday 11:00 delivery on the vendor export (known Monday
   15:00). If the export is late, the Tuesday block and possibly the
   Thursday 12:00 deadline are at risk. No late-delivery ETA exists yet.
2. "Board numbers must be final by Thursday 12:00" leaves unclear what
   "final" includes (your 2 hours only, or also Finance-side processing?).
   If Finance needs time after your block, the real internal deadline is
   earlier than Thursday 12:00.
3. Demo preference (Wednesday 15:00) contradicts your unavailability and
   leaves only one stated fallback (Thursday 16:00). If the customer cannot
   do Thursday, there is no third option in the notes.
4. Security chain vs Thursday blackout: "QA half day after review" is
   underspecified (which half day, how many hours, does it need you
   present?). Thursday's unavailability for QA plus the Friday 16:00 deploy
   leaves no slack if review or QA slips past Wednesday.
5. "Strategy outline early this week" vs the Tuesday 14:00 review gate: it is
   unclear whether Tuesday 14:00 is a hard expectation from the CEO or just
   an opportunity to use the leadership meeting.
6. Wednesday SLAs vs Wednesday PM unavailability: the two non-renewal
   escalations are effectively due by Wednesday 13:00 for you, not end of
   Wednesday. The notes do not give exact SLA times.
7. Wednesday morning overload: rehearsal (90 min) + lunch (45 min) inside a
   3.5-hour availability window leaves about 75 minutes for everything else,
   including any SLA verification.

## Questions, assigned

- To Lina: by Monday 15:00, is the vendor export on track for Tuesday 11:00
  corrections? If late, what is the new ETA and how will corrections arrive?
- To Finance: what does "final by Thursday 12:00" require from you vs from
  Finance — is there Finance processing time after your 2 hours? Can the
  2-hour block be split if corrections arrive late, or must it be
  uninterrupted? Who is the fallback if corrections slip to Wednesday?
- To Product / customer: can you confirm Thursday 16:00 for the demo, and
  the expected duration and attendees? (Wednesday 15:00 is not possible —
  unavailable Wednesday afternoon.)
- To Sam: please confirm rehearsal Wednesday 10:00–11:30 and what you need
  from the demo environment beforehand.
- To Engineering / QA: please confirm the QA half-day slot (proposing
  Tuesday after Monday review, fallback Wednesday AM or Friday AM — Thursday
  excluded), how many hours "half day" means, whether you need to be present,
  and the booked 30-minute change-window time before Friday 16:00.
- To CEO: is Tuesday 14:00 a required send time for the strategy outline, or
  is "early this week" flexible if Tuesday's board-numbers block takes
  priority? What decision do you need from the Tuesday 16:00 review?
- To Support: which escalation affects renewals, and what are the exact
  Wednesday SLA times (cutoff hour)? Are 45-minute estimates per escalation
  inclusive of follow-up and documentation?
