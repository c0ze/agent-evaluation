# Week plan

This is a proposed schedule based on `INBOX.md`, not a set of confirmed bookings. All times use the inbox's time basis; no calendar dates or timezone conversions are assumed. Work stays within 09:30–17:30 Monday–Friday, with no work Wednesday 13:00–17:30. Each day includes at least 45 minutes for lunch. Buffers are available for overruns and urgent follow-up, not additional commitments.

## Priorities and deadline types

| Priority | Outcome | Deadline or constraint | Dependency |
| --- | --- | --- | --- |
| 1 | Respond to the renewal-affecting escalation | Hard: Monday; exact cutoff unspecified | Support supplies context and confirms response owner |
| 2 | Final board numbers | Hard: Thursday 12:00 | Lina's corrections, then two uninterrupted hours; vendor risk known Monday 15:00 |
| 3 | Deploy security patch | Hard: Friday 16:00 | Review, then half-day QA, then 30-minute change window; QA unavailable Thursday |
| 4 | Respond to two remaining escalations | Hard: Wednesday SLAs; exact cutoffs unspecified | Support identifies the tickets; plan responses Tuesday |
| 5 | Deliver strategy outline | Preference: “early this week”; Tuesday 14:00 is the cutoff for Tuesday 16:00 meeting review | Three focused hours; plan to send Monday |
| 6 | Prepare and hold customer demo | Wednesday 15:00 is preferred but conflicts with unavailability; customer also offers Thursday 16:00 | 90-minute rehearsal with Sam, working environment, confirmed booking and duration |

Priority reflects consequence and dependency risk, not a requirement to do every higher-ranked task before starting any lower-ranked task. Monday's strategy block uses the uninterrupted morning while leaving room for the Monday support deadline and engineering handoff.

## Monday

| Time | Work |
| --- | --- |
| 09:30–10:00 | Triage renewal escalation; confirm Monday cutoff and Wednesday SLA cutoffs with Support. Request review-ready patch by 15:15 and QA/release bookings from Engineering. Ask Product to confirm Thursday demo and Wednesday rehearsal. |
| 10:00–10:30 | Recurring meeting. |
| 10:30–13:30 | **Focus: strategy outline, three hours.** Prepare a useful first draft. |
| 13:30–14:15 | Lunch. |
| 14:15–15:00 | Renewal escalation: investigate and send the required response; identify next owner/action if resolution needs more work. |
| 15:00–15:15 | Check Lina's vendor status; send strategy outline for Tuesday leadership review. If vendor export is late, obtain a revised ETA and alert Finance. |
| 15:15–16:45 | **Focus: patch review, 90 minutes.** Use the upper end of the estimate. |
| 16:45–17:00 | Send review outcome to Engineering/QA; confirm readiness for QA. Review findings may block the handoff. |
| 17:00–17:30 | Contingency: escalation follow-up, patch findings, vendor coordination. |

If Support's Monday cutoff precedes 15:00, rearrange the response and strategy blocks at morning triage. For example, respond 10:30–11:15, then draft 11:15–13:30 and 14:15–15:00; this preserves three focused hours and the Monday send. If the actual cutoff cannot fit around the fixed meeting within working hours, ask Support to arrange coverage immediately. The inbox does not establish an end-of-day SLA.

## Tuesday

| Time | Work |
| --- | --- |
| 09:30–10:15 | Respond to first Wednesday-SLA escalation. |
| 10:15–11:00 | Respond to second Wednesday-SLA escalation. |
| 11:00–13:00 | **Focus: board corrections and reconciliation, two uninterrupted hours**, provided Lina's corrections have arrived. |
| 13:00–13:45 | Lunch. |
| 13:45–14:00 | Deliver reconciled numbers to Finance for confirmation/finalization; verify strategy outline was sent ahead of the 14:00 cutoff. |
| 14:00–16:00 | Protected contingency: delayed finance work first; otherwise patch findings and coordination. Keep this available as a complete two-hour finance fallback. |
| 16:00–17:00 | Leadership meeting; review outline if on agenda. |
| 17:00–17:30 | Record actions and handle urgent follow-up. |

**Separate QA dependency:** request a Tuesday half-day after Monday's review is complete and any blockers are resolved. Treat “half day” as four hours for planning, subject to QA confirming its actual duration, staffing and slot. This is QA's work, not four hours of the user's availability. No Tuesday QA availability is confirmed by the inbox; request it Monday and check the result before Wednesday deployment.

## Wednesday

