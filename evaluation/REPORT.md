## Results

Scores come from the latest blind pass, which graded all fourteen models together (2026-10-11, after Gemini 3.1 Pro and Gemini 3.8 Flash were added). Task 11 was graded a second time, by a fresh grader, after Gemini 3.1 Pro's re-run (see below). Grok 4.7's task 13 stopped when its usage balance ran out and awaits a re-run, so Grok is compared on its **average per task** over 12 tasks.

| | Avg / task | Code | Writing | Ops | Frontend | Time | Cost / usage |
|---|---|---|---|---|---|---|---|
| **Sonnet 5.5** (extra) | **9.38** | 9.31 | 9.44 | **9.62** | **9.25** | ~28 min | $15 |
| **Fable 5.1** (extra) | 9.25 | **9.44** | 9.31 | 9.25 | 8.92 | ~49 min | $53 |
| **Opus 5.5** (high) | 9.19 | **9.44** | **9.50** | 8.88 | 8.67 | ~21 min | $14 |
| **Grok 4.7** (xhigh), 12 tasks | 8.67 | 9.12 | 8.19 | 8.38 | 9.00 | ~80 min | $6.74 |
| **GPT-6 Astra** (xhigh) | 8.60 | 9.00 | 8.44 | 8.62 | 8.25 | ~35 min | 3.6M in / 185k out tokens |
| **Haiku 5.5** (xhigh) | 8.50 | 8.12 | 8.94 | 8.62 | 8.33 | ~34 min | $1.74 API-equivalent (subscription) |
| **GPT-6.1 Sol** (xhigh) | 8.48 | 8.62 | 8.38 | 8.50 | 8.42 | ~48 min | 5.8M in / 243k out tokens |
| **muse** (max) | 7.42 | 6.69 | 7.31 | 7.88 | 8.25 | ~20 min | 6.2M in / 162k out tokens |
| **GPT-6 Luna** (max) | 7.38 | 7.00 | 7.81 | 7.75 | 7.08 | ~34 min | 3.5M in / 220k out tokens |
| **mimo** | 7.19 | 7.56 | 7.44 | 6.25 | 7.00 | not recorded | not recorded |
| **MiniMax M3.1 Flash** (xhigh, mcode) | 7.13 | 7.44 | 6.38 | 6.38 | 8.25 | ~42 min | 0.58M in + 18.6M cache-read / 398k out tokens; free preview |
| **Gemini 3.1 Pro** (high, agy) | 5.98 | 6.31 | 5.81 | 5.62 | 6.00 | ~27 min | 1.56M in + 7.45M cache-read / 530k out tokens |
| **Gemini 3.8 Flash** (high, agy) | 5.94 | 6.50 | 6.19 | 6.12 | 4.75 | ~22 min | 2.35M in + 16.1M cache-read / 512k out tokens |
| **MiniMax M3** (default, mcode) | 5.90 | 5.81 | 5.88 | 5.12 | 6.58 | ~9 min | 0.55M in + 4.8M cache-read / 190k out tokens; 2% of a 5-hour window |

Totals (of 130): Sonnet 122.0, Fable 120.25, Opus 119.5, Astra 111.75, Haiku 110.5, Sol 110.25, muse 96.5, Luna 96.0, mimo 93.5, MiniMax M3.1 Flash 92.75, Gemini 3.1 Pro 77.75, Gemini 3.8 Flash 77.25, MiniMax M3 76.75; Grok 104.0 of 120.

### What was observed

- **Every model completed every task it ran.**
  - **Hidden contract tests:** every model passed them for task 01. For task 02, all but MiniMax M3.1 Flash and Haiku 5.5 passed. Both fail `test_expiry_boundary_removes_entry`: their `get` raises on an expired entry but leaves it in the map, so `len()` still counts it.
  - **Frontends:** no page scrolled sideways at 390 px or made a network request.
  - **Interruptions not caused by the model** (each re-run once from the template with the identical command):
    - Astra's tasks 10–13 (quota; re-run on another account).
    - Grok's task 13 (usage balance; still to be re-run).
    - MiniMax M3.1 Flash's task 11 (killed by the orchestrator's own job limit).
    - Gemini 3.1 Pro's task 11. agy ended the session when the model tried to read a file outside the workspace: headless mode can't prompt for that permission, so it auto-denies it and stops with no output, which left no RESPONSE.md. This was found after grading, so task 11 was re-graded on its own by a fresh blind grader. The re-run scored 6.0, the same as the cut-off attempt.
  - Haiku's first launch was stopped by the orchestrator after 30 seconds over headless permission prompts and relaunched clean before any task finished.
