#!/usr/bin/env python3
"""Objective checks for each model's outputs; writes evaluation/checks.json."""
import json, re, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
MODELS = sys.argv[1:] or ["mimo", "sonnet-5.5", "fable-5.1", "opus-5.5"]

def words(p):
    if not p.exists(): return None
    t = re.sub(r"```.*?```", " ", p.read_text(), flags=re.S)
    t = re.sub(r"^#+ .*$", " ", t, flags=re.M)          # headings don't count
    t = re.sub(r"[#*_>`|\[\]()-]", " ", t)
    return len(re.findall(r"\b[\w'’.,:;!?/$%&@-]+\b", t))

def run(cmd, cwd):
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=300)
    out = (r.stdout + r.stderr).strip().splitlines()
    m = [l for l in out if re.match(r"(Ran \d+ tests|OK|FAILED|\d+ passed|=+ .* in )", l.strip())]
    return {"rc": r.returncode, "summary": " / ".join(m[-3:]) or (out[-1] if out else "")}

res = {}
for m in MODELS:
    d = ROOT / m; r = {}
    hid = subprocess.run([sys.executable, "evaluation/tools/../test_code_tasks.py", m], cwd=ROOT, capture_output=True, text=True)
    r["hidden_tests"] = {"rc": hid.returncode, "summary": (hid.stderr.strip().splitlines() or [""])[-3:]}
    r["own_tests_01"] = run([sys.executable, "-B", "-m", "unittest", "discover", "-p", "test*.py"], d / "01-feature-building")
    r["own_tests_02"] = run([sys.executable, "-B", "-m", "unittest", "discover", "-p", "test*.py"], d / "02-bug-fixing")
    r["own_tests_04"] = run([sys.executable, "-B", "-m", "unittest", "discover", "-p", "test*.py"], d / "04-project-maintenance")
    r["words_05_WEBHOOKS"] = words(d / "05-technical-writing/WEBHOOKS.md")
    r["words_07_STORY"] = words(d / "07-creative-writing/STORY.md")
    resp7 = d / "07-creative-writing/RESPONSE.md"
    r["sentences_07_RESPONSE"] = len(re.findall(r"[.!?](\s|$)", resp7.read_text())) if resp7.exists() else None
    r["words_08_RESPONSE"] = words(d / "08-social-media/RESPONSE.md")
    r["words_09_CUSTOMER_UPDATE"] = words(d / "09-incident-analysis/CUSTOMER_UPDATE.md")
    r["files"] = {t.name: sorted(str(p.relative_to(t)) for p in t.rglob("*") if p.is_file() and "__pycache__" not in p.parts)
                  for t in sorted(d.glob("[01][0-9]-*"))}
    res[m] = r
(ROOT / "evaluation/checks.json").write_text(json.dumps(res, indent=1))
for m, r in res.items():
    print(f"\n== {m}")
    for k, v in r.items():
        if k != "files": print(f"  {k}: {v}")
