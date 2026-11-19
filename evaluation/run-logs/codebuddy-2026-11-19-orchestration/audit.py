#!/usr/bin/env python3
"""Audit CodeBuddy stream-json transcripts: count tool calls by name, flag network/install commands,
paths outside the task directory, and permission denials. usage: audit.py TAG REPO"""
import json, re, sys, glob, os
from collections import Counter
O = os.path.dirname(os.path.abspath(__file__)); tag, repo = sys.argv[1], sys.argv[2].rstrip("/")
NET = re.compile(r"\b(curl|wget|pip3? install|npm (i|install)|npx|uv (pip|add)|git clone|ssh|scp|nc|http\.server)\b|https?://")
for f in sorted(glob.glob(f"{O}/{tag}/replies/*.events.jsonl")):
    t = os.path.basename(f).split(".")[0]; names = Counter(); flags = []; denials = []
    for line in open(f):
        try: d = json.loads(line)
        except ValueError: continue
        if not isinstance(d, dict): continue
        if d.get("type") == "result": denials = d.get("permission_denials") or []
        if d.get("type") != "assistant": continue
        for c in d["message"].get("content", []):
            if c.get("type") != "tool_use": continue
            names[c["name"]] += 1; inp = c.get("input", {}); s = json.dumps(inp)
            cmd = inp.get("command", "")
            if cmd and NET.search(cmd): flags.append(f"net? {cmd[:160]}")
            for p in re.findall(r"(/(?:home|tmp|etc|root|usr/local|var)[^\s\"',;)]*)", s):
                if not p.startswith(f"{repo}/{t}") and not p.startswith(("/tmp/claude", "/dev/null")):
                    flags.append(f"path {c['name']}: {p[:140]}")
    print(f"{t}: {sum(names.values())} calls {dict(names)} denials={len(denials)}")
    for x in sorted(set(flags)): print("   ", x)