- **Sonnet 5.5 is first in every grading pass so far** (4-way through 14-way). In this pass it had the best or tied-best score on 8 of 13 tasks; Opus on 7, Fable on 3, and Astra and Grok on 1 each (ties counted for each).
- **Four tiers:**
  - **Sonnet, Fable and Opus:** 9.2–9.4 per task.
  - **Grok 4.7, GPT-6 Astra, Haiku 5.5 and GPT-6.1 Sol:** 8.5–8.7.
  - **muse, GPT-6 Luna, mimo and MiniMax M3.1 Flash:** 7.1–7.4.
  - **Gemini 3.1 Pro, Gemini 3.8 Flash and MiniMax M3:** 5.9–6.0.
- **Grading repeatability:**
  - **Per task:** between the twelve-way and fourteen-way passes, scores for the same submissions moved by 0.47 points on average, and 25 of 155 moved by a point or more. Task 11 was graded twice in this pass by independent graders, and on the 13 unchanged submissions they differ by 0.37 on average.
  - **GPT models:** the twelve-way pass had the GPT models 0.27–0.37 lower than the eleven-way pass. This pass reversed that: Astra is back at 8.60 and Sol at 8.48, and Luna rose 0.65. So that dip was grading noise.
  - **Claude models:** Sonnet, Fable and Opus have stayed 0.07–0.29 above their eleven-way averages in both passes since the grader brief was rewritten.
  - **Ranking:** Astra moved back above Haiku and Sol, and Luna moved back above mimo and M3.1 Flash.
- **Gemini 3.1 Pro and Gemini 3.8 Flash** (Antigravity CLI, high) land at the bottom with MiniMax M3, 1.1–1.2 points below the lower tier. This is not a single failure: neither scored above 7.5 on any task except the bug fix (9.5 each) and Flash's dashboard (11: 8.0).
  - **Code:**
    - Both packaged the library so it can't be built, and both changed `normalize_version`'s output while their changelogs claim it is preserved (04: 3.75 and 4.0; Pro last).
    - Both left Redis unauthenticated and let the database password default to empty (03: 4.75 and 5.0).
    - Both cycle checks are recursive and crash on a 1,000-job cycle (01: 7.25 and 7.5).
  - **Writing:**
    - Their social posts invent support emails, menus and data-policy promises (08: 4.75 and 5.25; Pro last).
    - Both incident reports treat correlation as proof (09: 5.25 and 5.75).
    - Both plans purge data only once the 24-hour deadline has passed, late by construction (06: 6.0 each).
  - **Frontend:**
    - Flash's playful page is broken on load: CSS overrides `[hidden]`, so a dialog nobody can dismiss blocks the page (13: 2.0, last).
    - Flash's editorial page wraps its masthead and loses the email confirmation (12: 4.25, last).
    - Pro's pages are busy and pad the brief with invented content (11: 6.0, last; 12: 6.25; 13: 5.75).
  - **Run:** fast. Pro took 17 min plus a 10-min re-run of task 11; Flash took 22 min. agy reports tokens but no cost.