| Time | Work |
| --- | --- |
| 09:30–10:00 | Check Wednesday support SLAs and QA result; Engineering/QA release-readiness decision. If blocked, activate Friday fallback. |
| 10:00–11:30 | **Demo rehearsal, 90 minutes with Sam**, within his stated 10:00–12:00 availability; proposed booking pending confirmation. |
| 11:30–12:00 | **Proposed patch change window**, only if review, QA and required release arrangements are complete. |
| 12:00–12:15 | Initial deployment checks and handoff to a confirmed monitoring owner before afternoon absence. This is an initial check allowance, not a guaranteed sufficient monitoring period. |
| 12:15–13:00 | Lunch. |
| 13:00–17:30 | Unavailable. No demo, work, or on-call coverage assigned here. |

If deployment or its monitoring cannot safely fit before 12:15, use the Friday path or have Engineering confirm another available release owner. Do not assume coverage during the unavailable afternoon.

## Thursday

| Time | Work |
| --- | --- |
| 09:30–10:00 | Recurring meeting. |
| 10:00–11:00 | Verify board-number status with Finance and deliver any final version; internal target is 11:00, ahead of the hard noon deadline. |
| 11:00–12:00 | Protected board contingency and receipt confirmation. **Board numbers final by 12:00.** |
| 12:00–12:45 | Lunch. |
| 12:45–14:15 | Follow up leadership actions or prepare demo fixes, as needed. |
| 14:15–15:30 | Contingency for rehearsal issues, patch coordination or overdue confirmations. QA is unavailable today. |
| 15:30–16:00 | Demo environment readiness check. |
| 16:00–17:00 | **Provisional customer demo hold.** Customer can do 16:00; Product must confirm booking, attendees and duration. One hour is a planning allowance, not a stated duration. |
| 17:00–17:30 | Demo follow-up or contingency. |

Thursday 10:00–12:00 can instead provide two uninterrupted hours for late corrections, but it leaves no margin before the deadline. Do not present that as a reliable recovery plan if Finance needs further review or handoff time.

## Friday

| Time | Work |
| --- | --- |
| 09:30–12:00 | Flexible reserve: patch remediation/QA coordination if needed; otherwise close agreed actions. |
| 12:00–12:45 | Lunch. |
| 12:45–14:00 | Continue release contingency or finish weekly follow-up. |
| 14:00–14:30 | Confirm passing QA and deployment readiness if using fallback. |
| 14:30–15:00 | **Proposed fallback patch change window**, conditional on QA passing and Engineering confirming the slot. |
| 15:00–16:00 | Release verification and contingency before the **hard 16:00 deployment deadline**. |
| 16:00–17:30 | Record outcomes, hand off remaining work and prepare next week. |

If Tuesday QA cannot happen, ask QA for a Friday morning half-day ending before the fallback window; confirm its hours rather than assuming availability. Friday QA leaves little time to fix failures, so escalate this risk as soon as Tuesday's path fails. Do not shorten or bypass QA to meet the deadline.

## Contingency rules

- **Corrections late:** Monday 15:00 is the early warning checkpoint. Get Lina's revised ETA and ask Finance what alternate data or reduced scope it can accept. If corrections miss Tuesday 11:00 but arrive by 14:00, use Tuesday 14:00–16:00 uninterrupted and send the output after the leadership meeting. If later, escalate immediately: Thursday 10:00–12:00 is the last intact two-hour block in this plan and has no delivery margin. Moving Wednesday rehearsal or Thursday's recurring meeting requires explicit agreement; neither is silently moved.
- **Patch not review-ready Monday:** use Tuesday 14:00–15:30 for review only if Finance does not need that block, then request a Wednesday QA half-day. That requires confirmed QA availability and a new release arrangement, likely Friday. If both Finance and review slip, escalate capacity to Engineering and Finance instead of double-booking. A substitute reviewer is a proposal requiring Engineering's agreement.
- **Demo fails rehearsal or remains unconfirmed:** Product owns agreeing reduced demo scope or another customer slot. Sam's Tuesday absence and Wednesday-only stated rehearsal window prevent assuming another rehearsal. Any Thursday demo longer than the one-hour allowance requires replanning within 17:30 and the meeting preference.
- **Support needs more than a response:** meet the response SLA with a useful status/next step and a named owner; do not promise complete resolution in a 45-minute estimate. Use buffers for follow-up, and escalate conflicts if actual SLA cutoffs demand earlier work.
- **Capacity:** under these assumptions, meetings are Monday 0.5h, Tuesday 1h, Wednesday 1.5h and Thursday 1.5h, below the preferred four-hour daily cap. No extra attendees' availability, evening work or weekend work is assumed.
