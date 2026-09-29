#!/usr/bin/env python3
"""Write RUN_LOG.md for a codex run: runlog.py TAG MODEL EFFORT ACCOUNT REPO [NOTE...]"""
import json, re, sys
from pathlib import Path
O = Path(__file__).parent
tag, model, effort, account, repo = sys.argv[1:6]; notes = sys.argv[6:]
times = {}
for l in (O / "times.log").read_text().splitlines():
    m = re.match(rf"{tag} (\S+) (start|end) (\S+ \S+)(?: rc=(\d+) secs=(\d+))?(.*)", l)
    if not m or "interrupted" in m[6]: continue
    t = times.setdefault(m[1], {}); t[m[2]] = m[3][11:]
    if m[2] == "end": t.update(rc=m[4], secs=int(m[5]), resumed="resumed" in m[6])
use = {}
for l in (O / f"{tag}-usage.txt").read_text().splitlines()[1:]:
    p = l.split()
    if p and re.match(r"\d\d-", p[0]): use[p[0]] = p[1:6]
    if p and p[0] == "TOTAL": total = p[1:6]
rows = []
for t in sorted(times):
    r = times[t]; u = use.get(t, ["?"] * 5); reply = (O / tag / f"{t}.reply.md")
    body = reply.read_text().strip().replace("\n", " ").replace("|", "/") if reply.exists() else "(no reply)"
    status = "completed" if r.get("rc") == "0" and u[-1:] != ["FAILED"] else "failed"
    rows.append(f"| {t} | {status}{' (resumed)' if r.get('resumed') else ''} | {r['start']}–{r['end']} ({r['secs']//60}m{r['secs']%60:02d}s) | {u[1]} / {u[2]} / {u[3]} / {u[4]} | {body} |")
Path(repo, "RUN_LOG.md").write_text(f"""# Run log

- **Model under test:** `{model}`, reasoning effort **{effort}**
- **Account:** {account} (Codex CLI 0.157.1)
- **Orchestrator:** Claude Opus 5.5 in Claude Code

## How it was run

Each of the 13 tasks ran as its own `codex exec` call, so every task started with a fresh context. Each call carried the same instruction the other runs gave, with only the task directory filled in. Four ran at a time. The command was `codex exec --ignore-user-config --ephemeral --skip-git-repo-check -s workspace-write -m {model} -c model_reasoning_effort={effort} -C <this repo> --json`. The workspace-write sandbox keeps writes inside the repository and blocks network access. The account's personal `AGENTS.md` was set aside during the run so no personal instructions applied, and restored afterwards.

The orchestrator gave no hints and did not review, fix, finish or re-run any work. Token usage comes from codex's `turn.completed` events.

## Results

Replies are the model's own words, verbatim; they have not been verified.

| Task | Status | Time (JST) | Tokens: input / cached / output / reasoning | Reply |
|---|---|---|---|---|
{chr(10).join(rows)}

## Totals

- Tokens: {total[1]} input ({total[2]} of them cached), {total[3]} output, {total[4]} reasoning.
{chr(10).join('- ' + n for n in notes)}
""")
print(Path(repo, "RUN_LOG.md").read_text()[-900:])
