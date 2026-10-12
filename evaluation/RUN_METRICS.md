# Cloud run metrics

Times are JST (GMT+9). Each cloud account has its own "Included credit" balance
($250, expires 2026-11-05 16:59 JST). Balances are read from screenshots of the
usage page in `billing/`. The screenshots don't show the account; the account
for each one is as Arda identified it.

- **Account A:** Sonnet 5.5, then Opus 5.5.
- **Account B:** Fable 5.1.

## Runs

| Model | Effort | Account | Started | Finished (push) | Duration | Credit before | Credit after | Cost | Tasks completed | Result branch |
|---|---|---|---|---|---|---|---|---|---|---|
| Sonnet 5.5 | extra | A | ~01:15 | 01:43:38 | ~28 min | $94 | $79 | **$15** | 13 / 13 | `claude/optimistic-dirac-o4m2z9` in `c0ze/agent-eval-sonnet-5.5` |
| Fable 5.1 | extra | B | ~01:17 | 02:05:18 | ~49 min | $79 | $26 | **$53** | 13 / 13 | `claude/funny-turing-1qfdj4` in `c0ze/agent-eval-fable-5.1` |
| Opus 5.5 | high | A | ~01:48 | 02:09:37 | ~21 min | $79 (01:44 reading) | $65 | **$14** | 13 / 13 | `claude/focused-hopper-vexle5` in `c0ze/agent-eval-opus-5.5` |
| muse (muse-spark-1.3) | max | local (tincan on the Mac) | 02:12:21 | 02:32:49 | 20 min 28 s | n/a | n/a | not measurable; see tokens | 13 / 13 | `muse-run` in `c0ze/agent-eval-muse` |
| GPT-6 Luna (`gpt-6-luna`) | max | Codex CLI, gand-business | 03:06:18 | 03:40:28 | 34 min 10 s | n/a | n/a | quota, see below | 13 / 13 | `run` in `c0ze/agent-eval-gpt-6-luna` |
| GPT-6.1 Sol (`gpt-6.1-sol`) | xhigh | Codex CLI, gand-business | 04:06:46 | 04:54:38 | 47 min 52 s | n/a | n/a | quota, see below | 13 / 13 | `run` in `c0ze/agent-eval-gpt-6.1-sol` |
| Grok 4.7 (`grok-4.7`) | xhigh | Grok CLI, grok.com | 04:22:45 | 05:43:00 (12 tasks) | 80 min 15 s for 12 tasks | n/a | n/a | **$6.74** for 12 tasks | 12 / 13 (13 interrupted) | `run` in `c0ze/agent-eval-grok-4.7` |
| GPT-6 Astra (`gpt-6-astra`) | xhigh | Codex CLI, gmail-business then gmail-personal | 03:06:18 (01-09), 05:19:41 (10-13) | 05:39:03 | 34 min 54 s (15:32 + 19:22) | n/a | n/a | quota, see below | 13 / 13 | `run` in `c0ze/agent-eval-gpt-6-astra` |
| MiniMax M3.1 Flash (`MiniMax-M3.1-Flash-Preview`) | xhigh | mcode on the Mac (managed MiniMax login) | 18:20:45 (2026-10-04) | 19:05:06 | 42 min 16 s (28:38 first pass + 13:38 task 11 re-run) | n/a | n/a | not measurable; see tokens | 13 / 13 | `run` in `c0ze/agent-eval-mcode-m3.1-flash` |
| MiniMax M3 (`MiniMax-M3`) | default (not selectable) | mcode on the Mac (managed MiniMax login) | 19:39:03 (2026-10-04) | 19:47:52 | 8 min 49 s | n/a | n/a | 2% of the 5-hour window; see tokens | 13 / 13 | `run` in `c0ze/agent-eval-mcode-m3` |
| Haiku 5.5 (`claude-haiku-5-5`) | xhigh | Claude Code CLI on cachyos (Max subscription) | 14:32:46 (2026-10-11) | 15:06:49 | 34 min 03 s | n/a | n/a | $1.74 API-equivalent; nothing charged | 13 / 13 | local repository, merged under `runs/haiku-5.5` |
| Gemini 3.1 Pro (`gemini-3.1-pro-high`) | high | Antigravity CLI on cachyos (Google account) | 19:30:45 (2026-10-11) | 20:30:09 (task 11 re-run) | 27 min 23 s (17:07 first pass + 10:16 task 11 re-run) | n/a | n/a | not reported; see tokens | 13 / 13 | local repository, merged under `runs/gemini-3.1-pro` |
| Gemini 3.8 Flash (`gemini-3.8-flash-high`) | high | Antigravity CLI on cachyos (Google account) | 19:30:45 (2026-10-11) | 19:53:12 | 22 min 27 s | n/a | n/a | not reported; see tokens | 13 / 13 | local repository, merged under `runs/gemini-3.8-flash` |
| Kimi K3 (`moonshotai/kimi-k3`) | high | opencode on cachyos (OpenRouter) | 22:12:01 (2026-10-11) | 22:25:33 | 13 min 32 s | n/a | n/a | **$3.47** | 13 / 13 | local repository, merged under `runs/kimi-k3` |
| DeepSeek V4 Pro (`deepseek/deepseek-v4-pro-0813`) | high | opencode on cachyos (OpenRouter) | 22:41:15 | 22:53:30 | 12 min 15 s | n/a | n/a | **$0.43** | 13 / 13 | local repository, merged under `runs/deepseek-v4-pro` |
| GLM-5.3 (`z-ai/glm-5.3`) | high | opencode on cachyos (OpenRouter) | 22:41:15 | 23:10:28 | 29 min 13 s | n/a | n/a | **$1.49** | 13 / 13 | local repository, merged under `runs/glm-5.3` |
| Mistral Large 4 (`mistralai/mistral-large-4-0`) | high | opencode on cachyos (OpenRouter) | 22:41:15 | 23:19:13 (re-runs) | 23 min 54 s (16:16 first pass + 7:38 re-runs) | n/a | n/a | **$1.23** | 13 / 13 (12 and 13 at reduced effort, see below) | local repository, merged under `runs/mistral-large-4` |
| Qwen 3.8 Max (`qwen/qwen3.8-max-0902`) | high (13 at medium) | opencode on cachyos (OpenRouter) | 00:03:24 (2026-10-12) | 08:48:04 | ~158 session-minutes (interrupted batch) | n/a | n/a | **$5.44** | 13 / 13 | local repository, merged under `runs/qwen3.8-max` |
| Nemotron 3 Ultra (`nvidia/nemotron-3-ultra-550b-a55b`) | high | opencode on cachyos (OpenRouter) | 00:03:24 (2026-10-12) | 00:10:58 | 7 min 34 s | n/a | n/a | **$0.76** | 13 / 13 | local repository, merged under `runs/nemotron-3-ultra` |
| Step-5 preview (`stepfun/step-5-preview`) | high | opencode on cachyos (OpenRouter) | 00:03:24 (2026-10-12) | 07:41 (task 12 re-run) | ~69 session-minutes (interrupted batch) | n/a | n/a | **$2.21** | 13 / 13 | local repository, merged under `runs/step-5-preview` |
| HY4 preview (`tencent/hy4-preview`) | high | opencode on cachyos (OpenRouter) | 00:03:24 (2026-10-12) | 08:00:46 | ~113 session-minutes (interrupted batch) | n/a | n/a | **$1.57** | 13 / 13 | local repository, merged under `runs/hy4-preview` |
| HY4 preview via CodeBuddy (`hy4-preview`) | high | Tencent CodeBuddy Code on cachyos (user's plan) | 16:58:34 (2026-10-12) | 21:43:36 (re-runs after the rate-limit reset) | ~23 min + 12 min re-runs | n/a | n/a | $0 reported (plan usage) | 13 / 13 | local repository, merged under `runs/hy4-preview-codebuddy` |

Durations are as Arda timed them. The push times agree with them.

## Credit balance readings

| Time | Account | Balance | Context | Screenshot |
|---|---|---|---|---|
| 01:15:30 | A | $94 of $250 | Sonnet starting | `billing/2026-09-30_0115_accountA_sonnet-start_94.png` |
| 01:17:34 | B | $79 of $250 | Fable starting | `billing/2026-09-30_0117_accountB_fable-start_79.png` |
| 01:44:30 | A | $79 of $250 | Sonnet done | `billing/2026-09-30_0144_accountA_sonnet-end_79.png` |
| 02:06:12 | B | $26 of $250 | Fable done | `billing/2026-09-30_0206_accountB_fable-end_26.png` |
| 02:10:23 | A | $65 of $250 | Opus done | `billing/2026-09-30_0210_accountA_opus-end_65.png` |

## Notes

- **Effort is not the same across runs.** Sonnet and Fable ran on extra, Opus
  on high. Opus's time, cost and scores are not like-for-like with the other
  two, and the report must say so.
- The page shows whole dollars, so each cost is accurate to about ±$1.
- Account A's $79 after Sonnet is the same figure as account B's $79 before
  Fable. That's a coincidence of the two balances, not the same reading.
- Opus's "credit before" is the 01:44:30 reading, which Arda confirmed as its
  starting point. No screenshot was taken right before Opus started.
- Opus committed after each task, because a stop hook in its session asked
  for commits; the others committed once at the end. The outputs are unaffected.

## muse run (local, through tincan)

muse's cost can't be read from a balance, so its **token usage** is recorded
instead. It comes from muse's own session logs: every `model_completed`
event's usage, counted once, including muse's built-in reminder helpers.
`muse-run-orch/usage.py` in `~/projects/agent-eval-runs` computes it.

- Command: the `muse` tincan preset unchanged (`muse exec --model muse-spark-1.3
  … --max-model-steps 200 --disable-approval`) plus `--reasoning-effort max`
  (the default is high, which the earlier muse run used). Confirmed on the
  running processes.
- Same protocol as the cloud runs: one fresh, stateless request per task with
  the same instruction, four at a time (listeners `muse-1` to `muse-4`), no
  hints and no re-runs. The room is the repository itself, so muse's workspace
  is the repo. Each task has a 2-hour limit.
- The orchestrator (Claude Opus 5.5 in Claude Code) writes `RUN_LOG.md` from
  muse's replies and the timing log, and commits the branch at the end.

### muse usage (from its session logs)

| | Model steps | Input tokens | of which cached | Output tokens | Reasoning tokens | Model time |
|---|---|---|---|---|---|---|
| **13 tasks** | 172 | 6,200,186 | 5,544,028 | 162,252 | 59,639 | 61.9 min (summed over parallel sessions) |

Per-task figures are in `run-logs/muse-RUN_LOG.md` and `run-logs/muse-orchestration/usage.txt`.

## GPT-6 runs (Codex CLI on the Mac)

Codex subscriptions report quota, not dollars, so usage is recorded as tokens and quota consumed.
Each run used its own account; the accounts' personal `AGENTS.md` was set aside during the runs.

| | Luna (max, gand-business) | Astra (xhigh, gmail-business) |
|---|---|---|
| Tasks | 13 / 13 | 9 / 13, then the account ran out of credits |
| Wall-clock | 34 min 10 s | 15 min 32 s for tasks 01-09; tasks 10-13 to be re-run from the template |
| Input tokens (cached) | 3,475,051 (3,051,008) | 1,950,073 (1,683,456) for 01-09 |
| Output tokens (reasoning) | 219,647 (124,405) | 82,221 (22,285) for 01-09 |
| 5-hour quota used | 97% -> 94% left | 100% -> 0% (blocked) |
| Weekly quota used | 76% -> 75% left | 100% -> 84% left |

On tasks 01-09 the two used about the same number of tokens (Luna about 2.00M input and 99k output),
but Astra's used up a full 5-hour window and 16% of the weekly quota, against about 3% and 1% for
Luna. Astra costs far more quota per token. Timing and the interruption are in
`run-logs/gpt-orchestration/ASTRA_TIMING.md`.

### GPT-6.1 Sol (xhigh, gand-business)

| Tasks | Wall-clock | Input tokens (cached) | Output tokens (reasoning) | 5-hour quota | Weekly quota |
|---|---|---|---|---|---|
| 13 / 13 | 47 min 52 s | 5,847,898 (5,275,520) | 242,799 (75,183) | 81% -> 33% left | 73% -> 66% left |

Codex was updated to 0.159.0 for this run. A duplicate launch at 04:02 ran two copies on the
same repository for about four minutes before both were stopped; the repository was reset and
the clean run above started at 04:06:46. The false start used quota too (94% -> 81% of the
5-hour window). Its output is kept outside the repositories.

### GPT-6 Astra: completed

Tasks 10-13 were re-run from the template on gmail-personal (Arda reset its limit) from 05:19:41 to
05:39:03 (19 min 22 s). Completion time: 15 min 32 s + 19 min 22 s = **34 min 54 s**.

| | Tasks | Input tokens (cached) | Output tokens (reasoning) | Quota used |
|---|---|---|---|---|
| gmail-business | 01-09 | 1,950,073 (1,683,456) | 82,221 (22,285) | full 5-hour window; weekly 100% -> 84% |
| gmail-personal | 10-13 | 1,615,634 (1,402,368) | 102,579 (19,311) | weekly 100% -> 97%; 5-hour still 100% |
| **Total** | 13 | 3,565,707 (3,085,824) | 184,800 (41,596) | |

The same model used far less of gmail-personal's quota for similar token counts, so how "hungry" a
model looks depends on the account's plan as much as on the model.

## Grok 4.7 (Grok CLI on the Mac)

Grok reports cost in dollars per request. Personal context was kept out with a clean temporary HOME
(no ~/.claude/CLAUDE.md, user skills or plugins), GROK_MEMORY=0, MCP tools denied and web tools off;
GROK_HOME stayed ~/.grok for login. Only Grok's 22 bundled skills loaded. Sandbox: `workspace`
(writes limited to the repo and /tmp; the no-network `strict` profile fails on this Mac because
/var/run/docker.sock is a symlink).

| | Turns | Input | Cache-read input | Output (reasoning) | Cost |
|---|---|---|---|---|---|
| Tasks 01-12 | 286 | 1,596,456 | 22,209,536 | 850,540 (675,976) | $6.74 |
| Task 13 (interrupted) | 35 | 399,646 | 3,376,896 | 261,932 (215,011) | $1.43 |

Task 13 stopped after an hour with "402 Payment Required: Grok Build usage balance exhausted",
before writing RESPONSE.md. Its partial output is kept in grok-orchestration; the task was reset to the
template and will be re-run after a top-up (resume-13.sh). Until then Grok's scores cover 12 tasks.

## MiniMax M3.1 Flash (mcode on the Mac, 2026-10-04)

MiniMax Code (`mcode` 0.6.2) with its managed MiniMax login, model `minimax/MiniMax-M3.1-Flash-Preview`,
effort xhigh. Same protocol as the other runs: one fresh `mcode exec` per task with the same instruction,
four queues with the same task split, no hints, on a private repository holding only the thirteen tasks.
Command: `mcode exec --cwd <repo> --model minimax/MiniMax-M3.1-Flash-Preview --effort xhigh --prompt-mode coding
--permission full --max-steps 200 --timeout 2h --output-format json`. Scripts, timing, replies and usage are in
`run-logs/mcode-orchestration/`.

- **Personal context:** mcode refuses a clean HOME (it rejects a symlinked `~/.minimax`, and copying its login
  would disturb the real one), so it ran in the normal HOME. Asked beforehand, it reported no AGENTS.md,
  CLAUDE.md or other personal instruction files in its context; the user's skills from `~/.agents/skills`
  did load, as in the muse run.
- **Interruption:** task 11's first attempt was killed about 15 minutes in by the orchestrator's own
  background-job limit, not by mcode. The other twelve tasks finished in the first pass (18:20:45–18:49:23,
  28 min 38 s). Task 11 was reset to the template and re-run alone with the identical command
  (18:51:28–19:05:06, 13 min 38 s); the killed attempt's output is in `interrupted/mcode-11-frontend-operations-attempt1/`.
  Bench time, as for Astra, is the sum: **42 min 16 s** (44 min 21 s on the clock).

| Tasks | Bench time | Input tokens | Cache-read input | Output tokens | Token Plan quota (5-hour / weekly) |
|---|---|---|---|---|---|
| 13 / 13 | 42 min 16 s | 582,181 | 18,605,981 | 397,831 | 100% -> 100% left / 100% -> 100% left |

Tokens come from each run's own `exec.result` JSON (`usageSource: completed_responses`); the killed task 11
attempt reported none, so its tokens are missing here. The **quota didn't move**: the account's
coding-plan counters (`/v1/api/openplatform/coding_plan/remains`) show no limit (`total_count 0`) and no
usage even after about 19M tokens, so mcode's managed usage is billed somewhere those counters don't
see (mcode also reads a credit balance, from an endpoint that needs its signed client requests).
The run's cost could not be measured; tokens are the record.

The slowest tasks were the frontends: 12 (19 min 22 s, 6.25M cache-read tokens) and 11 (13 min 38 s), while
the writing tasks took 1–7 minutes each.

## MiniMax M3 (mcode on the Mac, 2026-10-04)

Same protocol and command as MiniMax M3.1 Flash above, with `--model minimax/MiniMax-M3` and **no `--effort`**:
mcode rejects it ("MiniMax-M3 does not support reasoning effort selection"), so M3 ran at its fixed default
while M3.1 Flash ran on xhigh. Scripts, timing, replies and usage are in `run-logs/mcode-m3-orchestration/`.

Unlike the M3.1 Flash preview, M3 is billed against the Token Plan: a 15k-token probe before the run moved
both windows from 0% to 1% used. So the run polled the coding-plan windows every 2 minutes (`usage.log`), with
a watcher ready to hold new tasks if either window passed 85%. It never came close.

| Tasks | Wall-clock | Input tokens | Cache-read input | Output tokens | 5-hour window | Weekly window |
|---|---|---|---|---|---|---|
| 13 / 13 | 8 min 49 s | 546,628 | 4,781,334 | 189,837 | 1% -> 3% used | 1% -> 1% used |

The windows only report whole percentages, so the run cost about 2% of a 5-hour window and too little of the
week to register. Readings during the run: 1% (19:39, 19:41), 2% (19:43, 19:45), 3% (19:47) of the 5-hour
window. M3 was much faster and leaner than M3.1 Flash: 8 min 49 s against 42 min 16 s, and 4.8M cache-read
input against 18.6M.

**Process note:** during task 03 (at 19:39:59) MiniMax M3 also wrote a copy of its .env.example to ~/projects/agent-eval-runs/agent-eval-m3/03-infra-management/, a sibling path outside its repository (apparently a mistyped repository name). The file is identical to the .env.example in its task directory, so the deliverable is unaffected, but the brief says to work only in the task directory. The stray copy is kept in mcode-m3-run-orch/stray-write/. Found after the eleven-way grading, so that pass's task 03 grader did not see this note.

**Process note (network and installs):** in task 04 (19:39–19:41) MiniMax M3 used the network and changed the user's Python environment, both against the brief: it pip-installed packages from PyPI into the user site (24 in ~/.local/lib/python3.13/site-packages, including build, twine, keyring, requests, rich, docutils and an editable install of its own slugkit 0.4.0, plus ruff 0.16.10 for Python 3.14), which also added about 15 commands to ~/.local/bin. It used them for the checks its RESPONSE.md reports (ruff, python -m build, twine check, pip install -e .). Found after the eleven-way grading, so the task 04 grader did not see this note. M3.1 Flash's run left no such changes.

## Haiku 5.5 (Claude Code CLI on cachyos, 2026-10-11)

Haiku 5.5 came out after the eleven-way pass. It ran headless through the Claude Code CLI (2.1.296) on
cachyos, signed in with a Claude Max subscription. Each task got one `claude -p` with the same instruction as
the other runs, four at a time, effort **xhigh**: the same setting as "extra" for Sonnet 5.5 and Fable 5.1.
Scripts, timing, per-task event logs and tokens are in `run-logs/haiku-orchestration/`.

- **Blank slate:** a fresh repository made from the same template commit the Sonnet and Opus repositories
  started from, with no history and outside the home directory, so no personal `CLAUDE.md` or memory was
  discovered. `--setting-sources project --strict-mcp-config` kept out user plugins, hooks and MCP servers,
  and the parent session's environment was cleared (`env -i`). Only Claude Code's built-in skills were present.
- **Sandbox:** Bash was allowed without prompts, since headless mode can't answer them, but ran inside
  Claude Code's sandbox: no network, and writes limited to the repository and the session temp area.
  WebFetch and WebSearch were disabled.
- **First launch stopped:** commands starting with an environment-variable prefix were refused by
  unanswerable permission prompts, so the first launch was stopped after about 30 s, reset to the template
  commit and relaunched with the Bash rule above. The partial logs are in `interrupted/haiku-5.5-first-launch/`.

| Tasks | Wall-clock | Input | Cache write | Cache read | Output tokens | API-equivalent cost |
|---|---|---|---|---|---|---|
| 13 / 13 | 34 min 03 s (14:32:46–15:06:49) | 444 | 996,904 | 17,666,356 | 844,002 | $1.74 |

Tokens and cost are Claude Code's own per-model totals (`modelUsage`) from each session's final `result`
event. The account is a subscription, so the $1.74 is what Claude Code says the tokens would cost at API
prices, not a charge. It isn't comparable with the cloud runs' balance readings. Task 11 took 24 min 26 s of
the wall-clock time (5.38M cache-read tokens) testing its page in headless Firefox. Every other task finished
in 1.5–12 minutes.

**Process note:** according to the session transcripts, tasks 03, 11, 12 and 13 wrote scratch files
(validation copies, screenshots, Firefox profiles) to the session temp directory outside the repository,
and task 11 ran a `find` over `~/Downloads` looking for its own headless-Firefox output. No task read another
task's directory or any other model's output. These are scratch-space uses of the kind the Claude cloud runs
also reported, not deliverables written outside the task directory, so they were not passed to the graders.

## Gemini 3.1 Pro and Gemini 3.8 Flash (Antigravity CLI on cachyos, 2026-10-11)

Both models ran headless through the Antigravity CLI (`agy` 1.3.3) on cachyos, signed in with the user's
Google account. Each task got one `agy -p` with the same instruction as the other runs, four at a time per
model, with both models running at once. Settings were "high": agy's High variants (`gemini-3.1-pro-high`,
`gemini-3.8-flash-high`) plus `--effort high`. Scripts, timing, per-task event logs and tokens are in
`run-logs/gemini-orchestration/`.

