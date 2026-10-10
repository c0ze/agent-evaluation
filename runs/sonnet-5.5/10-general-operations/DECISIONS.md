# Decisions, Contradictions and Questions

Source: `INBOX.md` only. "Confirmed" here means stated in the notes. It does not mean agreed by the people affected. Nobody has yet confirmed the plan built on top of those facts.

## 1. Confirmed (stated in the notes; treated as fixed)

| # | Fact or decision | Source | Consequence for the plan |
|---|---|---|---|
| C1 | Working hours are 09:30-17:30, Monday to Friday. | Notes | Nothing planned outside them. |
| C2 | Wednesday 13:00-17:30 is unavailable. | Notes | Only 3.5 h usable Wednesday. Wednesday 15:00 demo is not possible for me. |
| C3 | Board numbers must be final by Thursday 12:00, and need 2 uninterrupted hours after Lina's corrections. | Finance | Protected block Tuesday 11:00-13:00, with Thursday 10:00-12:00 held as reserve. |
| C4 | Lina's corrections are due Tuesday by 11:00, unless the vendor export is late. She will know by Monday 15:00. | Lina | Monday 15:00 checkpoint. |
| C5 | Sam is unavailable Tuesday. Sam can rehearse Wednesday 10:00-12:00. | Sam | Rehearsal Wednesday 10:00-11:30. |
| C6 | The rehearsal takes 90 min and Sam must join. | Product | As above. |
| C7 | The security patch must deploy by Friday 16:00. It needs my review (60-90 min), then QA (half a day), then a 30 min change window. | Engineering | Review Monday. |
| C8 | QA is unavailable Thursday. | Engineering | No QA or re-QA on Thursday. |
| C9 | The renewals escalation needs a response Monday. The other two escalations have Wednesday SLAs. Each takes about 45 min. | Support | Renewals Monday 10:30. The other two by Tuesday. |
| C10 | The customer can do Thursday 16:00 as well as the preferred Wednesday 15:00. | Product | Thursday 16:00 is the only workable demo slot for me. |
| C11 | The recurring meetings are Monday 10:00-10:30, Tuesday 16:00-17:00 and Thursday 09:30-10:00. | Notes | Fixed in the plan. |

## 2. Planning decisions I have made (mine to make; easy to reverse)

| # | Decision | Reason |
|---|---|---|
| D1 | Do the patch review Monday 11:15-12:45. | It starts the longest chain, and Thursday is a dead day for QA. |
| D2 | Do the strategy draft on Monday afternoon, in two 90 min blocks, with a 15 min break for Lina's status. | Tuesday morning cannot hold 3 focused hours before the 14:00 cut-off, because the finance block starts at 11:00. |
| D3 | Treat the CEO's "early this week" as a soft ask, and treat 14:00 Tuesday as a cut-off only for review at the 16:00 meeting. | Nothing in the notes makes it a hard deadline. |
| D4 | Treat Wednesday 15:00 for the demo as unavailable, and propose Thursday 16:00. | Wednesday 15:00 falls in my stated unavailable time. |
| D5 | Clear both Wednesday SLA escalations by Tuesday 11:00. | I am gone after 13:00 Wednesday and the SLA times are unknown. |
| D6 | Keep Thursday 10:00-12:00 free as reserve, even if the numbers are finished Tuesday. | It is the only clean fallback if corrections slip. |
| D7 | Start the patch change window no later than Friday 14:30 in the fallback path. | It leaves 90 min for a retry or rollback before 16:00. |
| D8 | Keep meetings at 4 h a day or less, and lunch at 45 min or more, on every day. | These are preferences, and the plan meets them at no cost. |

## 3. Unresolved contradictions and risks

