#!/usr/bin/env python3
"""Write RUN_LOG.md for one Gemini run from times.log and each task's agy stream-json events.
usage: runlog.py TAG LABEL MODEL_VARIANT REPO [NOTE...]"""
import json, re, sys
from collections import Counter
from pathlib import Path
O = Path(__file__).parent
tag, label, variant, repo = sys.argv[1:5]; repo = Path(repo); notes = sys.argv[5:]
times = {}
for l in (O / "times.log").read_text().splitlines():
    m = re.match(rf"{re.escape(tag)} (\d\d-\S+) (start|end) (\S+ \S+)(?: rc=(\d+) secs=(\d+))?", l)
    if not m or "interrupted" in l: continue
    t = times.setdefault(m[1], {}); t[m[2]] = m[3][11:]
    if m[2] == "end": t.update(rc=m[4], secs=int(m[5]))

def parse(t):
    res, models, tools = None, set(), Counter()
    for line in (O / tag / "replies" / f"{t}.events.jsonl").read_text().splitlines():
        try: d = json.loads(line)
        except ValueError: continue
        if d.get("event") == "init": models.add((d.get("init") or {}).get("model", "?"))
        if d.get("event") == "result": res = d.get("result")
        su = d.get("step_update") or {}
        if su.get("state") == "DONE" and su.get("step_type") == "tool": tools[su.get("tool_name")] += 1
    return res, models, tools

rows, usage = [], {}
tot = Counter()
for t in sorted(times):
    r = times[t]; res, models, tools = parse(t)
    u = (res or {}).get("usage", {})
    vals = dict(input=u.get("input_tokens", 0), cache_read=u.get("cache_read_tokens", 0), output=u.get("output_tokens", 0), thinking=u.get("thinking_tokens", 0))
    tot.update(vals); tot["tool_calls"] += sum(tools.values())
    usage[t] = dict(**vals, tool_calls=sum(tools.values()), tools=dict(tools), models=sorted(models), secs=r.get("secs"), status=(res or {}).get("status"))
    ok = r.get("rc") == "0" and res and res.get("status") == "SUCCESS"
    body = ((res or {}).get("response") or "(no reply)").strip().replace("\n", " ").replace("|", "/")
    rows.append(f"| {t} | {'completed' if ok else 'failed'} | {r['start']}–{r.get('end', '?')} ({r.get('secs', 0)//60}m{r.get('secs', 0)%60:02d}s) | {vals['input']:,} / {vals['cache_read']:,} / {vals['output']:,} / {vals['thinking']:,} | {body} |")
(O / tag / "usage.json").write_text(json.dumps(usage, indent=1))
start = min(v["start"] for v in times.values()); end = max(v.get("end", "") for v in times.values())
all_models = sorted({m for v in usage.values() for m in v["models"]})
(repo / "RUN_LOG.md").write_text(f"""# Run log

- **Model under test:** {label} (`{variant}`, Antigravity's High variant, plus `--effort high`)
- **Harness:** Antigravity CLI (agy) 1.3.3, headless (`agy -p`), on cachyos, signed in with the user's Google account
- **Orchestrator:** Claude Opus 5.5 in Claude Code
- **Date:** 2026-10-11, {start}–{end} JST

## How it was run

Each of the 13 tasks ran as its own `agy -p` session, so every task started with a fresh context. Each call carried the same instruction the other runs gave, with only the task directory filled in. Four ran at a time. The command was `agy -p <instruction> --model {variant} --effort high --add-dir <this repo> --output-format stream-json`, run from the repository root.

Isolation: this repository was created fresh from the task templates, with no history, outside the user's home directory, so no `CLAUDE.md`, `GEMINI.md` or `AGENTS.md` was discovered. Each task ran with its own empty `HOME` containing only a link to the user's agy sign-in token and a settings file, so none of the user's Antigravity rules, memories, knowledge items, conversation history, skills or MCP servers were present, and tasks couldn't see each other's sessions; only agy's built-in skills were. Settings: `enableTerminalSandbox: true`, `toolPermission: proceed-in-sandbox`, file read/write allowed in this repository, `read_url(*)` and `execute_url(*)` denied. In agy's sandbox, terminal commands have no network access and can write only to the workspace and temp directories. No other model's output was reachable from the repository.

The orchestrator gave no hints and did not review, fix, finish or re-run any work. Token counts come from each session's final `result` event.

## Results

Replies are the model's own words, verbatim; they have not been verified.

| Task | Status | Time (JST) | Tokens: input / cache read / output / thinking | Reply |
|---|---|---|---|---|
{chr(10).join(rows)}

## Totals

- Model reported by agy for every session: {', '.join(f'`{m}`' for m in all_models)}.
- Tokens: {tot['input']:,} input + {tot['cache_read']:,} cache-read input, {tot['output']:,} output, {tot['thinking']:,} thinking; {tot['tool_calls']} tool calls.
{chr(10).join('- ' + n for n in notes)}
""")
print((repo / "RUN_LOG.md").read_text()[-900:])
