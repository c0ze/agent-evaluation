#!/usr/bin/env python3
"""Write RUN_LOG.md for one OpenRouter/opencode run from times.log and each task's opencode JSON events.
usage: runlog.py TAG LABEL OPENROUTER_MODEL_ID SCRIPT REPO [NOTE...]"""
import json, re, sys
from collections import Counter
from pathlib import Path
O = Path(__file__).parent
tag, label, model, script, repo = sys.argv[1:6]; repo = Path(repo); notes = sys.argv[6:]
times = {}
for l in (O / "times.log").read_text().splitlines():
    m = re.match(rf"{re.escape(tag)} (\d\d-\S+) (start|end) (\S+ \S+)(?: credit_left=\S+)?(?: rc=(\d+) secs=(\d+))?", l)
    if not m or "retrying" in l or "interrupted" in l: continue
    t = times.setdefault(m[1], {}); t[m[2]] = m[3][11:]
    if m[2] == "end": t.update(rc=m[4], secs=int(m[5]))

def parse(t):
    cost, tok, tools, text, denied = 0.0, Counter(), Counter(), "", 0
    for line in (O / tag / "replies" / f"{t}.events.jsonl").read_text().splitlines():
        try: d = json.loads(line)
        except ValueError: continue
        p = d.get("part") or {}
        if d.get("type") == "step_finish":
            cost += p.get("cost", 0); k = p.get("tokens", {})
            tok.update(input=k.get("input", 0), output=k.get("output", 0), reasoning=k.get("reasoning", 0),
                       cache_read=(k.get("cache") or {}).get("read", 0), cache_write=(k.get("cache") or {}).get("write", 0))
        if d.get("type") == "text": text = p.get("text", "")
        if d.get("type") == "tool_use":
            tools[p.get("tool")] += 1
            if "prevents you from using" in str(p.get("state", {}).get("output") or p.get("state", {}).get("error")): denied += 1
    return cost, tok, tools, text, denied

rows, usage, tot = [], {}, Counter()
for t in sorted(times):
    r = times[t]; cost, tok, tools, text, denied = parse(t)
    tot.update(tok); tot["cost"] += cost; tot["tool_calls"] += sum(tools.values()); tot["denied"] += denied
    usage[t] = dict(**tok, cost_usd=round(cost, 4), tool_calls=sum(tools.values()), tools=dict(tools), denied=denied, secs=r.get("secs"))
    ok = r.get("rc") == "0" and text
    body = (text or "(no reply)").strip().replace("\n", " ").replace("|", "/")
    rows.append(f"| {t} | {'completed' if ok else 'failed'} | {r['start']}–{r.get('end', '?')} ({r.get('secs', 0)//60}m{r.get('secs', 0)%60:02d}s) | {tok['input']:,} / {tok['cache_read']:,} / {tok['output']:,} / {tok['reasoning']:,} | ${cost:.3f} | {body} |")
(O / tag / "usage.json").write_text(json.dumps(usage, indent=1))
start = min(v["start"] for v in times.values()); end = max(v.get("end", "") for v in times.values())
(repo / "RUN_LOG.md").write_text(f"""# Run log

- **Model under test:** {label} (`{model}` on OpenRouter), reasoning variant **high**
- **Harness:** opencode 1.18.30, headless (`opencode run`), on cachyos, with the user's OpenRouter key
- **Orchestrator:** Claude Opus 5.5 in Claude Code
- **Date:** 2026-10-11, {start}–{end} JST

## How it was run

Each of the 13 tasks ran as its own `opencode run` session, so every task started with a fresh context. Each call carried the same instruction the other runs gave, with only the task directory filled in. Four ran at a time. The command was `opencode run --pure --auto -m openrouter/{model} --variant high --format json <instruction>`, run from the repository root (script: `{script}`).

Isolation: this repository was created fresh from the task templates, with no history, outside the user's home directory. Each task ran with its own empty `HOME` and XDG directories containing only an opencode config, with `OPENCODE_DISABLE_CLAUDE_CODE=1` and `--pure`, so no `AGENTS.md`/`CLAUDE.md`, skills, plugins, MCP servers or session history were present, and tasks couldn't see each other's sessions. opencode has no OS sandbox, so permission rules stood in for one: web fetch/search denied, paths outside this repository denied (a denied call returns an error to the model), and `curl`, `wget`, `pip install`, `npm install`, `npx`, `git clone` and `ssh` denied. The transcripts were then audited for network use and work outside the task directory. No other model's output was reachable from the repository.

The orchestrator gave no hints and did not review, fix, finish or re-run any work. Token counts and cost come from opencode's per-step `step_finish` events, which use OpenRouter's reported cost.

## Results

Replies are the model's own words, verbatim; they have not been verified.

| Task | Status | Time (JST) | Tokens: input / cache read / output / reasoning | Cost | Reply |
|---|---|---|---|---|---|
{chr(10).join(rows)}

## Totals

- Tokens: {tot['input']:,} input + {tot['cache_read']:,} cache-read input ({tot['cache_write']:,} cache writes), {tot['output']:,} output + {tot['reasoning']:,} reasoning tokens (opencode counts reasoning separately from output); {tot['tool_calls']} tool calls, {tot['denied']} denied by permission rules.
- Cost (opencode's per-step total): ${tot['cost']:.2f}.
{chr(10).join('- ' + n for n in notes)}
""")
print((repo / "RUN_LOG.md").read_text()[-1000:])
