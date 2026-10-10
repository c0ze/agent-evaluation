# Decisions, Contradictions, and Open Questions

## Confirmed (stated by the owner, no action needed)
| # | Fact / decision | Owner |
|---|---|---|
| C1 | Board numbers must be final by **Thu 12:00** (hard) | Finance |
| C2 | Board work needs 2 uninterrupted hours *after* Lina's corrections | Finance |
| C3 | Corrections are due Tue by 11:00; Lina will flag a vendor-export delay by Mon 15:00 | Lina |
| C4 | Security patch must deploy by **Fri 16:00** (hard). Order: review (60–90 min) → QA (half day) → 30-min change window | Engineering |
| C5 | QA is unavailable Thursday | Engineering |
| C6 | Demo rehearsal takes 90 min and Sam must join. Sam is out Tuesday and can do Wed 10:00–12:00 | Product / Sam |
| C7 | Customer can do Wed 15:00 (preferred) or Thu 16:00 | Product |
| C8 | Renewal-affecting escalation needs a response Monday. The other two have Wednesday SLAs. About 45 min each | Support |
| C9 | Leadership meeting Tue 16:00 can review the CEO outline if it's sent by 14:00 | CEO |
| C10 | I'm unavailable Wed 13:00–17:30 | Me |

## Planning decisions I'm making (can be changed if someone objects)
| # | Decision | Why |
|---|---|---|
| P1 | Security review first thing Monday (10:30–12:00) | Longest chain, and QA is out Thursday, so a late start leaves no room for a second QA pass |
| P2 | Board numbers get a protected block Tue 11:00–13:00 with no meetings | Matches Finance's ask and Lina's ETA |
| P3 | CEO outline drafted Mon afternoon and sent Mon end of day | Meets "early this week" and clears the Tue 14:00 cutoff with a day to spare |
| P4 | Both Wednesday-SLA escalations handled Tuesday morning | Wednesday is a half day, mostly taken by rehearsal, and the SLA times are unknown |
| P5 | Rehearsal held at Wed 10:00–11:30 whatever the demo date | Sam's only confirmed window |
| P6 | Friday morning kept free as security buffer | Covers the case where QA's re-run falls on Friday |

## Unresolved contradictions
**D1 — Demo Wed 15:00 vs. my Wednesday afternoon unavailability.**
Product prefers Wed 15:00, but I'm out Wed 13:00–17:30. If I need to be at the demo, it has to be **Thu 16:00**. If I don't, Wed 15:00 can stand, but someone else has to own it. Sam's Wednesday afternoon availability is also unknown. *Decision needed from Product by Monday end of day.*

**D2 — Board deadline vs. the late-export risk.**
Finance wants 2 uninterrupted hours after the corrections, and the corrections could slip. If they come in after ~13:45 Tuesday, my next 2-hour slot is Thu 09:30–11:30, and only if I skip the Thursday recurring meeting. That leaves a 30-minute margin before a hard deadline. *Finance should decide on Monday whether that's acceptable or whether to change scope or sequencing.*

**D3 — "Early this week" vs. the Tue 14:00 cutoff.**
Probably not a real conflict, but "early this week" is undefined. I'm assuming Monday end of day is enough and that the Tuesday leadership review is the review the CEO wants. *Confirm with the CEO.*

**D4 — Security has only one QA retry path.**
QA is out Thursday. If QA finds an issue on Wednesday, the re-run is Friday, and the change window has to happen by ~14:30 to protect the 16:00 deadline. That works only if QA is available Friday morning, which nobody has confirmed. *Confirm with Engineering.*

## Questions, by owner
| # | To | Question | Needed by |
|---|---|---|---|
| Q1 | **Product** | Do I need to attend the customer demo? If yes, can we book Thu 16:00 now? How long is the demo, and does Sam need to be there? | Mon EOD |
| Q2 | **Lina** | At 15:00 Monday: is the vendor export on time? If not, what's the new ETA for the corrections? | Mon 15:00 |
| Q3 | **Finance** | If the corrections slip past Tue ~13:45, is Thu 09:30–11:30 (30 min margin) acceptable? Is there anything we can pre-build before the corrections land to shorten the 2 hours? | Mon EOD |
| Q4 | **Engineering** | When exactly is QA available Mon/Tue/Wed and Fri? Can QA start the day my review lands (Mon afternoon or Tue)? When is the change window, and do I need to be present? Is QA available Friday morning for a re-run? | Mon midday |
| Q5 | **CEO** | Is Monday end of day early enough, and is Tuesday's leadership meeting the review you want? Any scope limits for the outline? | Mon |
| Q6 | **Sam** | Please hold Wed 10:00–11:30 for the rehearsal. Just in case: do you have a backup slot Mon, Thu or Fri? | Mon |
| Q7 | **Support** | What time is Monday's renewal response due, and what are the exact Wednesday SLA times? | Mon morning |