- **Blank slate:** each model got a fresh repository made from the same template commit as the others, with
  no history and outside the home directory. Each *task* ran with its own empty `HOME`, holding only a link
  to the agy sign-in token and a settings file. agy otherwise keeps rules, knowledge items, implicit memory,
  conversation summaries, user skills and an MCP server (tincan) under `~/.gemini`, so none of those
  reached the models, and tasks couldn't see each other's sessions. Only agy's two built-in skills were present.
- **Sandbox:** `enableTerminalSandbox: true` with `toolPermission: proceed-in-sandbox`, file access allowed in
  the repository, and `read_url(*)` and `execute_url(*)` denied. In agy's sandbox, terminal commands have no
  network and can write only to the workspace and temp directories. A smoke test confirmed the network was
  blocked; `--dangerously-skip-permissions` was not used, since in testing it left the network open.

| Model | Tasks | Wall-clock | Input tokens | Cache-read input | Output tokens | of which thinking | Tool calls |
|---|---|---|---|---|---|---|---|
| Gemini 3.1 Pro | 13 / 13 | 27 min 23 s (17:07 first pass + 10:16 task 11 re-run) | 1,562,838 | 7,447,373 | 530,058 | 317,467 | 196 |
| Gemini 3.8 Flash | 13 / 13 | 22 min 27 s (19:30:45–19:53:12) | 2,347,685 | 16,068,920 | 511,996 | 288,652 | 314 |

