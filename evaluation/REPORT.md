## Results

| | Sonnet 5.5 | Fable 5.1 | Opus 5.5 | mimo |
|---|---|---|---|---|
| **Total (of 130)** | **123.25** | 118.5 | 118.5 | 86.25 |
| Code (01–04) | 9.62 | 9.62 | 9.38 | 7.12 |
| Writing (05–08) | **9.38** | 8.75 | 9.00 | 6.62 |
| Operations (09–10) | **9.75** | 9.25 | 9.00 | 6.75 |
| Frontend (11–13) | **9.25** | 8.83 | 9.00 | 5.92 |
| Effort | extra | extra | high | default |
| Time | ~28 min | ~49 min | ~21 min | not recorded |
| Cost | $15 | $53 | $14 | not recorded |

### What was observed

- **All four completed all 13 tasks** and passed the hidden 11-test contract suite for tasks 01–02. Every frontend page loaded with no console errors, no network requests and no horizontal scroll at 390 px.
- **The three Claude models are close.** Sonnet 5.5 is ahead by 4.75 points over 13 tasks, about 0.4 per task. It placed first or tied for first on 9 of 13 tasks.
- **mimo is clearly behind, with real defects rather than weaker polish:**
  - Its task 04 package doesn't build, so every CI job would fail.
  - Its task 01 cycle check crashes with `RecursionError` on large inputs.
  - Its task 05 and 08 copy invents product facts.
  - Its task 11 chart is visibly broken.
  - Its task 13 buttons say "Watered" for every action.
- **Fable 5.1's main weakness is small factual embellishment in writing.** On tasks 05 and 08 it stated things the source didn't say. It had the strongest test suite on task 01 (10/10) and the most thorough diagnoses.
- **Opus 5.5 was best on two of the three frontend tasks** (12 editorial, 13 playful) and on release work (04, 10/10). It was weakest on task 11, whose 390 px table layout was cramped. It ran on *high* effort and was the fastest and cheapest.
- **Cost differs far more than quality.** Fable cost about 3.5–3.8× as much as Sonnet or Opus and took 1.75–2.3× as long, for a lower total.

### What is inferred

- The gap between the three Claude models is within what one grader per task can distinguish. A second grading pass could reorder them. The gap to mimo would not close.
- Opus 5.5 on extra effort might score higher. This run can't say.

## Recommendations by work type

- **Writing, planning, incident analysis and scheduling:** Sonnet 5.5. It had the highest score and was the most disciplined about facts and uncertainty. Its cost per point is about the same as Opus's.
- **Code:** any of the three. Fable 5.1 writes the strongest tests. Opus 5.5 is fastest and was best on release and packaging work.
- **Frontend with a strong visual direction:** Opus 5.5 or Sonnet 5.5. Opus had the most coherent editorial and playful pages; Sonnet had the most complete operations dashboard.
- **Cost-sensitive batch work:** Opus 5.5 or Sonnet 5.5, about $0.12 per point each (Opus $14 / 118.5, Sonnet $15 / 123.25; Fable about $0.45). Fable 5.1's extra cost didn't show up as extra quality here.
- **mimo:** not for unsupervised work on these task types. Its output needs review for invented facts and untested failure paths.

## Caveats

- **One run per model and one blind grader per task.** The graders were Claude Opus 5.5 subagents, and Opus 5.5 is also a contestant. Blinding (random letters per task, names and paths removed) reduces that bias but doesn't remove it. Opus did not come out on top.
- **Effort levels differ:** Sonnet and Fable ran on extra, Opus on high.
- **mimo ran a week earlier under a different setup:** tincan on cachyos, with no timing or cost recorded.
- **Not checked:** the ruff lint results in task 04, and nginx syntax in task 03 (no nginx binary was available). No containers were started.
- **muse** is being re-run at max reasoning and is not included yet.
