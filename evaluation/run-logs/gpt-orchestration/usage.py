#!/usr/bin/env python3
"""Sum codex token usage per task from `codex exec --json` event files: usage.py DIR"""
import json, sys
from pathlib import Path
F = ["input_tokens", "cached_input_tokens", "output_tokens", "reasoning_output_tokens"]
tot = dict.fromkeys(F + ["turns"], 0)
print(f"{'task':26} {'turns':>5} {'input':>11} {'cached':>11} {'output':>9} {'reasoning':>10}  status")
for f in sorted(Path(sys.argv[1]).glob("*.events.jsonl")):
    u = dict.fromkeys(F + ["turns"], 0); status = "ok"
    for line in f.read_text().splitlines():
        try: e = json.loads(line)
        except ValueError: continue
        if e.get("type") == "turn.completed":
            u["turns"] += 1
            for k in F: u[k] += e.get("usage", {}).get(k, 0) or 0
        if e.get("type") == "turn.failed": status = "FAILED: " + e.get("error", {}).get("message", "")[:60]
    for k in tot: tot[k] += u[k]
    print(f"{f.name.split('.')[0]:26} {u['turns']:5} {u['input_tokens']:11,} {u['cached_input_tokens']:11,} {u['output_tokens']:9,} {u['reasoning_output_tokens']:10,}  {status}")
print(f"{'TOTAL':26} {tot['turns']:5} {tot['input_tokens']:11,} {tot['cached_input_tokens']:11,} {tot['output_tokens']:9,} {tot['reasoning_output_tokens']:10,}")
