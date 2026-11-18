#!/usr/bin/env python3
"""Fill evaluation/tools/grader-prompt.md for one task: fill_prompt.py REPO BLIND SCORES TASK NODE_TOOLS
Uses the rubric maxima from unblind.py and swaps the ThinkPad's Linux paths for this Mac's."""
import json, re, sys, ast
from pathlib import Path
repo, blind, scores, task, node_tools = sys.argv[1:6]
tools = Path(repo) / "evaluation/tools"
src = (tools / "unblind.py").read_text()
grab = lambda name: ast.literal_eval(re.search(rf"^{name} = (\{{.*?\n?\}})\n", src, re.S | re.M).group(1))
RUBRIC, FRONT = grab("RUBRIC"), grab("FRONT")
rub = RUBRIC.get(task[:2], FRONT)
letters = sorted((p.name for p in (Path(blind) / task).iterdir() if p.is_dir() and not p.name.startswith("_")), key=lambda l: (len(l), l))
t = (tools / "grader-prompt.md").read_text()
t = t.replace("/usr/sbin/google-chrome-stable", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
t = t.replace("nothing under `/home/arda/projects/agent-evaluation` or any other agent-eval directory",
              f"nothing under `{repo}`, `/Users/Shared/agent-eval-runs` or any other agent-eval directory")
t = (t.replace("{TASK}", task).replace("{BLIND}", blind).replace("{SCORES}", scores).replace("{TOOLS}", node_tools)
      .replace("{LETTERS}", ", ".join(letters))
      .replace("{RUBRIC}", "\n".join(f"- {c}: {m}" for c, m in rub.items()))
      .replace("{CRITERIA_EXAMPLE}", ", ".join(f'"{c}": 0' for c in rub)))
assert not re.search(r"\{[A-Z_]+\}", t), re.findall(r"\{[A-Z_]+\}", t)
print(t)
