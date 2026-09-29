#!/usr/bin/env python3
"""Total muse token usage per task from its session logs (model_completed events)."""
import json, re, sys, glob, os
ROOM = "/Users/arda/projects/agent-eval-runs/agent-eval-muse"
since = os.path.getmtime("/Users/arda/projects/agent-eval-runs/muse-run-orch/run.sh")
F = ["input_tokens", "output_tokens", "reasoning_tokens", "cached_tokens"]
rows, total = [], dict.fromkeys(F + ["steps", "model_ms"], 0)
def walk(o):
    if isinstance(o, dict):
        yield o
        for v in o.values(): yield from walk(v)
    elif isinstance(o, list):
        for v in o: yield from walk(v)
for f in glob.glob(os.path.expanduser("~/.local/share/muse/sessions/*/*/*/*/session.jsonl")):
    if os.path.getmtime(f) < since: continue
    text = open(f).read()
    if f'"workspace_root":"{ROOM}"' not in text.replace('\\"', '"'): continue
    m = re.search(r"Your task directory is " + re.escape(ROOM) + r"/([0-9]{2}-[a-z-]+)", text)
    task = m.group(1) if m else "?"
    seen, u, times = set(), dict.fromkeys(F + ["steps", "model_ms"], 0), []
    for line in text.splitlines():
        try: rec = json.loads(line)
        except ValueError: continue
        recs = [rec] + [json.loads(c["record_json"]) for c in rec.get("children", []) if "record_json" in c]
        for r in recs:
            if "recorded_at" in r: times.append(r["recorded_at"])
            for d in walk(r.get("payload", {})):
                if d.get("kind") == "model_completed" and "usage" in d:
                    key = r.get("id")
                    if key in seen: continue
                    seen.add(key)
                    for k in F: u[k] += d["usage"].get(k, 0) or 0
                    u["steps"] += 1; u["model_ms"] += d.get("duration_ms", 0) or 0
    wall = (max(times) - min(times)) / 1e6 if times else 0
    rows.append((task, u, wall))
    for k in total: total[k] += u[k]
rows.sort(key=lambda r: r[0])
print(f"{'task':28} {'steps':>5} {'input':>10} {'cached':>10} {'output':>9} {'reasoning':>9} {'model min':>9} {'wall min':>8}")
for t, u, w in rows:
    print(f"{t:28} {u['steps']:5} {u['input_tokens']:10,} {u['cached_tokens']:10,} {u['output_tokens']:9,} {u['reasoning_tokens']:9,} {u['model_ms']/60000:9.1f} {w/60:8.1f}")
print(f"{'TOTAL ('+str(len(rows))+' sessions)':28} {total['steps']:5} {total['input_tokens']:10,} {total['cached_tokens']:10,} {total['output_tokens']:9,} {total['reasoning_tokens']:9,} {total['model_ms']/60000:9.1f}")