| # | Issue | Why it cannot be settled from the notes | Who resolves it |
|---|---|---|---|
| X1 | **Demo timing.** Product prefers Wednesday 15:00, which is inside my unavailable time. Thursday 16:00 works for the customer. | It is not clear whether I must present, or whether someone else could cover Wednesday. | Product |
| X2 | **Who Sam must join.** "Demo environment needs a 90-minute rehearsal and Sam must join." Sam's only stated availability is Wednesday 10:00-12:00. That fits the rehearsal, but the notes do not say whether Sam is also needed at the demo. | If Sam is needed at Thursday 16:00, Sam's Thursday availability is unknown. | Product, then Sam |
| X3 | **Finance depends on an external vendor.** Finance needs 2 clean hours after Tuesday's corrections. Lina's date is conditional on the vendor export. If it slips, Wednesday cannot host 2 uninterrupted hours (the rehearsal splits the morning, the afternoon is unavailable). The only fallback is Thursday 10:00-12:00 with zero slack, right after the 09:30 meeting. | The vendor status is unknown until Monday 15:00. | Lina, then Finance |
| X4 | **Patch chain has no stated QA schedule.** QA needs half a day and is out Thursday, but the notes do not say which half days QA has free on Monday, Tuesday, Wednesday or Friday. The change window has no stated date, and I am unavailable Wednesday afternoon. If QA starts Friday there is no retry. | Not stated. | Engineering |
| X5 | **"Tuesday 16:00 leadership meeting" vs the recurring Tuesday 16:00-17:00 meeting.** I assumed they are the same meeting. | Not stated. | CEO or the meeting organiser |
| X6 | **Support SLAs.** Cut-off times are not given for Monday's renewals response or the Wednesday SLAs. It is also unclear whether 45 min means the response or the full resolution. | Not stated. | Support |
| X7 | **Demo length is not given.** I held 60 min at Thursday 16:00. | Not stated. | Product |
| X8 | **Deploying Wednesday morning leaves me unreachable that afternoon** if a post-deploy problem appears. The alternative is a Friday deploy, which leaves no retry room. Neither is clearly better. | It depends on who else can respond. | Engineering |

## 4. Questions by owner

**Lina**
1. Is the vendor export on track for Tuesday 11:00? Please tell me by Monday 15:00.
2. If it is late, what is the realistic arrival time? If it is Tuesday afternoon, I can still fit the finance block by about 13:45.

**Finance**
3. Is Thursday 12:00 fixed, or is there any margin?
4. If the corrections are late, could the board numbers be final in a shorter block if I have partial data earlier?
5. Who signs off the final numbers, and when do they need them before 12:00 Thursday?

**Product**
6. Please confirm Thursday 16:00 with the customer, and how long the demo runs. (X1, X7)
7. Can someone else cover Wednesday 15:00, or is my attendance required? I assume it is required, so the plan defaults to Thursday.
8. Does Sam need to be at the demo itself, or only at the rehearsal? (X2)

**Sam**
9. Does Wednesday 10:00-11:30 work for the rehearsal? Are you free Thursday 16:00, if that turns out to matter?

**Engineering / QA lead**
10. Can QA start the patch Monday afternoon or Tuesday, and which half day? Wednesday morning is the fallback.
11. When is the 30 min change window, and who needs to attend? I propose Wednesday 09:30, with Friday before 14:30 as the fallback. (X4, X8)
12. Who is on hand if the patch causes a problem while I am unavailable Wednesday afternoon?

**CEO**
13. Is a rough first draft acceptable for the Tuesday review? I would rather send something early than late.
14. What form do you want the outline in (length, structure)? The 3 h estimate assumes a first draft, not a finished paper.
15. Is the Tuesday 16:00 review the recurring leadership meeting? (X5)

**Support**
16. What time on Monday is the renewals response due, and what are the cut-off times on Wednesday's two SLAs?
17. Does the 45 min per escalation cover a full resolution or only the first response? Is anyone else able to pick up an escalation if Monday overruns?

**Meeting organiser, Thursday 09:30**
18. Only if Lina's corrections are late: can this meeting be skipped or shortened, so that Thursday 10:00-12:00 is not the only clean window?

## 5. Decisions needed by (in order)

| By | Decision | From |
|---|---|---|
| Monday 15:00 | Is the vendor export late? | Lina |
| Monday end of day | QA slot booked for the patch | Engineering |
| Tuesday 11:00 | Corrections received, or the fallback slot chosen | Lina and me |
| Wednesday 09:30 | Rehearsal confirmed. Change-window date confirmed. Demo slot confirmed. | Sam, Engineering, Product |
