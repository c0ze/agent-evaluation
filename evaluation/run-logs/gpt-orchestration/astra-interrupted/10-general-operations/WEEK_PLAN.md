# Week plan

This is a proposed schedule, not a record of bookings or messages sent. All times use the inbox's working-day clock; no timezone or calendar dates were supplied. Your working hours are 09:30–17:30, with Wednesday 13:00–17:30 unavailable. Other people's availability is confirmed only where the inbox states it.

## Priorities and deadlines

| Priority | Outcome | Deadline and dependency |
| --- | --- | --- |
| 1 | Respond to the renewal-related escalation | **Hard: Monday.** Allow 45 minutes; a response is required, not a promise of resolution. |
| 2 | Finalize board numbers | **Hard: Thursday 12:00.** Lina's corrections → two uninterrupted hours → final numbers to Finance. Corrections expected Tuesday by 11:00; Lina knows the vendor risk Monday by 15:00. |
| 3 | Deploy the security patch | **Hard: Friday 16:00.** Your 60–90-minute review → QA half day → 30-minute change window. QA is unavailable Thursday. |
| 4 | Respond to the other two escalations | **Hard: Wednesday SLAs; exact cutoff times unknown.** Plan both responses Tuesday, 45 minutes each. |
| 5 | Send the strategy outline | “Early this week” is a preference. **Tuesday 14:00 is the cutoff for review at Tuesday's 16:00 leadership meeting**, not an independently stated final-delivery deadline. Reserve three focused hours Monday. |
| 6 | Prepare and give the customer demo | Wednesday 15:00 is preferred but conflicts with your unavailability. Propose the offered Thursday 16:00 slot. A 90-minute rehearsal with Sam is required first. |

Priority reflects consequences and exposure to delay, not strict execution order. Monday's strategy block uses time before corrections arrive and protects the leadership-review opportunity; patch review still finishes Monday.

## Monday

| Time | Work |
| --- | --- |
| 09:30–10:00 | Triage the renewal case. Ask Engineering for a reviewable patch by 15:15 and QA for a Tuesday half day after review. Ask Product to confirm Thursday 16:00 and demo duration; request Sam's Wednesday 10:00–11:30 rehearsal. |
| 10:00–10:30 | Recurring meeting. |
| 10:30–11:15 | Focus: renewal escalation response. State next steps and owner without promising a fix date. |
| 11:15–14:15 | Focus: strategy outline, three uninterrupted hours. |
| 14:15–15:00 | Lunch, 45 minutes. |
| 15:00–15:15 | Check Lina's vendor status and corrections ETA. If late, agree a recovery path with Lina and Finance now. |
| 15:15–16:45 | Focus: security patch review, allowing the full 90 minutes. Conditional on Engineering supplying a reviewable patch. |
| 16:45–17:30 | Hand review results to Engineering/QA; preserve remaining time for review findings or the renewal case. If review cannot pass, revise QA timing rather than treating it as ready. |

## Tuesday

| Time | Work |
| --- | --- |
| 09:30–10:00 | Check and send the strategy outline for leadership review; target 10:00, cutoff 14:00. |
| 10:00–10:45 | Focus: first Wednesday-SLA escalation response. |
| 10:45–11:00 | Confirm receipt and completeness of Lina's corrections; buffer. |
| 11:00–13:00 | Focus: board numbers, two uninterrupted hours after corrections arrive. |
| 13:00–13:45 | Lunch, 45 minutes. |
| 13:45–14:30 | Focus: second Wednesday-SLA escalation response. |
| 14:30–15:15 | Send the board output to Finance and check acceptance/finalization requirements. Target a Finance-ready version today. |
| 15:15–16:00 | Contingency and leadership preparation. |
| 16:00–17:00 | Leadership meeting. |
| 17:00–17:30 | Check QA results and Wednesday deployment readiness; record strategy feedback. |

**Separate dependency:** request a Tuesday half day of QA after the completed review. QA must confirm its own hours and staffing; this is not an assumption that you perform QA alongside finance work. Wednesday deployment requires a passing result, any necessary re-review/retest, and a confirmed change window.

## Wednesday

| Time | Work |
| --- | --- |
| 09:30–10:00 | Target patch deployment: 30-minute change window, only if review and QA have passed and Engineering confirms the window. Otherwise retain the time for contingency. |
| 10:00–11:30 | Demo rehearsal with Sam, 90 uninterrupted minutes within his stated 10:00–12:00 availability; booking still needs confirmation. |
| 11:30–12:15 | Contingency: check escalation follow-ups, capture rehearsal fixes, and hand off any patch monitoring requiring afternoon coverage. |
| 12:15–13:00 | Lunch, 45 minutes. |
| 13:00–17:30 | Unavailable. No work, meeting, or on-call coverage assigned to you. |

