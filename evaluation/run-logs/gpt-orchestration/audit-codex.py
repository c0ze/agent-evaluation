#!/usr/bin/env python3
"""Audit codex `--json` event files for a run: audit-codex.py EVENTS_DIR REPO

For each task, lists commands that mention another task's directory, the repository root
outside the task, the home directory, or network tools / URLs, plus files changed outside the task.
Read-only; prints a report.
"""
import json, re, sys
from pathlib import Path

ev_dir, repo = Path(sys.argv[1]), sys.argv[2].rstrip("/")
tasks = sorted(p.name for p in Path(repo).iterdir() if re.match(r"\d\d-", p.name))
NET = re.compile(r"\b(curl|wget|nc|ssh|scp|git\s+(clone|fetch|pull|push)|pip3?\s+install(?!.*--no-index)|npm\s+(i|install)|npx)\b|https?://(?!localhost|127\.0\.0\.1|www\.w3\.org)")
HOME = re.compile(r"/Users/arda\.karaduman(?!/\.codex-eval)|~/")
total = 0
for f in sorted(ev_dir.glob("*.events.jsonl")):
    t = f.name.split(".")[0]; hits = []
    for line in f.read_text().splitlines():
        try: e = json.loads(line)
        except ValueError: continue
        it = e.get("item") or {}
        if e.get("type") != "item.completed": continue
        if it.get("type") == "command_execution":
            cmd = it.get("command", "")
            others = [o for o in tasks if o != t and o in cmd]
            if others: hits.append(f"other task {others}: {cmd[:160]!r}")
            if re.search(re.escape(repo) + r"(?!/" + re.escape(t) + r")(/|\s|'|\"|$)", cmd):
                hits.append(f"repo root outside task: {cmd[:160]!r}")
            if NET.search(cmd): hits.append(f"network-like: {cmd[:160]!r}")
            if HOME.search(cmd): hits.append(f"home dir: {cmd[:160]!r}")
        if it.get("type") == "file_change":
            for ch in it.get("changes", []):
                p = ch.get("path", "")
                if not p.startswith(f"{repo}/{t}/"): hits.append(f"file change outside task: {p}")
    total += len(hits)
    print(f"{t}: {'clean' if not hits else str(len(hits)) + ' flagged'}")
    for h in hits: print("   ", h)
print(f"TOTAL flagged: {total}")
