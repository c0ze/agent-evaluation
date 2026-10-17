#!/usr/bin/env python3
"""Every tool call muse made, per task, from the session logs (assistant_tool_calls_committed events): writes audit.txt
with all shell commands and any path argument outside the task's directory, plus flags for network-looking commands."""
import json, re, glob
from pathlib import Path
O = Path(__file__).resolve().parent
ROOM = str(O.parent / "agent-eval-muse-wonder-full")
NET = re.compile(r"\b(curl|wget|pip3? install|uv (pip|add|sync|run --with)|npm (i|install|ci)\b|npx|git (clone|fetch|pull|push)|ssh|nc |ping)\b")
out, flags = [], []
for home in sorted(p for p in (O / "homes").iterdir() if p.name != "probe"):
    t = home.name; out.append(f"## {t}")
    for f in sorted(glob.glob(str(home / ".local/share/muse/sessions/*/*/*/*/session.jsonl"))):
        for line in open(f):
            if "assistant_tool_calls_committed" not in line: continue
            ev = json.loads(line)["payload"]["event"]
            for c in ev.get("tool_calls", []):
                try: a = json.loads(c["args"])
                except ValueError: a = {"raw": c["args"]}
                if c["name"] == "bash":
                    cmd = a.get("command", ""); out.append("$ " + cmd.replace("\n", "\n  "))
                    if NET.search(cmd): flags.append(f"{t} NET? {cmd[:200]}")
                else:
                    p = a.get("path") or a.get("file_path") or ""
                    out.append(f"{c['name']} {p}")
                    if p and not p.startswith(f"{ROOM}/{t}") and not (not p.startswith("/") and ".." not in p):
                        flags.append(f"{t} OUTSIDE? {c['name']} {p}")
                for v in re.findall(r"(/[^\s'\"]+)", json.dumps(a)):
                    if v.startswith(ROOM) and not v.startswith(f"{ROOM}/{t}") and v.rstrip("/") != ROOM:
                        flags.append(f"{t} OTHER-TASK? {c['name']} {v}")
(O / "audit.txt").write_text("\n".join(out) + "\n\n# flags\n" + "\n".join(flags) + "\n")
print("\n".join(flags) or "no flags")
