#!/usr/bin/env python3
"""Build blind grading folders: per task, each model's output under a random letter, identifying paths removed.
usage: blind.py OUT_DIR SEED MODEL..."""
import json, random, re, shutil, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
OUT, SEED, MODELS = Path(sys.argv[1]), int(sys.argv[2]), sys.argv[3:]
checks = json.loads((ROOT / "evaluation/checks.json").read_text())
cross = json.loads((ROOT / "evaluation/crosstest.json").read_text())
fe = json.loads((ROOT / "evaluation/frontend-checks.json").read_text())
notes_file = ROOT / "evaluation/blind-notes.json"
NOTES = json.loads(notes_file.read_text()) if notes_file.exists() else {}
PATH_RE = re.compile(r"/(home/user|home/arda|Users/arda/projects(/agent-eval-runs)?|tmp/claude-[0-9]+/[^/\s]+/[^/\s]+/scratchpad)/agent-eval[a-z0-9.\-]*(-2026-09-23)?(/(" + "|".join(map(re.escape, MODELS)) + r"))?")
ID_RE = re.compile(r"(?i)\b(gpt-[0-9][0-9a-z.\-]*|grok[ -]?[0-9][0-9a-z.\-]*(?:-build)?|claude-[a-z0-9.\-]+|(?:claude )?(?:sonnet|opus|fable|haiku) [0-9.]+|muse[- ]spark[0-9a-z.\-]*|muse[- ]wonder[0-9a-z.\-]*|muse code|meta muse (?:spark|wonder)|xiaomi/mimo[0-9a-z.\-]*|mimo-v[0-9a-z.\-]*|(?:minimax/)?minimax[- ]?m[0-9][0-9a-z.\-]*|minimax code|mcode|gemini[- ]?[0-9][0-9a-z.\-]*(?: (?:pro|flash))?(?: \(high\))?|antigravity(?:[- ]cli)?|agy|(?:moonshotai/)?kimi[- ]?k?[0-9][0-9a-z.\-]*|moonshot(?:ai)?|(?:deepseek/)?deepseek[- ]?v[0-9][0-9a-z.\-]*|deepseek|(?:z-ai/)?glm[- ]?[0-9][0-9a-z.\-]*|z\.ai|(?:mistralai/)?mistral(?:[- ](?:large|medium|small))?(?:[- ]?[0-9][0-9a-z.\-]*)?|opencode|openrouter|(?:qwen/)?qwen[- ]?[0-9][0-9a-z.\-]*(?:[- ]max)?|qwen|(?:nvidia/)?nemotron(?:[- ][0-9][0-9a-z.\-]*)?(?:[- ]ultra)?|nvidia|stepfun(?:/step-5-preview)?|step[- ]?5(?:[- ]preview)?|(?:tencent/)?hy4(?:-preview)?|hunyuan|tencent|codebuddy(?:[- ]code)?|cbc)\b")
HIDDEN_FAILS = {}
def hidden_failures(m):
    import subprocess
    r = subprocess.run([sys.executable, str(ROOT / "evaluation/test_code_tasks.py"), m], cwd=ROOT, capture_output=True, text=True)
    out = {}
    for name, cls in re.findall(r"^(?:FAIL|ERROR): (\S+) \(__main__\.(\w+)\.", r.stderr, flags=re.M): out.setdefault(cls, []).append(name)
    return out
rng = random.Random(SEED); key = {}; letters_all = "ABCDEFGHIJKLMNOPQRSTUVWX"
for task in sorted(p.name for p in (ROOT / "_templates").iterdir()):
    order = [m for m in MODELS if (ROOT / m / task).is_dir()]; rng.shuffle(order); letters = dict(zip(order, letters_all)); key[task] = {l: m for m, l in letters.items()}
    out = OUT / task; out.mkdir(parents=True)
    shutil.copytree(ROOT / "_templates" / task, out / "_original_inputs")
    facts = {}
    for m, l in letters.items():
        dst = out / l; shutil.copytree(ROOT / m / task, dst, ignore=shutil.ignore_patterns("__pycache__"))
        for f in dst.rglob("*"):
            if f.is_file():
                try: t = f.read_text()
                except (UnicodeDecodeError, ValueError): continue
                t2 = ID_RE.sub("[model id removed]", PATH_RE.sub("/work", t))
                if t2 != t: f.write_text(t2)
        c = checks[m]; n = task[:2]; fx = {}
        if n in ("01", "02"):
            # Report this task's own part of the hidden suite (5 scheduler / 6 cache tests), so a failure
            # in one task doesn't show up against the other.
            cls, total = ("SchedulerContract", 5) if n == "01" else ("CacheContract", 6)
            fails = HIDDEN_FAILS.setdefault(m, hidden_failures(m)).get(cls, [])
            fx["hidden_contract_tests"] = f"all {total} pass" if not fails else f"FAILURES ({len(fails)} of {total}): " + ", ".join(fails)
            fx["own_tests"] = c[f"own_tests_{n}"]["summary"]
        if n == "04": fx["own_tests"] = c["own_tests_04"]["summary"]
        if n == "05": fx["approx_words_WEBHOOKS_md"] = c["words_05_WEBHOOKS"]
        if n == "07": fx["approx_words_STORY_md"] = c["words_07_STORY"]; fx["sentences_RESPONSE_md"] = c["sentences_07_RESPONSE"]
        if n == "08": fx["approx_words_RESPONSE_md"] = c["words_08_RESPONSE"]
        if n == "09": fx["approx_words_CUSTOMER_UPDATE_md"] = c["words_09_CUSTOMER_UPDATE"]
        if n in ("11", "12", "13"):
            r = fe.get(f"{m}/{task}")
            fx["checks"] = {k: {x: r[k][x] for x in ("horizontalOverflow", "consoleErrors", "remoteRequests")} for k in r} if r else "no index.html delivered; nothing to load"
            for sh in ("desktop", "mobile", "desktop-full", "mobile-full"):
                src = ROOT / f"evaluation/screenshots/{m}-{n}-{sh}.png"
                if src.exists(): shutil.copy(src, out / f"{l}-{sh}.png")
        if NOTES.get(m, {}).get(task): fx["process_note"] = NOTES[m][task]
        facts[l] = fx
    if task in cross:
        facts["cross_tests"] = {"explanation": "rows: whose test suite; columns: whose implementation (template = original unfixed file)",
            "results": {letters[t]: {("template" if w == "template" else letters[w]): {"ok": v["ok"], "detail": v["detail"], "failing_tests": [x[0] for x in v["failing"]]} for w, v in row.items() if w == "template" or w in letters} for t, row in cross[task].items() if t in letters}}
    (out / "OBJECTIVE_CHECKS.json").write_text(json.dumps(dict(sorted(facts.items())), indent=1))
(OUT.parent / f"{OUT.name}_key.json").write_text(json.dumps(key, indent=1))
print("built", len(key), "tasks for", len(MODELS), "models")
