#!/usr/bin/env python3
"""Write RUN_LOG.md for a CodeBuddy run from times.log and each task's stream-json events.
usage: runlog.py TAG LABEL MODEL EFFORT REPO [NOTE...]"""
import json, re, sys
from collections import Counter
from pathlib import Path
O = Path(__file__).parent
tag, label, model, effort, repo = sys.argv[1:6]; repo = Path(repo); notes = sys.argv[6:]
times = {}
for l in (O / "times.log").read_text().splitlines():
    m = re.match(rf"{re.escape(tag)} (\d\d-\S+) (start|end) (\S+ \S+)(?: rc=(\d+) secs=(\d+))?", l)
    if not m or "interrupted" in l: continue
    t = times.setdefault(m[1], {}); t[m[2]] = m[3][11:]
    if m[2] == "end": t.update(rc=m[4], secs=int(m[5]))

rows, usage, tot = [], {}, Counter()
for t in sorted(times):
    r = times[t]; res, models, tools = None, set(), 0
    for line in (O / tag / "replies" / f"{t}.events.jsonl").read_text().splitlines():
        try: d = json.loads(line)
        except ValueError: continue
        if d.get("type") == "result": res = d
        if d.get("type") == "assistant":
            models.add(d["message"].get("model", "?"))
            tools += sum(1 for c in d["message"].get("content", []) if c.get("type") == "tool_use")
    u = (res or {}).get("usage", {})
    vals = dict(input=u.get("input_tokens", 0), cache_read=u.get("cache_read_input_tokens", 0), output=u.get("output_tokens", 0))
    tot.update(vals); tot["tool_calls"] += tools; tot["turns"] += (res or {}).get("num_turns", 0)
    usage[t] = dict(**vals, tool_calls=tools, turns=(res or {}).get("num_turns"), models=sorted(models), secs=r.get("secs"))
    ok = r.get("rc") == "0" and res and not res.get("is_error")
    body = ((res or {}).get("result") or "(no reply)").strip().replace("\n", " ").replace("|", "/")
    rows.append(f"| {t} | {'completed' if ok else 'failed'} | {r['start']}–{r.get('end', '?')} ({r.get('secs', 0)//60}m{r.get('secs', 0)%60:02d}s) | {vals['input']:,} / {vals['cache_read']:,} / {vals['output']:,} | {body} |")
(O / tag / "usage.json").write_text(json.dumps(usage, indent=1))
all_models = sorted({m for v in usage.values() for m in v["models"]})
(repo / "RUN_LOG.md").write_text(f"""# Run log

- **Model under test:** {label} (`{model}`), effort **{effort}**
- **Harness:** Tencent CodeBuddy Code CLI 2.164.0, headless (`codebuddy -p`), on cachyos, signed in with the user's CodeBuddy account
- **Orchestrator:** Claude Opus 5.5 in Claude Code
- **Date:** 2026-10-12 JST

## How it was run

Each of the 13 tasks ran as its own `codebuddy -p` session, so every task started with a fresh context. Each call carried the same instruction the other runs gave, with only the task directory filled in. Four ran at a time. The command was `codebuddy -p <instruction> --model {model} --effort {effort} --setting-sources project --strict-mcp-config --no-session-persistence --permission-mode acceptEdits --disallowedTools WebFetch WebSearch --settings <rules> --output-format stream-json`, run from the repository root.

Isolation: this repository was created fresh from the task templates, with no history, outside the user's home directory, so no `CLAUDE.md`, `CODEBUDDY.md` or `AGENTS.md` was discovered. CodeBuddy's sign-in is tied to the user's real HOME (a clean HOME failed to authenticate), so HOME stayed real. User settings (plugins, hooks), MCP servers, session persistence and auto-memory were off. A smoke test reported no instruction files, memories, plugins or MCP tools, only one built-in skill, and no memory files appeared during the run. CodeBuddy ignores Claude Code's sandbox settings and its own sandbox needs Docker, so permission rules stood in for one: Bash allowed, but `curl`, `wget`, `pip`/`npm install`, `npx`, `uv pip`/`uv add`, `git clone`, `ssh` and the web tools denied (tested, including inside compound commands). The transcripts were audited afterwards.

The orchestrator gave no hints and did not review, fix, finish or re-run any work beyond the interruption below. CodeBuddy reports no cost for plan usage ($0 in every result event); tokens come from each session's final `result` event.

## Results

Replies are the model's own words, verbatim; they have not been verified.

| Task | Status | Time (JST) | Tokens: input / cache read / output | Reply |
|---|---|---|---|---|
{chr(10).join(rows)}

## Totals

- Model reported for every session: {', '.join(f'`{m}`' for m in all_models)}.
- Tokens: {tot['input']:,} input (of which {tot['cache_read']:,} cache reads), {tot['output']:,} output; {tot['turns']} turns, {tot['tool_calls']} tool calls.
{chr(10).join('- ' + n for n in notes)}
""")
print((repo / "RUN_LOG.md").read_text()[-900:])
