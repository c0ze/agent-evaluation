## Results

Final scores come from the second, five-way blind grading pass, the one pass that graded all five models together.

| | Sonnet 5.5 | Fable 5.1 | Opus 5.5 | muse | mimo |
|---|---|---|---|---|---|
| **Total (of 130)** | **119.75** | 117.75 | 116.35 | 91.75 | 87.0 |
| Code (01–04) | 9.62 | **9.69** | 9.50 | 7.00 | 7.19 |
| Writing (05–08) | **9.06** | 8.56 | 9.00 | 6.75 | 6.94 |
| Operations (09–10) | **9.12** | **9.12** | 8.50 | 8.12 | 6.62 |
| Frontend (11–13) | **8.92** | 8.83 | 8.45 | 6.83 | 5.75 |
| First pass (4-way) | 123.25 | 118.5 | 118.5 | — | 86.25 |
| Effort | extra | extra | high | max | default |
| Time | ~28 min | ~49 min | ~21 min | 20.5 min | not recorded |
| Cost / usage | $15 | $53 | $14 | 6.2M in, 162k out tokens | not recorded |

### What was observed

- **All five completed all 13 tasks** and passed the hidden 11-test contract suite for tasks 01–02. No frontend page scrolled sideways at 390 px or made a network request. muse's task 13 page logs two console errors.
- **The three Claude models are close, and no model wins everywhere.** Sonnet 5.5 scored highest in both grading passes, 2–3.4 points ahead over 13 tasks. In the final pass, the best score on a task went to Sonnet on 6 tasks, Fable on 6 and Opus on 5 (ties counted for each).
- **Grading repeatability.** The same four submissions were graded twice, independently and blind. Per-task scores moved by 0.35 points on average; only 3 of 52 moved by a point or more. The top three kept the same order, but the gap narrowed from 4.75 to 3.4 points.
- **muse (max reasoning) is well behind the Claude models and 4.75 points ahead of mimo.** Its lead comes from operations and frontend; it is slightly behind mimo on code and writing. Its failures are concrete:
  - Its task 04 package doesn't build. It also added a runtime dependency and changed `normalize_version`'s output for ordinary versions.
  - It invents facts in tasks 05 and 08 (HTTPS delivery, "send time", "small team").
  - Its task 01 scheduler takes quadratic time (30 s for 20,000 jobs).
  - Its task 06 plan accepts breaches of the 24-hour deletion rule.
  - Its story (07) spells out its own meaning.
  - Its task 11 cards overlap at 390 px, and its task 13 page mixes the real date into fixed data.
  Its best tasks were 02 (9.25) and 10 (8.5).
- **mimo** has defects of the same kind: an unbuildable package (04), a recursive cycle check that crashes on large inputs (01), invented product facts (05, 08), a broken chart (11), and "Watered" on every button (13).
- **Fable 5.1** writes the strongest tests (task 01 in both passes). Its writing had small factual embellishments in both passes (05, 08).
- **Opus 5.5 ran on high effort**, not extra, and was the fastest and cheapest Claude run.
- **Cost differs far more than quality.** Fable cost 3.5–3.8× as much as Sonnet or Opus and took 1.75–2.3× as long, for a slightly lower total. muse finished in 20.5 min wall-clock (four tasks at a time), using 6.2M input tokens (5.5M cached), 162k output tokens and 172 model steps.

### What is inferred

- The differences between Sonnet, Fable and Opus are small enough that another run or grading pass could reorder them on any given work type. The gap from them to muse and mimo would not close.
- Opus 5.5 on extra effort might score higher. This run can't say.

## Recommendations by work type

- **Code:** any of the three Claude models. Fable 5.1 writes the strongest tests. Sonnet 5.5 and Opus 5.5 match it on correctness at about a quarter of the cost.
- **Writing, planning and incident analysis:** Sonnet 5.5 or Opus 5.5. Both were the most disciplined about facts and uncertainty. Fable embellished small facts in both grading passes.
- **Scheduling and operations:** Sonnet 5.5 or Fable 5.1.
- **Frontend:** Sonnet 5.5 or Fable 5.1 on average. Opus 5.5 produced the strongest playful page (13) in both passes.
- **Cost-sensitive work:** Opus 5.5 or Sonnet 5.5, about $0.12 per point each, against about $0.45 for Fable 5.1.
- **muse and mimo:** not for unsupervised work on these task types. Both need review for invented facts, packaging and performance problems, and untested failure paths.

## Caveats

- **One run per model.** Each pass had one blind grader per task. The graders were Claude Opus 5.5 subagents, and Opus 5.5 is also a contestant. Blinding (random letters per task, names and paths removed) reduces that bias but doesn't remove it. Opus did not come out on top.
- **Effort levels differ:** Sonnet and Fable ran on extra, Opus on high, muse on max, mimo on its default.
- **Different setups.** muse ran locally through tincan on this Mac, and mimo a week earlier through tincan on cachyos, with no timing or cost recorded. The Claude models ran in Claude Code's cloud. muse's cost can't be measured, so its token usage is reported instead.
- **Not checked:** the ruff lint results in task 04, and nginx syntax in task 03 (no nginx binary was available). No containers were started.