Tokens come from each session's final `result` event. They cover the graded sessions, so for Gemini 3.1 Pro they
include task 11's re-run, not its cut-off first attempt.

**Gemini 3.1 Pro, task 11 re-run:** the first attempt (19:38:53–19:44:00) was ended by agy, not the model.
The model tried to read `/usr/bin/google-chrome-stable`, outside the workspace, to set up a browser check.
Headless agy can't prompt for that permission, so it auto-denied it and ended the session with an empty
reply. That left no `RESPONSE.md`; stderr reads "no output produced — a tool required the "read_file"
permission that headless mode cannot prompt for". As with Astra's tasks 10–13 and M3.1 Flash's task 11, the
task was reset to the template and re-run once, alone, with the identical command (20:19:53–20:30:09). The
cut-off attempt is in `interrupted/gemini-3.1-pro-11-attempt1/`. It was found after the fourteen-way grading,
so task 11 was re-graded on its own by a fresh blind grader with new letters (see REPORT.md).

**No browser for self-checks:** agy's sandbox blocks headless Chrome (it can't reach the real binary behind
the `/usr/bin` wrapper) and headless Firefox ("CanCreateUserNamespace() clone() failure: ENOSYS"). So the
Gemini models mostly couldn't screenshot their own pages; Flash's task 11 managed some Firefox screenshots
after many attempts. Haiku's sandbox allowed headless Firefox. This is a harness difference, not a model one. agy reports no cost and the account shows no
per-run usage, so tokens are the record. Gemini 3.8 Flash's task 11 took 14 min 33 s testing its page in
headless Firefox; every other task finished in 2–8 minutes.

