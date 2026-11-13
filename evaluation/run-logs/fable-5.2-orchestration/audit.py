#!/usr/bin/env python3
"""Every tool call per task from the Claude Code stream-json events: writes audit.txt with all commands and paths, and
flags network-looking commands, paths outside the task directory and references to other task directories."""
import json, re
from pathlib import Path
O = Path(__file__).resolve().parent
ROOM = str(O.parent / "agent-eval-fable-5.2")
NET = re.compile(r"\b(curl|wget|pip3? install|uv (pip|add|sync)|npm (i|install|ci)\b|npx|git (clone|fetch|pull|push)|ssh|ping)\b")
out, flags = [], []
for f in sorted((O / "replies").glob("*.events.jsonl")):
    t = f.name.split(".")[0]; out.append(f"## {t}")
    for line in f.read_text().splitlines():
        try: d = json.loads(line)
        except ValueError: continue
        if d.get("type") != "assistant": continue
        for c in d["message"]["content"]:
            if c.get("type") != "tool_use": continue
            name, inp = c["name"], c.get("input", {})
            cmd = inp.get("command") if name == "Bash" else None
            out.append(f"$ {cmd}" if cmd else f"{name} {json.dumps(inp)[:300]}")
            if cmd and NET.search(cmd): flags.append(f"{t} NET? {cmd[:200]}")
            p = inp.get("file_path") or inp.get("path") or inp.get("notebook_path")
            if p and not str(p).startswith(f"{ROOM}/{t}") and str(p).startswith("/"): flags.append(f"{t} OUTSIDE? {name} {p}")
            for v in re.findall(r"(/(?:home|tmp|etc|root|mnt|srv|var)[^\s'\";|&)]*)", json.dumps(inp)):
                if v.startswith(ROOM + "/") and not v.startswith(f"{ROOM}/{t}"): flags.append(f"{t} OTHER-TASK? {name} {v}")
                elif not v.startswith(ROOM) and v != "/dev/null": flags.append(f"{t} PATH? {name} {v[:150]}")
(O / "audit.txt").write_text("\n".join(out) + "\n\n# flags\n" + "\n".join(flags) + "\n")
print(sum(1 for l in out if not l.startswith("##")), "tool calls;", sum(1 for l in out if l.startswith("$ ")), "commands")
print("\n".join(flags) or "no flags")
