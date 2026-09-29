## Results

Final scores come from the latest blind grading pass, which graded six models together. GPT-6 Astra (paused at 9 of 13 tasks when its account ran out of credits) and GPT-6.1 Sol (running) will join in the next pass.

| | Sonnet 5.5 | Fable 5.1 | Opus 5.5 | GPT-6 Luna | muse | mimo |
|---|---|---|---|---|---|---|
| **Total (of 130)** | **122.25** | 117.85 | 116.4 | 91.4 | 90.95 | 88.65 |
| Code (01–04) | **9.56** | **9.56** | 9.25 | 7.25 | 6.88 | 7.19 |
| Writing (05–08) | **9.25** | 8.81 | **9.25** | 7.50 | 6.81 | 7.06 |
| Operations (09–10) | **9.50** | 8.75 | 8.38 | 7.25 | 7.62 | 6.62 |
| Frontend (11–13) | **9.33** | 8.95 | 8.55 | 5.97 | 6.98 | 6.13 |
| Earlier passes (4-way, 5-way) | 123.25, 119.75 | 118.5, 117.75 | 118.5, 116.35 | — | —, 91.75 | 86.25, 87.0 |
| Effort | extra | extra | high | max | max | default |
| Time | ~28 min | ~49 min | ~21 min | 34 min | 20.5 min | not recorded |
| Cost / usage | $15 | $53 | $14 | 3.5M in, 220k out tokens; ~6% of a 5-hour window | 6.2M in, 162k out tokens | not recorded |

### What was observed

- **All six completed all 13 tasks** and passed the hidden 11-test contract suite for tasks 01–02. No frontend page scrolled sideways at 390 px or made a network request.
- **Sonnet 5.5 led all three grading passes** (122.25, against 117.85 for Fable and 116.4 for Opus in the latest). In the latest pass it had the best or tied-best score on 9 of 13 tasks; Opus had 5 and Fable 2 (ties counted for each).
- **Grading repeatability.** Each model was graded independently in every pass it took part in. Between the five-way and six-way passes, per-task scores moved by 0.34 points on average, and 5 of 65 moved by a point or more. The order of the top three never changed.
- **Two clear tiers.** The three Claude models score 116–122. GPT-6 Luna, muse and mimo score 88–92. Nothing in between.
- **GPT-6 Luna (max)** was the most factually disciplined writer on social media (nothing invented) and wrote an honest, cautious plan (06). But it was weak on frontend work:
  - generic layouts;
  - tiny, low-contrast type;
  - the real date mixed into fixed data (13);
  - a visible empty-state bug (11).

  On code, its task 04 package doesn't build, and its test suites are thin (12 tests on 01; 6 regression tests on 02 that miss three original bugs). It also left a draft of its task 12 page outside its task directory, which the brief forbids.
- **muse (max)** and **mimo** have the same kinds of failures as in earlier passes:
  - packages that don't build (04);
  - invented facts (05, 08);
  - a recursive cycle check that crashes on large inputs (mimo, 01);
  - quadratic scheduling (muse, 01);
  - broken or generic frontends.
- **Fable 5.1** again wrote the strongest tests (task 01) and again embellished small facts in writing (05, 08).
- **Cost and speed:** Opus was fastest and cheapest of the Claude runs ($14, 21 min), Sonnet close behind ($15, 28 min), Fable far more expensive ($53, 49 min). The GPT runs report quota, not dollars: Luna used about 6% of a 5-hour window. Astra used a whole 5-hour window and 16% of a weekly quota on nine tasks with about the same number of tokens.

### What is inferred

- Between the three Claude models, the gaps on individual work types are small enough that another run could reorder them. Sonnet's overall lead has held in all three passes.
- The gap between the Claude models and the others (about 25 points of 130) is far beyond grading noise.
- Opus 5.5 on extra effort might score higher. This run can't say.

## Recommendations by work type

- **Code:** Sonnet 5.5, Fable 5.1 or Opus 5.5. Fable writes the strongest tests, but costs about four times as much.
- **Writing, planning and incident analysis:** Sonnet 5.5 or Opus 5.5. Both were the most disciplined about facts and uncertainty.
- **Scheduling and operations:** Sonnet 5.5.
- **Frontend:** Sonnet 5.5, then Fable 5.1.
- **Cost-sensitive work:** Opus 5.5 or Sonnet 5.5, about $0.12 per point, against about $0.45 for Fable 5.1.
- **GPT-6 Luna, muse and mimo:** not for unsupervised work on these task types. Luna is the most careful of the three about facts; muse is the strongest of the three on operations and frontend; all three need review for packaging, test depth and scope.

## Caveats

- **One run per model and one blind grader per task per pass.** The graders were Claude Opus 5.5 subagents, so three of the contestants share a model family with the grader, and one is the same model. Blinding (random letters per task, names and paths removed) reduces that bias but doesn't remove it. Opus did not come out on top.
- **Effort levels differ:** Sonnet and Fable ran on extra, Opus on high, Luna and muse on max, mimo on its default.
- **Different setups.** The Claude models ran in Claude Code's cloud. Luna ran in Codex CLI on this Mac (its account's personal AGENTS.md set aside). muse ran through tincan on this Mac. mimo ran a week earlier through tincan on cachyos, with no timing or cost recorded.
- **Not checked:** ruff lint results in task 04, and nginx syntax in task 03 (no nginx binary was available). No containers were started.