- **Haiku 5.5** is sixth, 0.10 behind Astra and just ahead of Sol:
  - **Best:** planning (06: 9.5), social media (08: 9.25, second), incident analysis (09: 9.0) and writing overall (8.94).
  - **Weakest:** maintenance (04: 6.5; its package can't be built) and the playful frontend (13: 7.75).
- **GPT-6 Astra and GPT-6.1 Sol** scored 7.75–10, strong on the bug fix (02: 10 and 9.75). The graders found their pages and prose competent but generic.
- **Grok 4.7** is strong on code (9.25 on 01, 10 on 02) and frontend (9.0), and weak on social media (7.0). It is among the cheapest in dollars ($6.74 for 12 tasks) and by far the slowest (80 min).
- **MiniMax M3.1 Flash** (mcode, xhigh) shares the lower tier's best frontend average with muse (8.25; 11: 9.25) and solid planning (06: 9.0) and feature building (01: 8.75). It has the weakest writing outside the bottom tier (6.38): the story and the technical guide are last (07: 5.0, 05: 4.75), mostly for inventing facts the brief didn't give. It also fails a hidden bug-fix test (02: 8.25, tied last).
- **MiniMax M3** (mcode, default effort) is last, 0.04–0.08 behind the two Gemini models:
  - **Last on 5 of 13 tasks:** 01, 02 (tied), 03, 09 and 10 (tied). Infrastructure (03: 3.5) leaves Redis unauthenticated and builds from a directory that doesn't exist.
  - **Effort:** mcode doesn't let M3's effort be chosen, and it finished in 8 min 49 s with a quarter of Flash's cache-read tokens.
  - **Process lapses**, both in the graders' process notes:
    - **Task 04:** it used the network to pip-install `build`, `twine`, `ruff` and their dependencies into the user's Python environment.
    - **Task 03:** it wrote a copy of its `.env.example` outside its repository.
- **GPT-6 Luna, muse and mimo** repeat the failures seen in earlier passes:
  - packages that don't build (04);
  - invented facts in writing;
  - thin test suites;
  - generic frontends with real bugs;
  - mimo's recursive cycle check crashing on large inputs (01).

### What is inferred

- Within the top tier and within the middle tier, gaps are small enough that another run, or another grading pass, could reorder models on a given work type. Model averages have moved up to ±0.3 between passes (0.65 once), and the middle tier spans only 0.19. The gaps between the tiers are well beyond grading noise.
- The Gemini results describe Gemini **through the Antigravity CLI in headless mode**, on one run each. They don't settle how good the models are in general.
  - **What may have hurt them:** agy's sandbox stopped them from opening a browser to check their own pages, and its headless mode ends a session outright on a permission it can't prompt for.
  - **What it can't explain:** the same harness ran their non-frontend tasks, where they mostly scored 1–4 points below the middle tier (the bug fix is the exception), and the main failures (invented facts, unsafe defaults, unbuildable packages) don't depend on a browser.
- Haiku 5.5 belongs in the middle tier with Grok, Astra and Sol; its exact place within it isn't stable across passes.
- Opus 5.5 on extra effort might score higher. This run can't say.
- MiniMax M3's score is mostly an effort effect. Flash ran on xhigh and M3 on a default mcode won't change. Through mcode as it stands, though, M3 is the weaker choice.
- Quota "hunger" depends on the account's plan as much as the model. Astra drained a 5-hour window on one account and used 3% of the weekly quota on another for similar token counts.

## Recommendations by work type

- **Code:** Sonnet 5.5, Fable 5.1 or Opus 5.5. Grok and Astra are close behind; Grok's code was excellent when it worked, and cheap.
- **Writing and planning:** Opus 5.5 or Sonnet 5.5. Haiku 5.5 is the best choice outside the top three (8.94 on writing). Avoid Grok for customer-facing copy.
- **Incident analysis and operations:** Sonnet 5.5. Fable, Opus, Haiku and Astra are good alternatives.
- **Frontend:** Sonnet 5.5; Grok 4.7 for dense operational UIs.
- **Cost-sensitive work:** Haiku 5.5. It reached the middle tier for $1.74 at API prices (about $0.016 per point), roughly an eighth of what Sonnet or Opus cost (about $0.12 per point), and it isn't slow. Sonnet 5.5 is still the best value if quality matters most. Grok 4.7 ($6.74 for 12 tasks) is slow and uneven.
- **Gemini 3.1 Pro and Gemini 3.8 Flash through agy:** not for unsupervised work on these task types as run here, in particular customer-facing writing, infrastructure and release work.
- **muse, GPT-6 Luna, mimo and the MiniMax models:** not for unsupervised work on these task types. MiniMax M3.1 Flash is usable as a second opinion on code, plans and dashboards, not for customer-facing writing. MiniMax M3 at mcode's default effort is not recommended for any of these task types.

## Caveats

- **One run per model and one blind grader per task per pass** (task 11 twice in this pass). The graders were Claude Opus 5.5 subagents, so four contestants share its model family and one is the same model. Blinding reduces that bias but doesn't remove it: random letters per task, and names, paths and model IDs removed. Opus did not come out on top. Since the grader brief was rewritten for the twelve-way pass (`tools/grader-prompt.md`; the original wasn't kept), the Claude models' averages have been 0.07–0.29 higher than in the eleven-way pass, while the GPT and Grok models are back at their earlier levels.
- **Effort levels differ:**
  - Sonnet and Fable ran on extra, Opus on high and Haiku on xhigh (the CLI's name for extra).
  - The GPT and Grok models ran on xhigh, except Luna, which ran on max.
  - The Gemini models ran on agy's High variants with `--effort high`. Those are the highest settings agy offers for them.
  - muse ran on max, and mimo on its default.
- **Different setups:**
  - Sonnet, Fable and Opus ran in Claude Code's cloud.
  - Haiku ran headless through the Claude Code CLI on cachyos, and the Gemini models headless through the Antigravity CLI on cachyos. Both used fresh repositories outside the home directory, with no personal instructions, memory, plugins or MCP, and sandboxed terminals with no network. agy's sandbox also blocked headless browsers, so the Gemini models couldn't screenshot their own pages; Haiku's could.
  - The GPT models ran in Codex CLI and Grok in Grok CLI, both on this Mac, with personal instructions and memory kept out.
  - muse ran through tincan, and mimo a week earlier on cachyos.
  - The MiniMax models ran through mcode on this Mac in the normal HOME (mcode refuses a clean one): no personal instruction files reached them, but the user's skills did, as for muse.
- **Cost figures aren't comparable across providers.** The cloud Claude figures come from account balances. Haiku's is the CLI's API-equivalent figure for a subscription run. Grok's comes from its CLI, and GPT, muse, MiniMax and Gemini report tokens (and GPT quota) only.
- **Objective checks for earlier models are carried over** from their original runs on the Mac. On cachyos, task-04 suites that import `packaging` (muse, M3, both Gemini models) need it installed. The Gemini models' were run in a scratch venv with it, where muse and M3 reproduce their Mac results.
- **Not checked:** ruff lint results in task 04, and nginx syntax in task 03 (no nginx binary was available). No containers were started.
