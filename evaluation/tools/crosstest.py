#!/usr/bin/env python3
"""Run each model's tests against every model's implementation (and the original template)."""
import json, shutil, subprocess, sys, tempfile, re
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
MODELS = sys.argv[1:] or ["mimo", "sonnet-5.5", "fable-5.1", "opus-5.5"]
TASKS = {"01-feature-building": "jobqueue.py", "02-bug-fixing": "ttl_cache.py"}
out = {}
for task, impl in TASKS.items():
    impls = {"template": ROOT / "_templates" / task / impl} | {m: ROOT / m / task / impl for m in MODELS}
    out[task] = {}
    for tester in MODELS:
        tests = [p for p in (ROOT / tester / task).glob("test*.py")]
        out[task][tester] = {}
        for who, src in impls.items():
            if not src.exists(): continue
            with tempfile.TemporaryDirectory() as tmp:
                shutil.copy(src, Path(tmp) / impl)
                for t in tests: shutil.copy(t, tmp)
                r = subprocess.run([sys.executable, "-B", "-m", "unittest", "discover", "-p", "test*.py"], cwd=tmp, capture_output=True, text=True, timeout=120)
                txt = r.stderr
                ran = re.search(r"Ran (\d+) tests", txt); fail = re.search(r"FAILED \((.*)\)", txt)
                out[task][tester][who] = {"ran": int(ran.group(1)) if ran else 0, "ok": r.returncode == 0, "detail": fail.group(1) if fail else ("OK" if r.returncode == 0 else txt.strip().splitlines()[-1][:120]),
                                           "failing": re.findall(r"^(?:FAIL|ERROR): (\S+) \(([^)]*)\)", txt, flags=re.M)[:40]}
(ROOT / "evaluation/crosstest.json").write_text(json.dumps(out, indent=1))
for task, rows in out.items():
    print(f"\n{task}: rows = whose tests, columns = whose implementation")
    cols = ["template"] + MODELS
    print(f"{'':12}" + "".join(f"{c:>24}" for c in cols))
    for tester, r in rows.items():
        print(f"{tester:12}" + "".join(f"{('OK' if r[c]['ok'] else r[c]['detail']):>24}" for c in cols))
