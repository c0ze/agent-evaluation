#!/usr/bin/env python3
"""RUN_LOG.md for the muse-wonder-full run, from times.log, runs/*.reply.md, usage.json, usage.log and audit.txt.
Run usage.py and audit.py first."""
import json, re
from datetime import datetime
from pathlib import Path

O = Path(__file__).resolve().parent
R = O.parent / "agent-eval-muse-wonder-full"
T = "%Y-%m-%d %H:%M:%S"
TASKS = sorted(p.name for p in R.glob("[01][0-9]-*"))

times = {}
for line in (O / "times.log").read_text().splitlines():
    if m := re.match(r"(\d\d-\S+) (start|end) (\S+ \S+)(?: rc=(\d+) secs=(\d+))?", line):
        t, what, when, rc, secs = m.groups()
        if what == "start": times[t] = {"start": datetime.strptime(when, T)}
        else: times[t] |= {"end": datetime.strptime(when, T), "rc": int(rc), "secs": int(secs)}
U = json.loads((O / "usage.json").read_text())
usage = {r["task"]: r for r in U["tasks"]}; tot = U["totals_graded_runs"]
q = [l.split() for l in (O / "usage.log").read_text().splitlines() if " short " in l]
qb, qa = json.loads((O / "quota-before.json").read_text()), json.loads((O / "quota-after.json").read_text())
fmt = lambda n: f"{n:,}"
mmss = lambda s: f"{s // 60}m{s % 60:02d}s"
hm = lambda d: d.strftime("%H:%M:%S")
reply = lambda t: " ".join((O / "runs" / f"{t}.reply.md").read_text().split()).replace("|", "\\|")
start, end = min(x["start"] for x in times.values()), max(x["end"] for x in times.values())
wall = int((end - start).total_seconds()); summed = sum(x["secs"] for x in times.values())

md = [
 "# Run log", "",
 "- **Model under test:** muse-wonder-full (`muse-wonder-full-1.0`, Muse Code 1.4.10-R6427.1), reasoning effort **xhigh**",
 f"- **Date:** 2026-10-17, {hm(start)}–{hm(end)} JST",
 "- **Orchestrator:** Claude Opus 5.5 in Claude Code, `muse exec` on cachyos (Linux)", "",
 "## How it was run", "",
 "Each of the 13 tasks went to muse as its own `muse exec` run, so every task started with a fresh context. Each run carried the same "
 "instruction the other runs gave, with only the task directory filled in. The command was the one used for muse-wonder on the Mac, "
 "with the new model id: `muse exec --model muse-wonder-full-1.0 --reasoning-effort xhigh --workspace <this repo> --trust-workspace "
 "--no-foreign-personal-context --max-model-steps 200 --disable-approval --disable-sandbox <instruction>`, with a 2-hour limit per task. "
 "This repository held only the thirteen tasks and no history. Two tasks ran at a time, taken in order from a shared queue.", "",
 "**Blank slate.** Linux has no Seatbelt, so bubblewrap took the place of the Mac run's outer sandbox. Each task ran with its own clean "
 "HOME (its own config and session store, so no user skills, rules or earlier Muse sessions, and no other task's sessions; only Muse's "
 "built-in skills loaded) and a scrubbed environment. /home, /tmp, /run/user, /mnt, /srv and /var/tmp were empty inside the sandbox "
 "except for this repository, the task's HOME, the pinned muse binary and Node. The repository and the task's HOME were the only "
 "writable places. Network was shared, since the Meta API needs HTTPS. Muse's own shell sandbox was off (`--disable-sandbox`), as on the "
 "Mac. The API key was read outside the sandbox and piped on stdin (`--api-key-stdin`), so it was not in the agent's environment or "
 "files. A muse-wonder-full session checked this from inside before the run.", "",
 "**Audit.** Every tool call in the session logs was listed (`audit.py`). No command used the network or touched another task "
 "directory. Task 04 listed `~/.local/share/mise/installs` looking for other Python versions (only Node is visible there in the "
 "sandbox). Tasks 12 and 13 each wrote a throwaway test script to `/tmp`, which in the sandbox is an empty tmpfs discarded after the run.", "",
 "**Quota.** A watcher read the subscription's 5-hour and weekly windows every two minutes (`usage.log`); no new task would have started "
 "with the 5-hour window at 50% or more or the weekly at 85% or more. Neither limit was reached, so the run fitted in one 5-hour window.", "",
 "The orchestrator gave no hints and did not review, fix, finish or re-run any work. After the run, `git status` showed changes only "
 "inside the thirteen task directories.", "",
 "Usage comes from muse's session logs: every `model_completed` event's token counts, counted once. Each task also ran two short "
 "helper calls (Muse's status-line reminders, separate sessions) on `muse-spark-1.3`; they are counted with their task.", "",
 "## Results", "",
 "Every reply identified the model as muse-wonder-full-1.0, and every main-session model call in the logs records `muse-wonder-full-1.0`. "
 "Summaries are muse's own replies, verbatim; they have not been verified.", "",
 "| Task | Status | Time (JST) | Model steps | Tokens: input / cached / output / reasoning | muse's reply |", "|---|---|---|---|---|---|",
]
for t in TASKS:
    u, x = usage[t], times[t]
    md.append(f"| {t} | {'completed' if x['rc'] == 0 else 'rc=' + str(x['rc'])} | {hm(x['start'])}–{hm(x['end'])} ({mmss(x['secs'])}) | {u['steps']} | "
              f"{fmt(u['input_tokens'])} / {fmt(u['cached_tokens'])} / {fmt(u['output_tokens'])} / {fmt(u['reasoning_tokens'])} | {reply(t)} |")
md += ["", "## Totals", "",
 f"- Completed: {sum(times[t]['rc'] == 0 for t in TASKS)} of 13.",
 f"- Time: {mmss(wall)} on the clock, two at a time ({mmss(summed)} summed). Model time summed over sessions: {tot['model_ms'] / 60000:.1f} min.",
 f"- Tokens: {fmt(tot['input_tokens'])} input ({fmt(tot['cached_tokens'])} cached), {fmt(tot['output_tokens'])} output, "
 f"{fmt(tot['reasoning_tokens'])} reasoning; {tot['steps']} model steps ({tot['helper_steps']} of them helper calls on muse-spark-1.3).",
 f"- Quota: 5-hour window {qb['short_percent']:.0f}% -> {qa['short_percent']:.0f}% used, weekly {qb['percent']:.0f}% -> {qa['percent']:.0f}% "
 f"(readings every two minutes in `usage.log`; the sandbox probe before the run used under 1%).", ""]
(R / "RUN_LOG.md").write_text("\n".join(md))
print("\n".join(md[-6:]))
