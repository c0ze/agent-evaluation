# Riskiest assumptions — offline inspection sync

The `PLAN.md` assumptions with the highest combination of uncertainty and
blast radius are A2 (edit overlap), A4/A5 (photo upload under intermittent
connectivity), and A9 (24-hour purge). Each is summarized below with why it
is risky, what breaks if it is wrong, and how the plan hedges.

## 1. Supervisors rarely edit the same form fields an offline inspector is editing (A2)

**Why it is riskiest.** The entire conflict policy — auto-merge
non-overlapping fields, guided per-field choice for true conflicts, no
collaborative editor — rests on overlap being uncommon. The brief only says
supervisors "can edit the same inspection from the web"; it says nothing
about which fields or how often. If supervisors routinely correct answers
while inspectors are offline in basements, conflicts become the common case:
inspectors face a conflict screen after every shift, submissions stall, and
either side's work is at risk of being bulk-overwritten under time pressure.

**If wrong.** Conflict-resolution UX becomes the product, not the edge case;
"no silent overwrites" still holds, but throughput and trust collapse, and
supervisor accept/reject queues clog on "pending tablet changes."

**Hedge in the plan.** Per-field diff with both values/authors/timestamps,
bulk + per-field choices, supervisor-authoritative denylist for status
fields, losing-side preservation in audit, web warnings before editing
records with pending tablet drafts, and a conflict-rate dashboard with pilot
exit gates (decisions D2, D4, D8). Pilot must measure true-conflict rate
before broad rollout; if it is high, the revisit is workflow (who edits what,
when), not a bigger merge algorithm — product already ruled out a full
collaborative editor.

## 2. Forty photos can be uploaded over intermittent connectivity within an acceptable window (A4 + A5)

**Why it is risky.** Photos dominate bytes, time, and failure modes. Forty
multi-MB originals over basement-grade links with mid-batch interruptions
may never converge: uploads restart without resume, storage fills, submits
block on missing attachments, and inspectors learn to delay or skip photos.
The brief fixes the count (40) but not sizes, quality obligations, or how
long a usable window lasts — all three multiply into one throughput gamble.

**If wrong.** Inspections pile up in "photos pending," submit barriers never
clear, tablets run out of encrypted storage, and retry storms on brief
reconnects crowd out field-op sync.

**Hedge in the plan.** Resumable chunked uploads with per-chunk ack and hash
verification, independent per-attachment retry, prioritized signature/field
sync, local 40-photo enforcement with visible counters, low-storage stress
tests — and, decisively, decision D3: define a compressed rendition as the
record if compliance permits. The pilot gate on attachment completion rate
is the falsification test for this assumption.

## 3. "Removal within 24 hours after acceptance" is achievable from a tablet that may be offline (A9)

**Why it is risky.** The obligation is regulatory, but the tablet cannot act
on an acceptance it has not observed. If "24 hours after acceptance" is read
as server-side wall clock with no tolerance for offline delay, every
tablet offline for a day after acceptance is a breach by construction — and
thumbnails, caches, and outbox payloads widen the purge surface beyond the
obvious files. The brief mandates the outcome but not the clock, the scope
of "local customer data," or the accounting for offline delay.

**If wrong.** Silent non-compliance: customer data lingers past the window
with no record, or conversely an over-aggressive purge deletes unacked
drafts/photos to meet a misread deadline.

**Hedge in the plan.** Purge scheduler keyed to observation with reboot- and
background-safe execution, cryptographic erasure, purge scope covering
answers/photos/signature/thumbnails/caches/outbox, `purge_log` receipts, and
— critically — decision D7: server acceptance starts the obligation, the
tablet purges within 24 hours of observation, and late observation is logged
as an auditable compliance exception rather than silent breach. Legal and
compliance must confirm D7 before implementation; telemetry alerts on any
purge-window breach during pilot.
