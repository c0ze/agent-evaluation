#!/usr/bin/env python3
"""Print Muse's subscription windows as JSON, without muse-quota's cache. Reuses muse-quota's fetch(): one tiny
real call (minimal effort, 16 output tokens) on the configured model, reading the response.subscription_usage event."""
import json, sys, time
from importlib.machinery import SourceFileLoader
sys.path.insert(0, "/home/arda/projects/utils/conky-ai-quota/bin")
mq = SourceFileLoader("muse_quota", "/home/arda/projects/utils/conky-ai-quota/bin/muse-quota").load_module()
try:
    d = mq.fetch()
except Exception as e:
    d = {"error": f"{type(e).__name__}: {e}"}
d["fetched_local"] = time.strftime("%Y-%m-%dT%H:%M:%S%z")
for k in ("reset_at", "short_reset_at"):
    if d.get(k): d[k.replace("_at", "_local")] = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(d[k]))
print(json.dumps(d, indent=2))
