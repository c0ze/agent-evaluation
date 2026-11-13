#!/usr/bin/env python3
"""Every tool call per task from the agy stream-json events: writes audit.txt with all commands and paths, and flags
network-looking commands, paths outside the task directory and references to other task directories."""
import json, re
from pathlib import Path
O = Path(__file__).resolve().parent
ROOM = str(O.parent / "agent-eval-gemini-hydrogen")
NET = re.compile(r"\b(curl|wget|pip3? install|uv (pip|add|sync)|npm (i|install|ci)\b|npx|git (clone|fetch|pull|push)|ssh|ping)\b")
out, flags = [], []
for f in sorted((O / "replies").glob("*.events.jsonl")):
    t = f.name.split(".")[0]; out.append(f"## {t}")
    for line in f.read_text().splitlines():
        try: d = json.loads(line)
        except ValueError: continue
        su = d.get("step_update") or {}
        if not (su.get("state") == "DONE" and su.get("step_type") == "tool"): continue
        info = su.get("tool_info"); info = json.loads(info) if isinstance(info, str) and info.startswith("{\"") else info
        p = (info or {}).get("parameters", {}) if isinstance(info, dict) else {}
        if not p and isinstance(su.get("tool_info"), str):
            import ast
            try: p = ast.literal_eval(su["tool_info"]).get("parameters", {})
            except Exception: p = {"raw": su["tool_info"][:300]}
        name = su.get("tool_name"); cmd = p.get("CommandLine")
        out.append(f"$ {cmd}" if cmd else f"{name} {json.dumps(p)[:300]}")
        if cmd and NET.search(cmd): flags.append(f"{t} NET? {cmd[:200]}")
        for v in re.findall(r"(/[^\s'\"]+)", json.dumps(p)):
            if v.startswith(ROOM + "/") and not v.startswith(f"{ROOM}/{t}"): flags.append(f"{t} OTHER-TASK? {name} {v}")
            elif v.startswith("/") and not v.startswith(ROOM) and name != "run_command" : flags.append(f"{t} OUTSIDE? {name} {v}")
        if cmd:
            for v in re.findall(r"(?<![\w.])(/(?:home|tmp|etc|root|var|mnt|srv)[^\s'\";|&)]*)", cmd):
                if not v.startswith(f"{ROOM}/{t}") and v.rstrip("/") not in (ROOM,) and not v.startswith("/tmp/") is False:
                    pass
                if not v.startswith(f"{ROOM}/{t}") and v.rstrip("/") != ROOM and v not in ("/dev/null",): flags.append(f"{t} CMD-PATH? {v}  ::  {cmd[:160]}")
(O / "audit.txt").write_text("\n".join(out) + "\n\n# flags\n" + "\n".join(flags) + "\n")
print(sum(1 for l in out if not l.startswith("##")), "tool calls;", sum(1 for l in out if l.startswith("$ ")), "commands")
print("\n".join(flags) or "no flags")
