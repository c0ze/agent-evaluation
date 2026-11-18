#!/usr/bin/env python3
"""Keep the isolated benchmark Codex login and ~/.codex/auth.json in step.

Codex rotates its ChatGPT refresh token when it renews a login, so after one copy renews,
the other copy's refresh token stops working. This copies whichever auth.json has the newer
`last_refresh` over the older one. Never prints token values.
Usage: sync-auth.py REAL_HOME
"""
import json, shutil, sys
from pathlib import Path

home = Path(sys.argv[1])
main, iso = home / ".codex/auth.json", home / ".codex-eval/codex/auth.json"

def last(p):
    try:
        return json.loads(p.read_text()).get("last_refresh") or ""
    except (OSError, ValueError):
        return ""

m, i = last(main), last(iso)
if not m and not i:
    print("sync-auth: no readable auth.json"); sys.exit(1)
if i > m:
    shutil.copy2(iso, main); main.chmod(0o600); print(f"sync-auth: isolated -> ~/.codex ({m} -> {i})")
elif m > i:
    shutil.copy2(main, iso); iso.chmod(0o600); print(f"sync-auth: ~/.codex -> isolated ({i} -> {m})")
else:
    print(f"sync-auth: in step ({m})")
