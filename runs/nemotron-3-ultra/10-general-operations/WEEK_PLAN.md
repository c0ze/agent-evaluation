# Week Plan: Monday–Friday

**Working hours:** 09:30–17:30 Mon–Fri | **Wednesday unavailable:** 13:00–17:30  
**Meeting cap:** ≤4 hrs/day | **Lunch:** 45 min protected daily

---

## Monday
| Time | Activity | Type | Notes |
|------|----------|------|-------|
| 09:30–10:00 | Triage & prep | Focus | Clear inbox, confirm Lina ETA |
| 10:00–10:30 | Recurring meeting | Meeting | Fixed |
| 10:30–11:15 | Support #1: renewals escalation | Hard deadline | 45 min, must respond today |
| 11:15–12:00 | Support #2: Wednesday SLA | Hard deadline | 45 min, front-load to clear Wed |
| 12:00–12:45 | **Lunch** | — | Protected |
| 12:45–15:45 | CEO strategy outline | Hard deadline | 3 focused hrs, send by Tue 14:00 |
| 15:45–17:30 | Buffer / admin / Tue prep | Contingency | Lina confirmation by 15:00 |

**Meetings:** 0.5h | **Focus blocks:** 4.5h | **Risk:** Lina vendor export status at 15:00

---

## Tuesday
| Time | Activity | Type | Notes |
|------|----------|------|-------|
| 09:30–10:15 | Support #3: Wednesday SLA | Hard deadline | 45 min, done before Lina |
| 10:15–11:00 | Buffer for Lina corrections | Contingency | She commits by 11:00 |
| 11:00–13:00 | Finance: board numbers | Hard deadline | 2h uninterrupted, due Thu 12:00 |
| 13:00–13:45 | **Lunch** | — | Protected |
| 13:45–14:00 | Finalize & send CEO strategy | Delivery | For 16:00 leadership review |
| 14:00–16:00 | Leadership meeting prep | Prep | Review materials, align talking pts |
| 16:00–17:00 | Recurring leadership meeting | Meeting | Fixed |
| 17:00–17:30 | Security patch review prep | Prep | Read diffs, draft comments |

**Meetings:** 1h | **Focus blocks:** 3.75h | **Risk:** Lina late → Finance slips; escalate Monday 15:00

---

## Wednesday (09:30–13:00 only)
| Time | Activity | Type | Notes |
|------|----------|------|-------|
| 09:30–10:00 | Demo final prep | Focus | Slides, env check |
| 10:00–11:30 | **Demo rehearsal with Sam** | Hard dependency | Sam only window 10–12; 90 min |
| 11:30–12:15 | Buffer / rehearsal debrief | Contingency | Capture action items |
| 12:15–13:00 | **Lunch** | — | Protected (ends at unavailability) |

**Meetings:** 0h | **Focus blocks:** 2.5h | **Hard stop:** 13:00

---

## Thursday
| Time | Activity | Type | Notes |
|------|----------|------|-------|
| 09:30–10:00 | Recurring meeting | Meeting | Fixed |
| 10:00–11:30 | Security patch review | Hard deadline | 90 min, unblocks Fri QA |
| 11:30–12:00 | Demo coord / dry-run solo | Prep | Customer demo at 16:00 |
| 12:00–12:45 | **Lunch** | — | Protected |
| 12:45–15:30 | Open: Finance polish / QA handoff | Flex | QA unavailable today |
| 15:30–16:00 | Buffer / demo setup | Contingency | |
| 16:00–16:30 | **Customer demo** | Hard deadline | Alt slot (Wed 15:00 impossible) |
| 16:30–17:30 | Wrap / Friday QA brief | Handoff | Confirm Fri 09:30 QA start |

**Meetings:** 1h | **Focus blocks:** 3.5h | **Note:** QA unavailable Thu → must run Fri AM

---

## Friday
| Time | Activity | Type | Notes |
|------|----------|------|-------|
| 09:30–13:30 | QA: security patch | Hard dependency | 4h block, starts after Thu review |
| 13:30–14:15 | **Lunch** | — | Protected |
| 14:15–15:00 | Deploy prep / final checks | Focus | Change window at 15:00 |
| 15:00–15:30 | **Deploy change window** | Hard deadline | 30 min, must complete by 16:00 |
| 15:30–16:00 | Deploy verification | Verification | Smoke tests, rollback plan ready |
| 16:00–17:30 | Buffer / week closeout | Contingency | Retro, next-week prep |

**Meetings:** 0h | **Focus blocks:** 5.5h | **Hard deadline:** Deploy by 16:00

---

## Dependency Chain Summary
```
Lina (Mon 15:00 status) → Tue 11:00 corrections → Finance (Tue 11–13) → Board numbers (Thu 12:00)
Sam (Wed 10–12) → Rehearsal (Wed 10–11:30) → Demo (Thu 16:00)
Patch review (Thu 10–11:30) → QA (Fri 09:30–13:30) → Deploy (Fri 15:00–15:30) → Done (Fri 16:00)
CEO strategy (Mon 12:45–15:45) → Send (Tue 14:00) → Leadership review (Tue 16:00)
Support #1 (Mon 10:30) → done; #2 (Mon 11:15), #3 (Tue 09:30) → both before Wed SLA
```

## Contingency Reserves
- **Mon 15:45–17:30:** Absorb Lina delay or Support overflow
- **Tue 10:15–11:00:** Explicit Lina buffer
- **Wed 11:30–12:15:** Rehearsal overrun / action items
- **Thu 12:45–15:30:** Finance polish / QA coordination flex
- **Fri 16:00–17:30:** Deploy verification / rollback time