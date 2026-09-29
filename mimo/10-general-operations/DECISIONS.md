# Decisions

## Confirmed decisions

These follow directly from stated constraints in the notes. No further approval needed to act on them.

1. **Working window is 09:30–17:30 Mon–Fri, with Wednesday 13:00–17:30 unavailable.** No work, meetings, or demos are scheduled in that Wednesday block.
2. **The renewal-related support escalation gets a response on Monday.** It is the only hard deadline that expires that day and it touches renewals.
3. **The two remaining support escalations are pulled into Monday afternoon and Tuesday morning** rather than left to their Wednesday SLA day. Wednesday morning is the only place the Sam rehearsal can happen, and keeping escalations out of that window preserves contingency.
4. **Board numbers get two uninterrupted hours on Tuesday 11:00–13:00**, matching Finance’s stated need (“two uninterrupted hours after Lina sends corrections Tuesday morning”), with Thursday 10:00–12:00 held as the finalization window before the hard stop at Thursday 12:00.
5. **Strategy outline is built Monday in three focus blocks (3h total)** and sent to leadership before Tuesday 14:00 so the 16:00 meeting can review it. Treating that send as an opportunity to use, not a second hard deadline.
6. **Demo rehearsal is Wednesday 10:00–11:30**, inside Sam’s only stated availability (Wed 10:00–12:00). 90 minutes as required.
7. **The Wednesday 15:00 demo is not viable.** It collides with the Wednesday afternoon blackout. The plan moves the demo to the customer’s stated alternative, **Thursday 16:00**, subject to confirmation (see open questions).
8. **Security patch review is scheduled Monday 15:00–16:30** to start the review → QA half-day → 30-minute change window chain early. QA must not be planned on Thursday (unavailable). Target live date Friday before 16:00.
9. **Meeting load is kept under four hours per day and lunch is protected at 45 minutes** on days where the working window is full. Wednesday’s short window may compress lunch if escalations have to be recovered there.

## Unresolved contradictions

1. **Preferred demo time vs. stated unavailability.**
   - Product prefers **Wednesday 15:00**.
   - You are **unavailable Wednesday 13:00–17:30**.
   - These cannot both hold. The notes offer **Thursday 16:00** as the customer’s alternative.
   - **Stance:** treat Thursday 16:00 as the working assumption *only after* Product confirms it with the customer. Do not promise Wednesday.

2. **Lina’s corrections may not exist when the board-numbers work needs them.**
   - Corrections expected **Tuesday by 11:00**.
   - If the vendor export is late, that timing slips; Lina knows **Monday 15:00**.
   - Two uninterrupted hours are required *after* corrections arrive, and the board deadline is **Thursday 12:00** — a late Monday/Tuesday signal compresses the whole chain.
   - **Stance:** checkpoint with Lina Monday 15:00 is mandatory. If the export is late, move board-numbers recovery into Tuesday 14:00–15:30 and Wednesday 11:30–13:00 and treat Thursday 10:00–12:00 as the last possible finish — not as slack.

3. **Security patch chain vs. QA’s Thursday blackout.**
   - Review (60–90 min) → QA (half day) → change window (30 min) → deploy by **Friday 16:00**.
   - QA cannot run Thursday.
   - If review slips past Wednesday, QA is forced onto Friday morning and the change window lands Friday afternoon — one QA failure away from missing the hard deadline.
   - **Stance:** review Monday; book QA for Tuesday or Wednesday. Friday is the fallback, not the plan.

4. **Strategy outline: “early this week” is vague.**
   - CEO asked for “early this week”; the concrete opportunity is **send by Tuesday 14:00** for the 16:00 leadership review.
   - Not a true contradiction, but an underspecified deadline. The plan uses Tuesday 14:00 as the working cutoff while flagging it for the CEO (below).

5. **Demo duration is unspecified.**
   - Rehearsal is fixed at 90 minutes; the demo itself has no stated length. The plan blocks 60 minutes at Thursday 16:00 as a placeholder.

## Questions assigned to the right person

| # | Question | Assigned to | Needed by | Why this person |
|---|---|---|---|---|
| 1 | Can we move the customer demo to **Thursday 16:00**? Wednesday 15:00 is impossible on our side. | **Product** (to confirm with the customer) | Monday EOD | Product owns the customer relationship and proposed the slots |
| 2 | How long is the demo slot (the rehearsal is 90 min; the demo itself is not specified)? | **Product** | Before Thu prep block | Same owner as the demo scheduling |
| 3 | Will the vendor export be on time? If not, when will your corrections actually land? | **Lina** | **Monday 15:00** | She stated she will know by then; board chain depends on it |
| 4 | Is the security patch ready for review Monday 15:00–16:30? | **Engineering** | Monday morning | They own the patch; review cannot start without it |
| 5 | Can QA take a half-day on **Tuesday or Wednesday** (not Thursday) after review? | **QA** (via Engineering) | Monday EOD | QA’s calendar is the constraint in the deploy chain |
| 6 | Which 30-minute change window should we hold — Wednesday, Thursday, or Friday early afternoon? | **Engineering** | Wednesday EOD | They own the change-window process |
| 7 | Is Tuesday 14:00 a real cutoff for the strategy outline, or is later this week acceptable? | **CEO** | Monday | Only the CEO can turn “early this week” into a firm date |
| 8 | Is Thursday 10:00–12:00 an acceptable finalization window for board numbers, given the 12:00 hard stop? | **Finance** | Tuesday EOD | Finance stated the two-hour need and the Thursday deadline |

## Hard deadlines vs. preferences — quick reference

**Hard (do not miss):**
- Monday: response to the renewal-related support escalation.
- Wednesday SLA: the other two support escalations (may be completed earlier).
- Thursday 12:00: board numbers final.
- Friday 16:00: security patch deployed.
- Stated working hours and Wednesday afternoon blackout are constraints, not preferences.

**Preferences / opportunities (adjustable):**
- Demo “preferred” Wednesday 15:00 → alternative Thursday 16:00.
- Strategy outline “early this week”; Tuesday 14:00 send unlocks a review slot but is not itself a hard deadline.
- ≤ 4 hours of meetings per day; ≥ 45 minutes for lunch (personal working preferences — protect them where possible, disclose if a day violates them).
