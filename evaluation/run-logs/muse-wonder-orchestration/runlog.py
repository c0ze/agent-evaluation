#!/usr/bin/env python3
"""RUN_LOG.md for the muse-wonder run, from times.log (both passes), runs/*.reply.md, usage.json and the quota
readings. Run usage.py first."""
import json, re
from datetime import datetime
from pathlib import Path

O = Path(__file__).resolve().parent
R = O.parent / "agent-eval-muse-wonder"
T = "%Y-%m-%d %H:%M:%S"
TASKS = sorted(p.name for p in R.glob("[01][0-9]-*"))

times = {}  # the last start/end per task: the graded run
for line in (O / "times.log").read_text().splitlines():
    if m := re.match(r"(\d\d-\S+) (start|end) (\S+ \S+)(?: rc=(\d+) secs=(\d+))?", line):
        t, what, when, rc, secs = m.groups()
        if what == "start": times[t] = {"start": datetime.strptime(when, T)}
        else: times[t] |= {"end": datetime.strptime(when, T), "rc": int(rc), "secs": int(secs)}
usage = {r["task"]: r for r in json.loads((O / "usage.json").read_text())["tasks"]}
U = json.loads((O / "usage.json").read_text())
graded, total = U["totals_graded_runs"], U["totals_including_stopped_attempts"]
fmt = lambda n: f"{n:,}"
mmss = lambda s: f"{s // 60}m{s % 60:02d}s"
hm = lambda d: d.strftime("%H:%M:%S")
reply = lambda t: " ".join((O / "runs" / f"{t}.reply.md").read_text().split()).replace("|", "\\|")
pass1 = [t for t in TASKS if t < "10"]; pass2 = [t for t in TASKS if t >= "10"]
p1 = sum(times[t]["secs"] for t in pass1); p1_wall = (max(times[t]["end"] for t in pass1) - min(times[t]["start"] for t in pass1)).seconds
p2 = sum(times[t]["secs"] for t in pass2); p2_wall = (max(times[t]["end"] for t in pass2) - min(times[t]["start"] for t in pass2)).seconds

md = [
 "# Run log", "",
 "- **Model under test:** muse-wonder (`muse-wonder-1.0`, Muse Code 1.4.6-R6000.1), reasoning effort **xhigh**",
 f"- **Date:** 2026-10-13. Tasks 01-09: {hm(min(times[t]['start'] for t in pass1))}–{hm(max(times[t]['end'] for t in pass1))} JST. "
 f"Tasks 10-13: {hm(min(times[t]['start'] for t in pass2))}–{hm(max(times[t]['end'] for t in pass2))} JST, one at a time.",
 "- **Orchestrator:** Claude Opus 5.5 in Claude Code, `muse exec` on the Mac", "",
 "## How it was run", "",
 "Each of the 13 tasks went to muse as its own `muse exec` run, so every task started with a fresh context. Each run carried the same "
 "instruction the other runs gave, with only the task directory filled in. The command was `muse exec --model muse-wonder-1.0 "
 "--reasoning-effort xhigh --workspace <this repo> --trust-workspace --no-foreign-personal-context --max-model-steps 200 "
 "--disable-approval --disable-sandbox <instruction>`, with a 2-hour limit per task. This repository held only the thirteen tasks and no history.", "",
 "**Blank slate.** muse ran with a clean HOME (its own config and session store, no user skills, rules or earlier Muse sessions; only "
 "Muse's built-in skills loaded) inside a macOS Seatbelt sandbox that denied reads of everything under the user's home directory except "
 "this repository, the muse binary, Node and what the keychain lookup needs; denied writes outside this repository and the clean HOME; "
 "and allowed outbound network only to HTTPS (the Meta API), DNS and localhost. Seatbelt sandboxes can't nest, so muse's own shell "
 "sandbox was replaced by this outer one (`--disable-sandbox`). The API key was piped from the keychain on stdin (`--api-key-stdin`), "
 "so it was not in the agent's environment. All of this was checked from inside a muse-wonder session before the run.", "",
 "**Quota interruption.** Tasks 01-09 ran four at a time, as in the other runs. At 07:16:51 the subscription's 5-hour window ran out "
 "(`429 Subscription quota exhausted`) just as tasks 10-13 started; they had written at most one partial file each. Their partial output "
 "is kept in `muse-wonder-run-orch/interrupted/`, and the four tasks were reset to the template. Muse then announced a fix for quota "
 "draining too fast and reset all quotas (both windows read 0% at 09:46). Tasks 10-13 were re-run from the template with the identical "
 "command, one at a time at Arda's request, each started only with at least 55% of the 5-hour window left.", "",
 "The orchestrator gave no hints and did not review, fix, finish or re-run any work beyond that reset. After the run, `git status` showed "
 "changes only inside the thirteen task directories.", "",
 "Usage comes from muse's own session logs: every `model_completed` event's token counts, counted once, including Muse's reminder "
 "helpers (separate sessions in this version). Quota is the subscription's 5-hour and weekly windows, read with `muse-quota` before and "
 "after each pass and around each task in pass 2.", "",
 "## Results", "",
 "Every reply identified the model as muse-wonder-1.0, and every model call in the session logs records `muse-wonder-1.0`. "
 "Summaries are muse's own replies, verbatim; they have not been verified.", "",
 "| Task | Status | Time (JST) | Model steps | Tokens: input / cached / output / reasoning | muse's reply |", "|---|---|---|---|---|---|",
]
for t in TASKS:
    u, x = usage[t], times[t]
    md.append(f"| {t} | {'completed' if x['rc'] == 0 else 'rc=' + str(x['rc'])} | {hm(x['start'])}–{hm(x['end'])} ({mmss(x['secs'])}) | {u['steps']} | "
              f"{fmt(u['input_tokens'])} / {fmt(u['cached_tokens'])} / {fmt(u['output_tokens'])} / {fmt(u['reasoning_tokens'])} | {reply(t)} |")
md += ["", "## Totals", "",
 f"- Completed: {sum(times[t]['rc'] == 0 for t in TASKS)} of 13.",
 f"- Time: tasks 01-09 {mmss(p1_wall)} on the clock (four at a time; {mmss(p1)} summed); tasks 10-13 {mmss(p2_wall)} one at a time "
 f"({mmss(p2)} summed). Model time summed over sessions: {graded['model_ms'] / 60000:.1f} min.",
 f"- Tokens for the thirteen graded runs: {fmt(graded['input_tokens'])} input ({fmt(graded['cached_tokens'])} cached), "
 f"{fmt(graded['output_tokens'])} output, {fmt(graded['reasoning_tokens'])} reasoning; {graded['steps']} model steps.",
 f"- The four quota-stopped attempts of tasks 10-13 used another {fmt(total['input_tokens'] - graded['input_tokens'])} input and "
 f"{fmt(total['output_tokens'] - graded['output_tokens'])} output tokens.",
 "- Quota, before Muse's fix: tasks 01-09 plus the four stopped starts took the 5-hour window from 26% used to exhausted in about five "
 "minutes (26% at 07:11:57, 53% at 07:13:59, 84% at 07:16:01, 429 at 07:16:51) and the weekly window from 8% to 33%.",
 "- Quota, after the fix (tasks 10-13, one at a time): 5-hour window 0% -> 34% used, weekly 0% -> 11% "
 "(per task, 5-hour/weekly points: 10 +5/+1, 11 +11/+4, 12 +10/+3, 13 +8/+3).", ""]
(R / "RUN_LOG.md").write_text("\n".join(md))
print("\n".join(md[-8:]))
