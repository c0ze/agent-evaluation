# Decisions

## Confirmed
1. Demo: decline Wed 15:00 preferred slot, take Thu 16:00. Reason: you are unavailable Wed 13:00–17:30, so Wed 15:00 is impossible regardless of rehearsal.
2. Rehearsal: Wed 10:00–11:30 with Sam (90 min). Only window satisfying Sam (out Tue, free Wed 10:00–12:00) + your Wed AM availability.
3. Security review: Mon 15:00–16:30 (90 min). Reason: QA is unavailable Thu, so review must be early enough to leave a non-Thu half day for QA (Tue) plus a Fri change window before the Fri 16:00 deploy deadline.
4. Board numbers: 2h uninterrupted block Tue 11:00–13:00 on Lina corrections (due Tue 11:00); finalize Thu 10:00–12:00 for Thu 12:00 Finance deadline.
5. Strategy outline: 3h split Mon (75+90 min) + Tue 09:30–10:15 (45 min); send by Tue 14:00 for Tue 16:00 leadership review.
6. Support order: renewal escalation Mon 10:30–11:15 (HARD Mon); other two early (one Tue AM, one Wed 11:30) to meet Wed SLAs without touching Wed PM OOO.

## Unresolved contradictions / trade-offs
- Lina corrections "by Tue 11:00 unless vendor export is late" vs Finance needing 2h after corrections + Thu 12:00 final: if the export is late, the Tue 11:00–13:00 block collapses and Thu morning becomes the only work window. No availability invented to cover this — Thu 12:00 would be at risk.
- QA "half day after review" vs QA out Thu: any review Wed or later squeezes QA into Fri AM directly against the Fri 16:00 window. Mon review is the mitigation.
- Customer preference (Wed 15:00) vs your hard OOO (Wed 13:00–17:30): preference loses; must communicate promptly so the customer commits to Thu 16:00.

## Questions — assigned
- Lina (by Mon 15:00): is the vendor export on track for Tue 11:00 corrections? If late, what is the new ETA? → decides board fallback.
- Finance (Tue, after Lina signal): if corrections slip, what partial/preliminary numbers are acceptable by Thu 12:00, and is any extension possible? → owns deadline risk call.
- Customer via Product (Mon): confirm Thu 16:00 demo; confirm duration and attendees; note Wed 15:00 unavailable. → Product owns customer comms.
- Sam (Mon): confirm Wed 10:00–11:30 rehearsal; confirm Thu 16:00 demo attendance. → Sam owns attendance.
- QA/Engineering (Mon after review): confirm QA half day Tue (fallback Wed AM/Fri AM — never Thu); confirm 30-min change window slot Fri before 16:00. → Engineering owns QA + window scheduling.
- CEO/leadership (with Tue 14:00 send): is a rough-cut outline acceptable for Tue 16:00, with polish Thu/Fri? → avoids overpromising a final strategy.
- Support (Mon): confirm renewal-escalation response sent Mon; confirm Wed-SLA items have owners if board/patch work overruns. → you own Mon response.