**Process note:** according to the session transcripts, Gemini 3.8 Flash's tasks 07, 11 and 13 wrote
scratch files (a word-count copy of the story, test pages, screenshots) to `/tmp`. Gemini 3.1 Pro did no
work outside its task directories. No task read another task's directory or any other model's output.

**Objective-check note:** both models' task-04 suites import the third-party `packaging` module. It isn't
installed on cachyos, so their own task-04 results were taken in a scratch venv with `packaging` added.
As a control, muse and MiniMax M3 give the same results there as they did on the Mac.

## OpenRouter runs: Kimi K3, DeepSeek V4 Pro, GLM-5.3, Mistral Large 4 (opencode on cachyos, 2026-10-11)

These four ran through opencode 1.18.30 (headless `opencode run`) on cachyos, using the user's OpenRouter
credit. Each task got one session with the same instruction as the other runs, four at a time per model,
on reasoning variant **high**. Kimi K3 ran alone first; the other three then ran at the same time. Scripts,
timing, per-task event logs, tokens and cost are in `run-logs/openrouter-orchestration/`.

- **Blank slate:** each model got a fresh repository from the same template commit, with no history and
  outside the home directory. Each task ran with its own empty `HOME` and XDG directories containing only
  an opencode config, with `--pure` and `OPENCODE_DISABLE_CLAUDE_CODE=1`. So no `AGENTS.md`/`CLAUDE.md`,
  skills, plugins, MCP servers or session history were present.
