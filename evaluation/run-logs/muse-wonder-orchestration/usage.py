#!/usr/bin/env python3
"""muse-wonder token usage per task from its session logs (model_completed events), like muse-run-orch/usage.py.

The run used a clean HOME, so its session store holds only this run (plus the pre-run sandbox probes, which name no
task). In Muse Code 1.4.6 the reminder helpers run as their own sessions; they carry the task text, so they are
attributed to their task and counted, as the earlier muse run counted its helpers. Writes usage.json and usage.txt."""
import json, re, glob
from pathlib import Path

O = Path(__file__).resolve().parent
ROOM = "/Users/arda/projects/agent-eval-runs/agent-eval-muse-wonder"
F = ["input_tokens", "cached_tokens", "output_tokens", "reasoning_tokens"]
PASS2_US = 1791852000 * 10**6  # 2026-10-13 09:40 JST, between the two passes
TASK_RE = re.compile(r"Your task directory is " + re.escape(ROOM) + r"/([0-9]{2}-[a-z-]+)")


def walk(o):
    if isinstance(o, dict):
        yield o
        for v in o.values(): yield from walk(v)
    elif isinstance(o, list):
        for v in o: yield from walk(v)


def empty():
    return dict.fromkeys(F + ["steps", "model_ms", "helper_steps"], 0) | {"models": set(), "sessions": 0, "times": []}


tasks = {}
SESS = O / "home/.local/share/muse/sessions"
# Main sessions sit at Y/M/D/<id>/; helper (subagent) sessions under <parent id>/subagent/<id>/.
for f in sorted(glob.glob(str(SESS / "*/*/*/*/session.jsonl")) + glob.glob(str(SESS / "*/*/*/*/subagent/*/session.jsonl"))):
    text = open(f).read()
    m = TASK_RE.search(text)
    if not m: continue
    main = f'"workspace_root":"{ROOM}"' in text.replace('\\"', '"')
    # Tasks 10-13 ran twice: pass 1 was stopped by the quota (07:16), pass 2 re-ran them from the template (09:46).
    start = min((int(x) for x in re.findall(r'"recorded_at":(\d+)', text)), default=0)
    task = m.group(1)
    if task >= "10" and start < PASS2_US: task += " (attempt 1, quota-stopped)"
    u = tasks.setdefault(task, empty()); u["sessions"] += 1
    seen = set()
    for line in text.splitlines():
        try: rec = json.loads(line)
        except ValueError: continue
        recs = [rec] + [json.loads(c["record_json"]) for c in rec.get("children", []) if "record_json" in c]
        for r in recs:
            if main and "recorded_at" in r: u["times"].append(r["recorded_at"])
            for d in walk(r.get("payload", {})):
                if d.get("kind") == "model_completed" and "usage" in d:
                    if r.get("id") in seen: continue
                    seen.add(r.get("id"))
                    for k in F: u[k] += d["usage"].get(k, 0) or 0
                    u["steps"] += 1; u["model_ms"] += d.get("duration_ms", 0) or 0
                    if not main: u["helper_steps"] += 1
                    if d.get("model"): u["models"].add(d["model"])

total = dict.fromkeys(F + ["steps", "model_ms", "helper_steps", "sessions"], 0)
graded = dict(total)  # the thirteen runs whose output was graded (pass 1 for 01-09, pass 2 for 10-13)
rows = []
for t in sorted(tasks):
    u = tasks[t]; times = u.pop("times")
    u["models"] = sorted(u["models"]); u["wall_s"] = (max(times) - min(times)) / 1e6 if times else 0
    rows.append({"task": t, **u})
    for k in total:
        total[k] += u[k]
        if "attempt" not in t: graded[k] += u[k]

(O / "usage.json").write_text(json.dumps({"tasks": rows, "totals_graded_runs": graded, "totals_including_stopped_attempts": total}, indent=1))
out = [f"{'task':40} {'steps':>5} {'(helper)':>8} {'input':>11} {'cached':>11} {'output':>9} {'reasoning':>9} {'model min':>9} {'wall min':>8}"]
for r in rows:
    out.append(f"{r['task']:40} {r['steps']:5} {r['helper_steps']:8} {r['input_tokens']:11,} {r['cached_tokens']:11,} {r['output_tokens']:9,} "
               f"{r['reasoning_tokens']:9,} {r['model_ms'] / 60000:9.1f} {r['wall_s'] / 60:8.1f}")
for name, t in (("TOTAL graded (13 runs)", graded), ("TOTAL incl. stopped", total)):
    out.append(f"{name:40} {t['steps']:5} {t['helper_steps']:8} {t['input_tokens']:11,} {t['cached_tokens']:11,} "
               f"{t['output_tokens']:9,} {t['reasoning_tokens']:9,} {t['model_ms'] / 60000:9.1f}")
out.append("models seen: " + ", ".join(sorted({m for r in rows for m in r["models"]})))
(O / "usage.txt").write_text("\n".join(out) + "\n")
print("\n".join(out))