Engineering must confirm deployment support, including coverage after 13:00; otherwise use the Friday fallback. Escalation responses are deliberately targeted Tuesday so unspecified Wednesday cutoff times do not become a scheduling risk.

## Thursday

| Time | Work |
| --- | --- |
| 09:30–10:00 | Recurring meeting. |
| 10:00–12:00 | Protect for board finalization and contingency. In the normal case, confirm/send the final numbers by 11:30 and retain the remaining margin. **Hard deadline: 12:00.** Delayed-input fallback below may require this entire block. |
| 12:00–12:45 | Lunch, 45 minutes. |
| 12:45–14:15 | Patch findings/re-review contingency if needed; otherwise demo fixes from rehearsal. QA cannot run today. |
| 14:15–16:00 | Demo preparation and contingency; finish required fixes before the demo. |
| 16:00–17:30 | Hold capacity for the proposed 16:00 customer demo and follow-up. Product must confirm duration and an end no later than 17:30; this hold does not assert a 90-minute meeting. Release unused time as buffer. |

## Friday

| Time | Work |
| --- | --- |
| 09:30–12:30 | Patch contingency and availability for QA questions; if already deployed successfully, close follow-ups and strategy revisions. |
| 12:30–13:15 | Lunch, 45 minutes. |
| 13:15–14:30 | Resolve remaining patch issues and inspect QA evidence. Target a deployment go/no-go by 14:30. Any code changes may require renewed review and QA. |
| 14:30–15:00 | Deployment preparation and buffer if fallback is needed. |
| 15:00–15:30 | Reserved fallback: 30-minute change window, conditional on passing review/QA and confirmed Engineering availability. |
| 15:30–16:00 | Verification and contingency before the **16:00 hard deployment deadline**. |
| 16:00–17:30 | Weekly closeout and handoffs; no planned patch work needed to meet the deadline extends into this block. |

## Contingency rules

- **Late corrections:** use Lina's Monday 15:00 status to alert Finance early. If Tuesday 11:00 inputs are missing but expected by 13:45, use 11:00–11:45 for the second escalation and keep 13:45–15:45 uninterrupted for finance; retain lunch and leadership. If corrections remain late, preserve Thursday 10:00–12:00 for the full two hours. That is the latest mathematical start and leaves no submission or approval margin. Finance must confirm whether its required two hours include finalization and delivery; any separate approval requires earlier inputs or another confirmed owner. Request an agreed alternative input or owner as soon as the ETA threatens this path. Do not silently substitute stale numbers.
- **Wednesday cannot absorb everything:** with lunch, only 2 hours 45 minutes are available before 13:00. The two-hour finance block plus the 90-minute rehearsal will not fit, even if deployment moves. Moving the rehearsal requires fresh confirmation from Sam and Product; his Tuesday availability cannot be assumed.
- **Patch review delayed:** Tuesday 14:30–16:00 can replace the Finance handoff/preparation blocks for a 90-minute review, provided finance does not also need its late-input fallback. Request Wednesday half-day QA after that review and use Friday's deployment window. QA's Wednesday staffing and ability to work without your afternoon involvement must be confirmed. If both finance and review slip, escalate the capacity conflict to Finance and Engineering rather than double-booking.
- **QA delayed or fails:** request a Friday half day, with results targeted by 14:30; actual hours and capacity belong to QA to confirm. Keep Thursday's review block for fixes if needed. If no full QA slot or successful completion is credible before the deployment window, Engineering must name an alternate QA resource or escalate the Friday deadline risk. Do not skip QA or count Thursday as a QA day.
- **Demo booking or rehearsal fails:** Product owns agreeing a new plan with the customer and Sam. Do not move the demo back into your unavailable Wednesday afternoon. Significant rehearsal fixes that cannot fit Thursday's preparation time must be surfaced to Product before the demo.

All days retain at least 45 minutes of lunch. Scheduled meeting load stays below the preferred four-hour daily maximum: Monday 30 minutes, Tuesday one hour, Wednesday 90 minutes plus a possible 30-minute change window, Thursday up to two hours including the demo hold, Friday a possible 30-minute change window. No overtime or additional team availability is assumed.