- **No OS sandbox:** unlike the Claude and agy runs, opencode has none. Permission rules stood in for it:
  web fetch and search denied, paths outside the repository denied (a denied call returns an error and the
  session continues), and `curl`, `wget`, `pip`/`npm install`, `npx`, `git clone` and `ssh` denied. The
  transcripts were audited afterwards: no session used the network or installed anything, none read
  another task's directory, and scratch files went only to opencode's own `/tmp/opencode`. Unlike under
  agy's sandbox, headless Firefox worked, and Kimi and GLM screenshotted their own pages.
- **Budget guard:** a task would not start if the credit left was below a margin. It never triggered.
- **Mistral Large 4** isn't in opencode's model catalog, so the run config registered it with reasoning on
  and a `high` variant sending reasoning effort high. A smoke test confirmed it reasons and calls tools.
  opencode's default small model (used for session titles) was pointed at the model under test for these
  three runs. For Kimi it was left at its default, a separate small model; that cost a few cents and
  touched no task output.

| Model | Wall-clock | Input | Cache-read input | Output | Reasoning | Tool calls | Cost |
|---|---|---|---|---|---|---|---|
| Kimi K3 | 13 min 32 s | 337,490 | 3,206,424 | 99,658 | 44,123 | 215 | $3.47 |
| DeepSeek V4 Pro | 12 min 15 s | 250,938 | 1,505,467 | 72,180 | 44,828 | 137 | $0.43 |
| GLM-5.3 | 29 min 13 s | 230,495 | 3,982,176 | 88,151 | 178,169 | 202 | $1.49 |
| Mistral Large 4 | 23 min 54 s (incl. re-runs) | 543,871 | 906,840 | 76,035 | 94,593 | 142 | $0.79 |

