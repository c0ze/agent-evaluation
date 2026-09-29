# Week Plan — Monday to Friday

Working hours: 09:30–17:30 Mon–Fri. Unavailable Wed 13:00–17:30. Lunch ≥45 min daily. Cap meetings at 4h/day.

## Hard deadlines vs preferences

- HARD: Board numbers final Thu 12:00 (Finance).
- HARD: Security patch deployed Fri 16:00.
- HARD: Renewal escalation response Mon; other two escalations SLA Wed.
- HARD: Strategy draft to leadership by Tue 14:00 to make Tue 16:00 review.
- PREFERENCE: Demo Wed 15:00 → cannot meet (unavailable + Sam rehearsal window). Take Thu 16:00 slot.
- Recurring (fixed): Mon 10:00–10:30, Tue 16:00–17:00, Thu 09:30–10:00.

## Dependencies

1. Lina corrections (Tue by 11:00) → 2h uninterrupted board work → Thu 12:00 final.
   Gate: Lina confirms by Mon 15:00 whether vendor export is late.
2. Security review (60–90 min, you) → QA half day (not Thu) → 30-min change window → Fri 16:00 deploy.
3. Demo rehearsal (90 min + Sam) → customer demo. Sam: out Tue, free Wed 10:00–12:00.

## Day by day

### Monday — unblock security + strategy, close renewal escalation
- 09:30–10:00 Triage. Confirm with customer: Thu 16:00 demo. Confirm Sam Wed 10:00 rehearsal.
- 10:00–10:30 Recurring meeting.
- 10:30–11:15 Support #1 (renewal escalation, 45 min). HARD Mon response.
- 11:15–12:30 Strategy draft pt. 1 (75 min focus).
- 12:30–13:15 Lunch.
- 13:15–14:45 Strategy draft pt. 2 (90 min focus).
- 15:00 Check Lina: is vendor export on track? (dependency gate — see contingencies).
- 15:00–16:30 Security patch review (90 min focus). Hands off to QA for Tue.
- 16:30–17:30 Contingency buffer (strategy overflow or escalation follow-up).
- Meetings total: ~1h15. Focus: ~4h.

### Tuesday — board numbers + strategy send + leadership
- 09:30–10:15 Strategy draft pt. 3 (45 min focus, completes 3h). Send by 14:00.
- 10:15–11:00 QA handoff check; Support #2 (first Wed-SLA escalation, 45 min) — done early to protect Wed morning.
- 11:00–13:00 Board numbers block (2h uninterrupted, starts when Lina corrections land by 11:00).
- 13:00–13:45 Lunch.
- 13:45–14:00 Send strategy outline (deadline 14:00).
- 14:00–15:30 Focus/buffer (board overflow, demo prep).
- 16:00–17:00 Leadership meeting (strategy review).
- Meetings total: 1h. Focus blocks protected around Lina 11:00 delivery.

### Wednesday — rehearsal only; OOO afternoon
- 09:30–10:00 Demo prep (solo).
- 10:00–11:30 Demo rehearsal with Sam (90 min). Only joint window.
- 11:30–12:15 Support #3 (second Wed-SLA escalation, 45 min).
- 12:15–13:00 Lunch.
- 13:00–17:30 UNAVAILABLE. No meetings, no rehearsal, no board work.
- Meetings total: 1.5h. Note: Wed 15:00 preferred demo slot DECLINED (see Decisions).

### Thursday — board final AM, demo PM
- 09:30–10:00 Recurring meeting.
- 10:00–12:00 Board numbers: finalize + submit (HARD 12:00). No other bookings here.
- 12:00–12:45 Lunch.
- 12:45–15:30 Focus/buffer (demo final prep, patch status check with QA — no QA work today, read-only).
- 16:00–17:00 Customer demo (Thu slot). Ends at close of business.
- Meetings total: ~1.5h.

### Friday — land the patch
- 09:30–12:00 QA results review + go/no-go prep (QA half day was Tue; Fri AM is overflow if QA slipped to Wed AM/Fri AM — still before window).
- 12:00–12:45 Lunch.
- 13:00–14:30 Pre-deploy checks, comms.
- 14:30–15:00-ish 30-min change window (scheduled well before 16:00 HARD deploy deadline).
- 15:00–16:00 Verify + close-out. Deadline 16:00.
- 16:00–17:30 Weekly wrap / contingency space.
- Keep meetings light; no recurring meetings today.

## Contingency space
- Mon 16:30–17:30 and Tue 14:00–15:30 and Thu 12:45–15:30 and Fri 16:00–17:30 are held as buffers, not pre-filled.
- If Lina/vendor late (known Mon 15:00): move 2h board block to Wed 09:30 slot? No — rehearsal is fixed. Instead: board block shifts to Thu 09:30–12:00 window extended (start 08:00? No — do not invent availability). Real fallback: compress Tue PM buffer into board work Wed 11:30? Also blocked. Actual fallback: do board work Tue PM (post-14:00 buffer) + Thu 10:00–12:00 final push; flag to Finance Tue that Thu 12:00 is at risk and ask what partial numbers suffice. See DECISIONS.md.
- If QA slips (QA out Thu): QA must be Tue or Wed AM or Fri AM. Mon review preserves all three options. If QA needs Wed AM, move Support #3 to Tue PM buffer.
- If Thu 16:00 demo slips: no Wed PM fallback exists (OOO). Next option is Fri — ask customer now so Thu 16:00 is firm.
