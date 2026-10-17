# Agent evaluation: 25 models (26 entries), 13 tasks

**Results site: https://c0ze.github.io/agent-evaluation/**

Twenty-five models as twenty-six coding agents (model plus harness; HY4 preview ran in two harnesses) each got the same thirteen self-contained
tasks. The tasks cover feature building, bug fixing, infrastructure, project
maintenance, technical writing, product planning, creative writing, social media,
incident analysis, general operations and three frontend builds in different visual
styles. Each output was graded blind against one rubric. The runs took place from
2026-09-23 to 2026-10-17.

| Model | Harness | Effort | Avg / task |
|---|---|---|---|
| Sonnet 5.5 | Claude Code (cloud) | extra | 9.38 |
| Opus 5.5 | Claude Code (cloud) | high | 9.29 |
| Fable 5.1 | Claude Code (cloud) | extra | 9.23 |
| Haiku 5.5 | Claude Code CLI (headless) | xhigh | 8.73 |
| Grok 4.7 | Grok CLI | xhigh | 8.71 |
| GPT-6 Astra | Codex CLI | xhigh | 8.60 |
| muse-wonder-full | Muse Code | xhigh | 8.58 |
| GPT-6.1 Sol | Codex CLI | xhigh | 8.56 |
| HY4 preview | opencode (OpenRouter) | high | 8.25 |
| Qwen 3.8 Max | opencode (OpenRouter) | high* | 8.17 |
| HY4 preview | CodeBuddy (Tencent) | high | 8.13 |
| muse-wonder | Muse Code | xhigh | 8.13 |
| MiniMax M3.1 Flash | mcode | xhigh | 7.92 |
| Step-5 preview | opencode (OpenRouter) | high | 7.73 |
| GLM-5.3 | opencode (OpenRouter) | high | 7.67 |
| muse | tincan | max | 7.58 |
| mimo | tincan | default | 7.58 |
| Kimi K3 | opencode (OpenRouter) | high | 7.31 |
| Gemini 4 Argon | Gemini web chat (no tools)† | High | 7.31 |
| GPT-6 Luna | Codex CLI | max | 7.27 |
| Mistral Large 4 | opencode (OpenRouter) | high* | 6.54 |
| DeepSeek V4 Pro | opencode (OpenRouter) | high | 6.48 |
| Gemini 3.1 Pro | Antigravity CLI (headless) | high | 6.46 |
| Gemini 3.8 Flash | Antigravity CLI (headless) | high | 6.23 |
| MiniMax M3 | mcode | default | 6.08 |
| Nemotron 3 Ultra | opencode (OpenRouter) | high | 4.88 |

\* Qwen 3.8 Max's task 13 and Mistral Large 4's tasks 12–13 ran at reduced reasoning effort after their high-effort
attempts hit opencode's per-response output cap without writing anything. Averages move by up to about ±0.4 between
grading passes, so only tier-level differences are reliable (see the report).

† No API access was available, so Gemini 4 Argon ran in the Gemini web chat: each task's files were pasted into one
message and its reply's files were copied out verbatim. It could not run code, tests or a browser, which every other
entry could.

These scores come from the twenty-six-way blind pass of 2026-10-17, after muse-wonder-full was added. The full write-up, covering what was observed, what was inferred, per-work-type
recommendations and caveats, is in [`evaluation/REPORT.md`](evaluation/REPORT.md). Time, cost and token
usage per run are in [`evaluation/RUN_METRICS.md`](evaluation/RUN_METRICS.md).

## Method

- **Isolation.** Each model worked in its own private repository. That repository
  held only the thirteen task briefs from [`_templates/`](_templates), with no
  history, so no model could see another model's answers, the rubric or the hidden
  tests.
- **Fresh context per task.** Every task ran in a fresh session or subagent. The
  orchestrating session wrote `RUN_LOG.md` and never judged or edited the work.
- **Grading.** Code tasks 01 and 02 ran against hidden contract tests
  ([`evaluation/test_code_tasks.py`](evaluation/test_code_tasks.py)). Frontends
  (11–13) were screenshotted at desktop width and at 390 px. All outputs were then
  scored blind against [`evaluation/RUBRIC.md`](evaluation/RUBRIC.md): each task got
  random letters, and names, paths and model IDs were stripped (see
  [`evaluation/tools/blind.py`](evaluation/tools/blind.py)). The blind pass was
  re-run each time a model was added (4-way through 26-way), and every pass is kept
  in `evaluation/scores-*.json`.

## Layout

| Path | Contents |
|---|---|
| `_templates/` | The thirteen task briefs and starter files, as each model received them |
| `<model>/` | Each model's graded output, one directory per task |
| `runs/<model>/` | Each model's original run repository, merged here with its full commit history (see below) |
| `evaluation/` | Rubric, report, run metrics, blind keys and scores, run logs, screenshots, grading tools |
| `evaluation/site/` | The static results site (built by `evaluation/tools/build_site.js`) |
| `_aborted-outside-room/`, `evaluation/interrupted/` | Attempts that were stopped for reasons other than the model, kept for the record |

## Provenance of `runs/`

Each model originally ran in its own private repository (`c0ze/agent-eval-<model>`).
Those repositories are merged into `runs/<model>/` with `git subtree`, so their
commits and timestamps stay intact. The original commits keep their root-level
paths, so `git log -- runs/<model>` shows only the merge commit. To see how a run
unfolded, follow the merge's second parent:

```
git log "$(git log --format=%H -1 -- runs/<model>)^2"
```

Haiku 5.5, the Gemini models, the OpenRouter models, HY4 via CodeBuddy, muse-wonder and muse-wonder-full ran locally rather than from GitHub repositories
(Gemini 4 Argon through the Gemini web chat, its replies written into a local repository):
each run repository (fresh from the templates, outside the home directory) is merged into
`runs/<model>/` the same way.

mimo has no `runs/` entry. It ran through tincan directly inside this repository,
and its logs are in `evaluation/run-logs/`.
