#!/usr/bin/env python3
"""Usage totals and RUN_LOG.md for the mcode run, from times.log, each task's exec.result JSON
(--output-format json) and the before/after quota readings. Writes usage.json, usage.txt and the
run repo's RUN_LOG.md."""
import json, re
from datetime import datetime
from pathlib import Path

O = Path(__file__).resolve().parent
R = O.parent / "agent-eval-mcode-m3"
TASKS = sorted(p.name for p in R.glob("[01][0-9]-*"))
T = "%Y-%m-%d %H:%M:%S"

times = {}
for line in (O / "times.log").read_text().splitlines():
    if m := re.match(r"(\S+) (start|end) (\S+ \S+)(?: rc=(\d+) secs=(\d+))?", line):
        t, what, when, rc, secs = m.groups()
        times.setdefault(t, {})[what] = datetime.strptime(when, T)
        if rc is not None: times[t] |= {"rc": int(rc), "secs": int(secs)}
run = {k: datetime.strptime(m.group(1), T) for k in ("START", "END")
       if (m := re.search(rf"RUN {k} (\S+ \S+)", (O / "times.log").read_text()))}

def clean_reply(text):
    text = re.sub(r"<deliver-assets>.*?</deliver-assets>", "", text, flags=re.S)
    return " ".join(text.split()).replace("|", "\\|")

rows, tot = [], {"inputTokens": 0, "cacheReadTokens": 0, "outputTokens": 0, "totalTokens": 0}
for t in TASKS:
    ev = O / "runs" / f"{t}.events.json"
    try: d = json.loads(ev.read_text())
    except (OSError, ValueError): d = {}
    u = d.get("usage") or {}
    for k in tot: tot[k] += u.get(k, 0)
    reply = O / "runs" / f"{t}.reply.md"
    rows.append({"task": t, "status": d.get("status", "no result"), "rc": times.get(t, {}).get("rc"),
                 "start": times.get(t, {}).get("start"), "end": times.get(t, {}).get("end"),
                 "secs": times.get(t, {}).get("secs"), "model": (d.get("model") or {}).get("modelId"),
                 "session": d.get("sessionId"), "usage": u, "incomplete": d.get("usageIncomplete"),
                 "reply": clean_reply(reply.read_text()) if reply.exists() else "(no reply)"})

def q(name):
    try: return json.loads((O / f"quota-{name}.json").read_text())
    except (OSError, ValueError): return {}
qb, qa = q("before"), q("after")
elapsed = int((run["END"] - run["START"]).total_seconds()) if {"START", "END"} <= run.keys() else None
wall = elapsed
mmss = lambda s: f"{s // 60} min {s % 60:02d} s" if s is not None else "?"
fmt = lambda n: f"{n:,}"

(O / "usage.json").write_text(json.dumps({"tasks": rows, "totals": tot, "wall_seconds": wall,
    "quota_before": qb, "quota_after": qa}, indent=1, default=str))
lines = [f"{r['task']:24} {r['status']:9} {mmss(r['secs']):>13}  in {fmt(r['usage'].get('inputTokens', 0)):>9}"
         f"  cache {fmt(r['usage'].get('cacheReadTokens', 0)):>10}  out {fmt(r['usage'].get('outputTokens', 0)):>8}" for r in rows]
lines.append(f"{'TOTAL':24} {'':9} {mmss(wall):>13}  in {fmt(tot['inputTokens']):>9}  cache {fmt(tot['cacheReadTokens']):>10}  out {fmt(tot['outputTokens']):>8}")
(O / "usage.txt").write_text("\n".join(lines) + "\n")

def pct(d, k): return f"{100 - d[k]:.0f}% left" if isinstance(d.get(k), (int, float)) else "?"
hm = lambda dt: dt.strftime("%H:%M:%S") if dt else "?"
done = sum(r["status"] == "succeeded" for r in rows)
md = [
    "# Run log", "",
    "- **Model under test:** MiniMax M3 (`minimax/MiniMax-M3`, MiniMax Code / mcode 0.6.2), reasoning effort **default** (mcode: M3 does not support effort selection)",
    f"- **Date:** {run['START']:%Y-%m-%d}, {hm(run.get('START'))}–{hm(run.get('END'))} JST ({mmss(wall)})" if run.get("START") else "- **Date:** ?",
    "- **Orchestrator:** Claude Opus 5.5 in Claude Code, `mcode exec` on the Mac", "",
    "## How it was run", "",
    "Each of the 13 tasks went to mcode as its own `mcode exec` run, so every task started with a fresh context. "
    "Each run carried the same instruction the other runs gave, with only the task directory filled in. Four queues ran at a time, "
    "with the same task split as the earlier runs. The command was `mcode exec --cwd <this repo> --model minimax/MiniMax-M3 "
    "--prompt-mode coding --permission full --max-steps 200 --timeout 2h --output-format json`, the prompt on stdin. "
    "This repository held only the thirteen tasks and no history, so no other model's answers were visible.", "",
    "mcode cannot run under a clean HOME (it refuses a symlinked `~/.minimax`, and copying its login would disturb it), so it ran in the "
    "user's normal HOME. Asked beforehand, mcode reported no AGENTS.md, CLAUDE.md or other personal instruction files in its context; "
    "it did load the user's skills from `~/.agents/skills`, as the muse run did.", "",
    "The orchestrator gave no hints and did not review, fix, finish or re-run any work.", "",
    "Usage comes from each run's own `exec.result` JSON (`usageSource: completed_responses`). Quota is the MiniMax Token Plan's "
    "5-hour and weekly windows, read from the coding-plan endpoint right before the first task and right after the last, and "
    "every 2 minutes during the run (`usage.log`); a watcher would have held new tasks past 85% of either window. It never did.", "",
    "## Results", "",
    "Summaries are mcode's own replies, verbatim except that the `<deliver-assets>` file lists are left out; they have not been verified.", "",
    "| Task | Status | Time (JST) | Tokens: input / cache read / output | mcode's reply |", "|---|---|---|---|---|",
]
for r in rows:
    u = r["usage"]
    md.append(f"| {r['task']} | {r['status']} | {hm(r['start'])}–{hm(r['end'])} ({mmss(r['secs'])}) | "
              f"{fmt(u.get('inputTokens', 0))} / {fmt(u.get('cacheReadTokens', 0))} / {fmt(u.get('outputTokens', 0))} | {r['reply']} |")
md += ["", "## Totals", "",
       f"- Completed: {done}. Failed or unfinished: {len(rows) - done}.",
       f"- Wall-clock time: {mmss(wall)} (four tasks in parallel). Model time summed over runs: "
       f"{sum((r['secs'] or 0) for r in rows) / 60:.1f} min.",
       f"- Tokens: {fmt(tot['inputTokens'])} input, {fmt(tot['cacheReadTokens'])} cache read, {fmt(tot['outputTokens'])} output "
       f"({fmt(tot['totalTokens'])} input + output).",
       f"- Token Plan quota: 5-hour window {pct(qb, 'short_percent')} before, {pct(qa, 'short_percent')} after; "
       f"weekly {pct(qb, 'percent')} before, {pct(qa, 'percent')} after.", ""]
(R / "RUN_LOG.md").write_text("\n".join(md))
print((O / "usage.txt").read_text())
