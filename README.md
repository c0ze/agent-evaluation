# Mimo vs Muse evaluation

This suite compares the two tincan presets on thirteen independent tasks. Each model
receives its own copy under `mimo/` or `muse/`. Tasks are intentionally stateless
and must be completed only inside the assigned task directory.

The task mix covers feature implementation, debugging, infrastructure,
maintenance, technical writing, planning, creative writing, social media,
incident analysis, general operations, and three frontend builds with different
visual styles. Model-facing instructions live in each task's `TASK.md`.
Evaluation results will be written after both queues finish.

## Cloud runs: Sonnet 5.5, Opus 5.5, Fable 5.1 (2026-09-30)

Each model runs in its own private repository that holds only the thirteen
tasks from `_templates/`, with no history, so it never sees another model's
answers, this rubric or the grading tests:

| Model | Repository |
|---|---|
| Sonnet 5.5 (`claude-sonnet-5-5`) | `c0ze/agent-eval-sonnet-5.5` |
| Opus 5.5 (`claude-opus-5-5`) | `c0ze/agent-eval-opus-5.5` |
| Fable 5.1 (`claude-fable-5-1`) | `c0ze/agent-eval-fable-5.1` |

As with mimo and muse (one fresh `--pure` request per task, see
`evaluation/run-logs/`), every task runs with a fresh context: the session
orchestrates and hands each task to its own subagent on the same model, and
writes `RUN_LOG.md` without judging or touching the work.

Scoring, after the runs are pushed:

1. Copy each run's task directories into `sonnet-5.5/`, `opus-5.5/` and
   `fable-5.1/` here, and its `RUN_LOG.md` into `evaluation/`.
2. `python3 evaluation/test_code_tasks.py <dir>` for tasks 01 and 02.
3. Screenshot tasks 11-13 at desktop and 390 px into `evaluation/screenshots/`.
4. Score against `evaluation/RUBRIC.md`.
