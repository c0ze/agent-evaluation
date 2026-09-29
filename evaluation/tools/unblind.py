#!/usr/bin/env python3
"""Merge blind per-task scores (A-D) into evaluation/scores.json using the blind key."""
import json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
scores_dir, key_file = Path(sys.argv[1]), Path(sys.argv[2])
key = json.loads(key_file.read_text())
RUBRIC = {
 "01": {"contract correctness": 6, "implementation quality": 2, "tests and verification": 2},
 "02": {"behavioral correctness": 7, "diagnosis": 1, "regression coverage": 2},
 "03": {"security/correctness": 4, "operability": 3, "runbook and judgment": 3},
 "04": {"compatibility/release correctness": 4, "CI/tests": 3, "release and maintenance communication": 3},
 "05": {"factual fidelity": 3, "information design": 3, "clarity/examples": 3, "handling uncertainty": 1},
 "06": {"completeness": 3, "dependency/risk reasoning": 3, "actionable milestones": 2, "product judgment": 2},
 "07": {"prose/craft": 4, "structural payoff": 2, "originality": 2, "constraint adherence": 2},
 "08": {"voice/platform fit": 3, "factual discipline": 2, "response quality": 3, "constraint adherence": 2},
 "09": {"evidence discipline": 3, "diagnosis": 3, "corrective actions": 2, "customer communication": 2},
 "10": {"scheduling feasibility": 4, "prioritization": 2, "contradiction handling": 2, "team communication": 2},
}
FRONT = {"visual hierarchy/taste": 3, "responsive design": 2, "interaction and task completion": 2, "accessibility": 2, "implementation quality": 1}
out_file = ROOT / "evaluation/scores.json"
out = json.loads(out_file.read_text()) if out_file.exists() else {"tasks": {}}
out["grader"] = "Blind per-task graders: Claude Opus 5.5 subagents in Claude Code, 2026-09-30"
problems = []
for f in sorted(scores_dir.glob("*.json")):
    d = json.loads(f.read_text()); task = f.stem; n = task[:2]
    rubric = RUBRIC.get(n, FRONT); models = {}
    for letter, s in d["submissions"].items():
        m = key[task][letter]
        crit = {c: s["criteria"].get(c) for c in rubric}
        missing = [c for c, v in crit.items() if v is None]
        over = [c for c, v in crit.items() if v is not None and v > rubric[c]]
        calc = round(sum(v for v in crit.values() if v is not None), 2)
        if missing or over or abs(calc - s["total"]) > 0.01:
            problems.append(f"{task} {letter}={m}: missing={missing} over={over} total={s['total']} sum={calc}")
        models[m] = {**s, "criteria": crit, "total": calc, "letter": letter}
    out["tasks"][task] = {"rubric": rubric, "models": models, "ranking": [key[task][l] for l in d.get("ranking", [])], "notes": d.get("notes", "")}
out_file.write_text(json.dumps(out, indent=1))
print(f"merged {len(out['tasks'])} tasks into {out_file.relative_to(ROOT)}")
for p in problems: print("CHECK:", p)