Cost is opencode's per-step total, from OpenRouter's reported cost; it covers the graded sessions. The
account's credit went from $18.68 to $11.01 across all four runs ($7.67). The difference covers Kimi's
title-model calls, Mistral's two cut-off first attempts and the orchestrator's smoke tests.

**Mistral Large 4, tasks 12 and 13:** in both first attempts the last response spent 27–28k tokens
reasoning plus 4–5k writing, and hit opencode's fixed 32,000-token cap per response (finish reason
`length`). opencode then ended the session before any file was written. As with the other harness-ended
attempts, both were re-run once, from untouched template copies, with the identical command. Both re-runs
hit the same cap the same way. Later, at the user's request, the two tasks were re-run at reduced reasoning effort:
task 12 at medium (completed), and task 13 at medium (capped again) then low (completed). The graded submissions are
those reduced-effort runs, and the graders were told so in a process note.
Task 13's first re-run attempt failed to start (opencode errored creating its local database, before any
model call) and was retried automatically. The cut-off attempts are kept as `*.attempt1.*` in the run logs.

**Objective-check note:** Kimi's and Mistral's task-04 suites import `packaging`, so their own task-04
results were taken in the scratch venv with it, as for the Gemini models.

## OpenRouter batch 3: Qwen 3.8 Max, Nemotron 3 Ultra, Step-5 preview, HY4 preview (2026-10-12)

