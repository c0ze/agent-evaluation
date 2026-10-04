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
