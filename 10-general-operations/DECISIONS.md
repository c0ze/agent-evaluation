# Decisions, contradictions, and questions

Source: `INBOX.md`. Week covered: Mon 12 – Fri 16 October 2026. Schedule details are in `WEEK_PLAN.md`.

## 1. Confirmed (stated in the notes; treat as fixed)

- Working hours 09:30–17:30, Monday to Friday. Wednesday 13:00–17:30 is unavailable.
- Board numbers must be final **Thu 15 Oct 12:00** (Finance). Two uninterrupted hours are needed after Lina's corrections on Tuesday.
- Security patch must deploy by **Fri 16 Oct 16:00**. Order: your review (60–90 min), then QA half day after the review, then a 30-minute change window. QA is unavailable Thursday.
- Lina's corrections arrive **Tue 13 Oct by 11:00**, unless the vendor export is late. Lina will know by **Mon 12 Oct 15:00**.
- Sam is unavailable Tuesday and can rehearse **Wed 14 Oct 10:00–12:00**.
- CEO outline must be sent by **Tue 13 Oct 14:00** to be reviewed at the 16:00 leadership meeting.
- Two support escalations have Wednesday SLAs. One affects renewals and needs a response Monday. Each takes about 45 minutes.
- Recurring meetings: Mon 10:00–10:30, Tue 16:00–17:00, Thu 09:30–10:00.
- Personal preference: no more than four hours of meetings a day, and at least 45 minutes for lunch.

## 2. Decisions made in the plan (proposed; you can change them)

| # | Decision | Reason | Status |
|---|---|---|---|
| D1 | Customer demo on **Thu 15 Oct 16:00** | Product's Wed 15:00 falls inside your unavailability. Thu 16:00 is the customer's stated alternative and is inside your hours | Needs Product to book it with the customer |
| D2 | Demo rehearsal with Sam on **Wed 14 Oct 10:00–11:30** | Sam's only offered window | Needs Sam to confirm |
| D3 | Security review **Mon 11:15–12:45** | Head of the chain; QA can then start Tuesday | Needs patch to be ready (Engineering) |
| D4 | QA half day **Tue 13 Oct** | Only needs to follow the review and avoid Thursday | **Assumed.** QA's Tuesday availability is not in the notes |
| D5 | Security change window **Wed 14 Oct 11:30–12:00**, fallback **Fri 16 Oct 13:30–14:00** | Leaves Thursday clear of the demo; Friday keeps a buffer before 16:00 | Needs Engineering to confirm the window owner and whether you must attend |
| D6 | Finance block **Tue 13 Oct 11:00–13:00**, fallback **Thu 15 Oct 10:00–12:00** | Only 2-hour block after corrections that does not clash with another fixed item | Fallback has zero slack |
| D7 | CEO outline first draft **Mon 12 Oct 13:30–16:30**; you send it **Tue 10:00–10:30** | Monday afternoon is the only three-hour block before Tue 14:00 that does not clash with the review or the renewal response | Needs your read on whether a first draft is enough |
| D8 | Two Wednesday-SLA escalations handled **Tue 13 Oct 13:45–15:15** | Wednesday is only usable until 13:00, and Wednesday's time goes to rehearsal and the change window. Handling them early is within the SLA | Needs Support to confirm the SLA times |
| D9 | Renewal-affecting escalation response **Mon 12 Oct 10:30–11:15** | Only day-specific deadline; first thing protects it | Needs Support to confirm what counts as a response |
| D10 | Nothing scheduled for you on Wednesday after 13:00 | Stated unavailability | Confirmed by the notes |

## 3. Unresolved contradictions

- **C1. Demo timing.** Product prefers Wed 15:00. You are unavailable Wed 13:00–17:30. Proposed resolution is D1 (Thu 16:00). Not agreed with Product or the customer.
- **C2. Leadership meeting.** The notes say the leadership meeting is Tue 16:00. The recurring Tue 16:00–17:00 meeting is in the same slot. Assumed to be the same meeting. If they are different, Tuesday 16:00 is double-booked.
- **C3. Board numbers depend on the vendor export.** If the export is late, the only two-hour block before Thu 12:00 is Thu 10:00–12:00. That leaves zero margin for a Finance deadline. The Monday 15:00 update from Lina is the decision point.
- **C4. "Sam must join."** It is not clear if Sam must join the demo, the rehearsal, or both. Sam's availability on Thursday is not stated. Only Wed 10:00–12:00 has been offered, and Tuesday is ruled out.
- **C5. CEO timing squeeze.** "Early this week" plus three focused hours plus a Tue 14:00 cutoff means Monday afternoon only. This competes with the renewal response and the security review. It is a squeeze rather than a hard conflict, but there is no spare time if Monday overruns.
- **C6. Who needs the two Finance hours?** The note does not say whether it is you or someone on your team. Planned as you.

## 4. Questions, by owner

**Product**
1. Can you book the customer demo for Thu 15 Oct 16:00? (Customer's stated alternative.) Please drop the Wed 15:00 request.
2. How long is the demo? Planned as 60 minutes.
3. Does Sam need to be on the demo itself, the rehearsal, or both?

**Sam**
4. Confirm the rehearsal on Wed 14 Oct 10:00–11:30.
5. Are you available on Thu 15 Oct 16:00 (and for a check at 15:30 if needed)?

**Lina**
6. By Mon 12 Oct 15:00: is the vendor export on track for Tuesday 11:00? If not, when do you expect the corrections?

**Finance**
7. Can the fallback be Thu 15 Oct 10:00–12:00 if corrections arrive late? Or would partial numbers on Tuesday be acceptable?
8. Who needs the two uninterrupted hours: the user (assumed in the plan) or a colleague? (See C6.)

**Engineering**
9. Will the patch be ready for review by Mon 12 Oct 11:15? If not, the review moves to 16:30 Monday.
10. Who runs the 30-minute change window? Does it need you present? Is Wed 14 Oct 11:30 acceptable, with Fri 13:30 as the fallback?
11. Is there any change freeze for the demo environment on Thursday?

**QA**
12. Are you available for a half day on Tue 13 Oct, after the Monday review? (Assumed; Thursday is confirmed unavailable.)

**Support lead**
13. What are the exact SLA times for the two Wednesday escalations?
14. Is the renewal response needed by a specific time on Monday, and should you or Support send it?

**CEO office / leadership**
15. Is the Tue 16:00 leadership slot the recurring Tue 16:00–17:00 meeting? (See C2.)
16. Is a first draft of the strategy outline acceptable on Tuesday, with the final version later?

**You**
17. Accept D1 (Thursday demo) and D7 (CEO draft Monday afternoon, send Tuesday morning)?
18. Confirm you are the owner of the Finance block (C6).