Same harness and protocol as the earlier OpenRouter runs: opencode, one fresh session and empty HOME per task,
reasoning variant **high**, and permission rules plus a transcript audit instead of an OS sandbox. Step-5
preview isn't in opencode's catalog, so it was registered in the run config, like Mistral Large 4. Nemotron
used OpenRouter's paid endpoint, not the rate-limited `:free` one. All four started together at 00:03:24 JST.

The batch didn't run cleanly. These interruptions had nothing to do with the models:

1. **/tmp filled up (00:15).** opencode installs its plugin SDK with npm into every fresh HOME (about 160 MB
   each). With 16 sessions at once plus the earlier runs' leftover HOMEs, the 16 GB tmpfs ran out. Sessions
   running or starting then failed with opencode database and write errors. Nemotron had already finished.
   The batch was stopped, space freed, and the 21 affected tasks were reset to the template and re-run with
   the identical command, four at a time. Their logs are kept as `*.diskfull.*`. The re-run script now deletes
   each HOME's npm cache once its task ends.
2. **Credit ran out (about 00:53).** Qwen 3.8 Max's frontend tasks were far more expensive than estimated (up
   to $1.68 each, running 20–44 min). The budget guard (no new task below $3 of credit) held HY4's eight
   remaining tasks. Two running sessions, Qwen 13 and Step-5 12, were cut off by OpenRouter's credit check
   (HTTP 402). After the user topped up $10, those two were reset and re-run (`*.credit402.*`) and HY4's
   eight ran.
