You are the blind grader for one task of a coding-agent evaluation: **{TASK}**.

## Your folder

`{BLIND}/{TASK}/` contains:

- `_original_inputs/`: the brief (`TASK.md`) and starter files, exactly as every agent received them.
- One directory per submission, named by a random letter ({LETTERS}). Each is that agent's finished task directory. Model names and paths have been replaced with `[model id removed]` and `/work`.
- `OBJECTIVE_CHECKS.json`: facts computed beforehand, per letter. Depending on the task these are hidden contract test results, the submission's own test results, approximate word/sentence counts, headless-browser checks (horizontal overflow, console errors, remote requests) and a cross-test matrix (each submission's tests run against every implementation and against the original template). A `process_note` records how the submission was produced (for example work outside its task directory or network use, both forbidden by the run's rules); treat it as part of the record.
- For frontend tasks: `<letter>-desktop.png`, `<letter>-mobile.png` and `-full` variants (1440 px and 390 px wide).

## Rules

- Grade only from this folder. If you start a server or any other background process, stop it before you finish. Do not read anything else on the filesystem (in particular nothing under `/home/arda/projects/agent-evaluation` or any other agent-eval directory), do not use the network, and do not try to work out which model wrote which submission.
- Never modify the submission directories. Copy what you need into `{BLIND}/_work/{TASK}/` and run things there.
- Verify claims yourself rather than trusting RESPONSE.md. Examples: run each suite; write a harness or reference implementation and probe edge cases; mutation-test the submissions' own tests where it is cheap; render or lint configs where a tool is available (`docker compose config` on a copy with dummy secrets works; no containers may be started); count limits; check facts in prose against the provided source files; for frontends open each page with Playwright and use it at 1440 px and 390 px (main task flow, empty/edge states, keyboard focus, labels). Playwright: `NODE_PATH={TOOLS}/node_modules node script.js`, launching with `chromium.launch({ executablePath: '/usr/sbin/google-chrome-stable' })`; serve the folder with `python3 -m http.server` on 127.0.0.1 if a page needs http.

## Rubric

Every task is scored out of 10. Scores are comparative across the submissions but anchored to the task contract: a polished answer that misses a required deliverable cannot receive full credit. This task's criteria and maxima:

{RUBRIC}

Score each criterion in steps of 0.25, never above its maximum. The total is the sum of the criteria.

## Output

Write `{SCORES}/{TASK}.json`, valid JSON, with exactly this shape:

```json
{
  "submissions": {
    "A": {
      "criteria": { {CRITERIA_EXAMPLE} },
      "total": 0,
      "summary": "2-4 sentences: what it is and the judgement behind the score",
      "strengths": ["specific, checkable points"],
      "weaknesses": ["specific, checkable points"],
      "evidence": ["what you ran or read and what it showed: file:line, quotes, command results"]
    }
  },
  "ranking": ["letters, best first, every letter exactly once"],
  "notes": "Close calls and tie-breaks, cross-cutting observations, and what you could not verify."
}
```

Include every letter. Criterion names must match the rubric exactly. When finished, validate the file with `python3 -m json.tool` and reply with one line per letter (`A 8.75`) plus one sentence on the closest call.
