#!/usr/bin/env python3
"""Validate blind score files: validate.py SCORES_DIR BLIND_DIR [TASK...]"""
import json, sys
from pathlib import Path
sd, bd = Path(sys.argv[1]), Path(sys.argv[2])
tasks = sys.argv[3:] or sorted(p.stem for p in sd.glob("*.json"))
for t in tasks:
    letters = {p.name for p in (bd / t).iterdir() if p.is_dir() and not p.name.startswith("_")}
    d = json.loads((sd / f"{t}.json").read_text()); s = d["submissions"]
    probs = []
    if set(s) != letters: probs.append(f"letters differ: missing {letters - set(s)} extra {set(s) - letters}")
    if sorted(d.get("ranking", [])) != sorted(letters): probs.append("ranking not a permutation")
    for l, v in s.items():
        tot = sum(v["criteria"].values())
        if abs(tot - v["total"]) > 0.01: probs.append(f"{l} total {v['total']} != sum {tot}")
        if any((x * 4) % 1 for x in v["criteria"].values()): probs.append(f"{l} not in 0.25 steps")
    print(t, "OK" if not probs else probs)
