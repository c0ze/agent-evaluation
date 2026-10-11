#!/usr/bin/env python3
"""Write RUN_LOG.md for the Haiku 5.5 run from times.log and each task's stream-json result event.
usage: runlog.py REPO [NOTE...]"""
import json, re, sys
from pathlib import Path
O = Path(__file__).parent
repo = Path(sys.argv[1]); notes = sys.argv[2:]
times = {}
for l in (O / "times.log").read_text().splitlines():
    m = re.match(r"(\d\d-\S+) (start|end) (\S+ \S+)(?: rc=(\d+) secs=(\d+))?", l)
    if not m: continue
    t = times.setdefault(m[1], {}); t[m[2]] = m[3][11:]
    if m[2] == "end": t.update(rc=m[4], secs=int(m[5]))

def result(t):
    res, models, tools = None, set(), 0
    for line in (O / "replies" / f"{t}.events.jsonl").read_text().splitlines():
        try: d = json.loads(line)
        except ValueError: continue
        if d.get("type") == "result": res = d
        if d.get("type") == "assistant":
            models.add(d["message"].get("model", "?"))
            tools += sum(1 for c in d["message"]["content"] if c.get("type") == "tool_use")
    return res, models, tools

rows, tot = [], dict(inp=0, cw=0, cr=0, out=0, cost=0.0, turns=0)
usage = {}
for t in sorted(times):
    r = times[t]; res, models, tools = result(t)
    # modelUsage is the per-model session total; the result event's own "usage" can undercount.
    mu = list(((res or {}).get("modelUsage") or {}).values())
    inp, cw, cr, out = (sum(u.get(k, 0) for u in mu) for k in ("inputTokens", "cacheCreationInputTokens", "cacheReadInputTokens", "outputTokens"))
    cost = (res or {}).get("total_cost_usd", 0.0); turns = (res or {}).get("num_turns", 0)
    for k, v in zip(tot, (inp, cw, cr, out, cost, turns)): tot[k] += v
    usage[t] = dict(input=inp, cache_write=cw, cache_read=cr, output=out, cost_usd=cost, turns=turns, tool_calls=tools, models=sorted(models), secs=r.get("secs"))
    ok = r.get("rc") == "0" and res and not res.get("is_error")
    body = ((res or {}).get("result") or "(no reply)").strip().replace("\n", " ").replace("|", "/")
    rows.append(f"| {t} | {'completed' if ok else 'failed'} | {r['start']}–{r.get('end', '?')} ({r.get('secs', 0)//60}m{r.get('secs', 0)%60:02d}s) | {inp:,} / {cw:,} / {cr:,} / {out:,} | ${cost:.2f} | {body} |")
(O / "usage.json").write_text(json.dumps(usage, indent=1))
start = min(v["start"] for v in times.values()); end = max(v.get("end", "") for v in times.values())
all_models = sorted({m for v in usage.values() for m in v["models"]})
(repo / "RUN_LOG.md").write_text(f"""# Run log

- **Model under test:** Haiku 5.5 (`claude-haiku-5-5`), effort **xhigh**
- **Harness:** Claude Code CLI 2.1.296, headless (`claude -p`), on cachyos, signed in with a Claude Max subscription
- **Orchestrator:** Claude Opus 5.5 in Claude Code
- **Date:** 2026-10-11, {start}–{end} JST

## How it was run

Each of the 13 tasks ran as its own `claude -p` session, so every task started with a fresh context. Each call carried the same instruction the other runs gave, with only the task directory filled in. Four ran at a time. The command was `claude -p <instruction> --model claude-haiku-5-5 --effort xhigh --setting-sources project --strict-mcp-config --permission-mode acceptEdits --disallowedTools WebFetch WebSearch --no-session-persistence --output-format stream-json`, with settings that allow Bash without prompts inside Claude Code's sandbox (no network; writes confined to this repository and the session temp area).

Isolation: this repository was created fresh from the task templates, with no history, outside the user's home directory, so no personal `CLAUDE.md` or memory was discovered. User settings (plugins, hooks), MCP servers and the parent session's environment were excluded; only Claude Code's built-in skills were present. No other model's output was reachable from the repository.

The orchestrator gave no hints and did not review, fix, finish or re-run any work. A first launch was stopped after about 30 seconds and reset to the template commit, because Bash commands with an environment-variable prefix were being refused by permission prompts that headless mode can't answer; the run below is the clean relaunch. Token counts and the API-equivalent cost are Claude Code's own per-model totals (`modelUsage`) from each session's final `result` event; the account is a subscription, so no dollars were charged.

## Results

Replies are the model's own words, verbatim; they have not been verified.

| Task | Status | Time (JST) | Tokens: input / cache write / cache read / output | API-equiv. cost | Reply |
|---|---|---|---|---|---|
{chr(10).join(rows)}

## Totals

- Model IDs seen in the sessions' responses: {', '.join(f'`{m}`' for m in all_models)}.
- Tokens: {tot['inp']:,} input, {tot['cw']:,} cache write, {tot['cr']:,} cache read, {tot['out']:,} output; {tot['turns']} turns.
- API-equivalent cost: ${tot['cost']:.2f}.
{chr(10).join('- ' + n for n in notes)}
""")
print((repo / "RUN_LOG.md").read_text()[-1200:])
