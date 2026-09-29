# Decisions and open questions

Source: `INBOX.md`. “Confirmed” below means stated in the inbox, not newly approved by anyone. Proposed bookings and internal targets are listed separately.

## Confirmed constraints and commitments

- Working hours: Monday–Friday 09:30–17:30. Wednesday 13:00–17:30 is unavailable.
- Recurring meetings: Monday 10:00–10:30, Tuesday 16:00–17:00, Thursday 09:30–10:00.
- Board numbers must be final Thursday 12:00. Processing requires two uninterrupted hours after Lina supplies corrections. Tuesday by 11:00 is conditional on the vendor export; Lina will know the export risk Monday by 15:00.
- Patch must deploy by Friday 16:00. Sequence: 60–90-minute review, then half-day QA, then 30-minute change window. QA cannot work Thursday.
- Renewal-affecting escalation needs a Monday response; the other two have Wednesday SLAs. Each is estimated at 45 minutes. Exact cutoff times and resolution requirements are absent.
- Strategy first draft needs three focused hours. “Early this week” is a preference. Sending by Tuesday 14:00 enables review at the Tuesday 16:00 leadership meeting; it is not a stated universal strategy deadline.
- Customer prefers Wednesday 15:00 and can also do Thursday 16:00. Rehearsal requires 90 minutes and Sam. Sam is unavailable Tuesday and can rehearse Wednesday 10:00–12:00.
- Personal preferences: at most four meeting hours daily and at least 45 minutes for lunch. The proposed plan honors both.

## Planning choices, pending any external confirmation

- Respond to the renewal escalation Monday and the two Wednesday-SLA tickets Tuesday. Confirm exact cutoffs before relying on these slots.
- Draft strategy Monday 10:30–13:30 and send during 15:00–15:15, ahead of Tuesday's review cutoff.
- Reserve Tuesday 11:00–13:00 for Finance, with Tuesday 14:00–16:00 as the first fallback. Aim to complete the work Tuesday and confirm final board delivery no later than Thursday 11:00; noon remains the hard deadline.
- Reserve Monday 15:15–16:45 for patch review; request Tuesday QA, Wednesday 11:30–12:00 deployment, and Friday 14:30–15:00 as fallback. These downstream slots are requests, not confirmed availability.
- Propose rehearsal Wednesday 10:00–11:30 and demo Thursday 16:00. The customer has offered that start time; a booking and its duration still need confirmation.

## Conflicts, uncertainty and assigned questions

Response targets below are proposed coordination checkpoints, not deadlines stated in the inbox.

| Issue | Question / decision needed | Right person | Proposed checkpoint / consequence |
| --- | --- | --- | --- |
| Wednesday demo conflicts with unavailability | Confirm Thursday 16:00 with customer; what duration and which attendees are required? Does Sam also need to attend the demo? | Product, coordinating with customer and Sam if required | Ask Monday morning; confirm before Wednesday rehearsal. Wednesday 15:00 cannot be accepted under current constraints. |
| Rehearsal capacity is narrow | Confirm Wednesday 10:00–11:30 and that the environment will be ready. | Product and Sam; Product identifies environment owner | Monday request; before Wednesday 10:00. Sam's offered window is availability, not a completed booking. |
| Vendor could invalidate Tuesday Finance block | Is the export on time? If late, what is the revised corrections ETA and can a usable subset be delivered earlier? | Lina, coordinating with vendor | Monday 15:00 status, then update immediately if Tuesday 11:00 slips. |
| “Final” board numbers and late-input recovery | Who confirms final numbers, where must they be delivered, and is any approval time required beyond the two hours? If input is late, what alternate data or reduced scope is acceptable? | Finance, with Lina for source-data feasibility | Ask Monday; resolve delivery/approval needs before Tuesday handoff. Thursday 10:00–12:00 alone cannot guarantee time for extra approval. |
| QA availability outside Thursday is unknown | Can QA reserve a Tuesday half-day after review? How many hours does “half day” require, and what are its actual hours? If Tuesday fails, can Wednesday or Friday morning work? | QA scheduling owner, coordinated by Engineering | Request Monday; confirm before review handoff. “Unavailable Thursday” does not establish availability elsewhere. |
| Review/deploy readiness is unknown | Can Engineering supply a review-ready patch Monday 15:15, resolve review findings, confirm release ownership and book Wednesday's window? Who monitors after the user's Wednesday noon handoff? Can Friday fallback be held? | Engineering release owner, with QA for test results | Monday request; Wednesday 09:30 go/no-go. If coverage or prerequisites are missing, use an agreed fallback. |
| Support deadline details missing | Which escalation affects renewals; what are the exact Monday and Wednesday cutoffs; do the Wednesday SLAs require response or resolution? Who owns follow-up? | Support | Monday 09:30 triage. Earlier cutoffs or resolution work can require reprioritization. |
| “Early this week” lacks acceptance criteria | Does a first outline sent Monday for Tuesday discussion meet the need, and what decision should it support? | CEO; leadership meeting organizer for agenda | Ask Monday; draft proceeds without waiting unless direction changes. |

## Decisions needed if contingencies trigger

- Finance and Lina must agree a recovery path if Tuesday's two-hour blocks are lost. The plan does not move fixed meetings, assume Wednesday afternoon availability or silently extend hours.
- Engineering and QA must confirm another feasible sequence if review or testing slips. Friday morning QA is a request and carries failure/rework risk; the Friday 16:00 requirement remains unchanged until the responsible owner explicitly changes it.
- Product must agree new scope or timing if rehearsal fails. Thursday 16:00 is a customer-offered alternative, not permission to book any other time.
- No messages have been sent and no calendar bookings made as part of this task. `DRAFT_REPLY.md` is a draft for review/use.
