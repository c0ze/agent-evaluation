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