3. **Qwen 3.8 Max, task 13** then hit opencode's 32,000-token per-response cap: all 32k tokens went to
   reasoning, with no output. It hit it again on its one identical re-run. At the user's request it was
   re-run at reasoning effort medium, which completed. The graders were told so in a process note.

| Model | Session time (sum) | Input | Cache-read input | Output | Reasoning | Tool calls | Cost (graded sessions) |
|---|---|---|---|---|---|---|---|
| Qwen 3.8 Max | 158 min | 618,102 | 7,893,504 | 160,172 | 212,311 | 315 | $5.44 |
| Nemotron 3 Ultra | 27 min (7 min 34 s wall) | 525,229 | 1,655,040 | 93,155 | 11,402 | 154 | $0.76 |
| Step-5 preview | 69 min | 939,358 | 8,890,368 | 161,247 | 145,456 | 322 | $2.21 |
| HY4 preview | 113 min | 634,518 | 9,179,968 | 174,790 | 137,373 | 312 | $1.57 |

Session time is the sum of each task's session lengths, because the interruptions make wall-clock time
meaningless here. The account spent $14.75 on the whole batch, from $10.92 plus the $10 top-up down to $6.17.
That includes the sessions lost to the full disk and the credit cutoff, Mistral's reduced-effort re-runs
and smoke tests.

**Process notes:**
- Nemotron 3 Ultra tried `pip install ruff` and `pip install -e .` in task 04. The permission rules blocked
  both, and the graders saw a process note.
- The other models' denied calls were attempts to create, read or clean up scratch files (screenshots, test
  copies, a Firefox profile) outside the repository. None tried to use the network.

## HY4 preview through Tencent CodeBuddy Code (2026-10-12)

HY4 preview also ran in its vendor's own CLI, CodeBuddy Code 2.164.0, headless (`codebuddy -p`), on the user's
CodeBuddy account. This is for comparison with the OpenRouter/opencode run of the same model, so it's
listed as a separate entry. One session per task with the same instruction, four at a time, effort `high`.
Scripts, timing, event logs and tokens are in `run-logs/codebuddy-orchestration/`.

- **Isolation:** a fresh repository outside the home directory. CodeBuddy's sign-in only works with the
  user's real HOME (a clean HOME, even with the auth folders linked, failed with "Authentication
  required"). So HOME stayed real and the rest was turned off: user settings (plugins, hooks), MCP servers,
  session persistence and auto-memory. A smoke test reported no instruction files, memories, plugins or
  MCP tools, only one built-in skill. CodeBuddy created a per-session tool-output cache under
  `~/.codebuddy/projects/` but no memory files.
- **No sandbox:** CodeBuddy ignores Claude Code's sandbox settings (network and outside writes stayed
  open in testing), and its own `--sandbox container` needs Docker, which isn't available here.
  Permission rules denied `curl`, `wget`, `pip`/`npm install`, `npx`, `uv pip`/`uv add`, `git clone`, `ssh`
  and the web tools; tested, they also catch these inside compound commands. The transcript audit found
  no network attempts. Tasks 05, 11 and 13 wrote scratch test files under `/tmp`.
- **Rate limit:** at 17:21:31 the two still-running sessions, tasks 11 and 13, were stopped by the plan's
  limit ("429 usage exceeds frequency limit … reset at 2026-10-12 20:29:30 UTC+8"). Both were reset to the
  template and re-run with the identical command after the reset. The cut-off attempts are kept as
  `*.quota429.*`.

| Tasks | Session time (sum) | Input (incl. cache reads) | Cache reads | Output | Turns | Cost |
|---|---|---|---|---|---|---|
| 13 / 13 | 66 min | 10,089,458 | 9,410,432 | 231,461 | 724 | $0 reported |
