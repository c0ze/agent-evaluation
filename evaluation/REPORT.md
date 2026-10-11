## Results

Scores come from the latest blind pass, which graded all twelve models together (2026-10-11, after Haiku 5.5 was added). Grok 4.7's task 13 stopped when its usage balance ran out and awaits a re-run, so Grok is compared on its **average per task** over 12 tasks.

| | Avg / task | Code | Writing | Ops | Frontend | Time | Cost / usage |
|---|---|---|---|---|---|---|---|
| **Sonnet 5.5** (extra) | **9.42** | **9.56** | **9.25** | **9.62** | **9.33** | ~28 min | $15 |
| **Fable 5.1** (extra) | 9.21 | 9.38 | 9.12 | 9.50 | 8.92 | ~49 min | $53 |
| **Opus 5.5** (high) | 9.19 | 9.44 | **9.25** | 9.25 | 8.75 | ~21 min | $14 |
| **Grok 4.7** (xhigh), 12 tasks | 8.62 | 9.25 | 8.00 | 8.75 | 8.50 | ~80 min | $6.74 |
| **Haiku 5.5** (xhigh) | 8.54 | 8.44 | 8.75 | 8.62 | 8.33 | ~34 min | $1.74 API-equivalent (subscription) |
| **GPT-6 Astra** (xhigh) | 8.31 | 8.50 | 8.38 | 8.38 | 7.92 | ~35 min | 3.6M in / 185k out tokens |
| **GPT-6.1 Sol** (xhigh) | 8.25 | 8.44 | 8.19 | 8.00 | 8.25 | ~48 min | 5.8M in / 243k out tokens |
| **muse** (max) | 7.27 | 6.62 | 7.00 | 8.25 | 7.83 | ~20 min | 6.2M in / 162k out tokens |
| **MiniMax M3.1 Flash** (xhigh, mcode) | 7.17 | 7.56 | 6.38 | 6.75 | 8.00 | ~42 min | 0.58M in + 18.6M cache-read / 398k out tokens; free preview |
| **mimo** | 7.08 | 7.75 | 7.31 | 6.38 | 6.33 | not recorded | not recorded |
| **GPT-6 Luna** (max) | 6.73 | 6.62 | 7.31 | 6.25 | 6.42 | ~34 min | 3.5M in / 220k out tokens |
| **MiniMax M3** (default, mcode) | 5.73 | 6.00 | 5.31 | 5.75 | 5.92 | ~9 min | 0.55M in + 4.8M cache-read / 190k out tokens; 2% of a 5-hour window |

Totals (of 130): Sonnet 122.5, Fable 119.75, Opus 119.5, Haiku 111.0, Astra 108.0, Sol 107.25, muse 94.5, MiniMax M3.1 Flash 93.25, mimo 92.0, Luna 87.5, MiniMax M3 74.5; Grok 103.5 of 120.

### What was observed

- **Every model completed every task it ran.** Every model passed the hidden contract tests for task 01. For task 02, all but MiniMax M3.1 Flash and Haiku 5.5 passed. Both fail the same test, `test_expiry_boundary_removes_entry`: their `get` raises on an expired entry but leaves it in the map, so `len()` still counts it. No frontend page scrolled sideways at 390 px or made a network request. Three runs were interrupted by something other than the model: Astra's tasks 10–13 (quota; re-run from the template on another account), Grok's task 13 (usage balance; to be re-run) and MiniMax M3.1 Flash's task 11 (killed by the orchestrator's own job limit; re-run from the template). Haiku's first launch was stopped by the orchestrator after 30 seconds over headless permission prompts and relaunched clean from the template before any task finished.
- **Sonnet 5.5 is first in every grading pass so far** (4-way, 5-way, 6-way, 9-way, 10-way, 11-way, 12-way). In this pass it had the best or tied-best score on 10 of 13 tasks; Opus on 6, Fable on 3, Grok on 2, Haiku and Sol on 1 each (ties counted for each).
- **Four tiers:**
  - **Sonnet, Fable and Opus:** 9.2–9.4 per task.
  - **Grok 4.7, Haiku 5.5, GPT-6 Astra and GPT-6.1 Sol:** 8.25–8.62.
  - **muse, MiniMax M3.1 Flash, mimo and GPT-6 Luna:** 6.7–7.3.
  - **MiniMax M3:** 5.7.
- **Grading repeatability was worse this pass:**
  - **Per task:** between the eleven-way and twelve-way passes, scores for the same submissions moved by 0.50 points on average (0.36 last time), and 29 of 142 moved by a point or more.
  - **Per model:** averages moved in a pattern. Sonnet, Fable and Opus went up 0.12–0.25, and Astra, Sol and Luna went down 0.27–0.37. M3.1 Flash went up 0.37; Grok, muse, mimo and M3 moved by 0.21 or less.
  - **Ranking:** Fable moved just ahead of Opus (9.21 against 9.19). M3.1 Flash moved past mimo, and both moved past Luna.
  - **Setup differed:** this pass ran on a different machine (cachyos rather than the Mac). Its grader brief was rewritten from the rubric and the earlier score files, because the original brief wasn't kept. The new one is in `tools/grader-prompt.md`.
- **Haiku 5.5** (xhigh, Claude Code CLI) is fifth on average per task, 0.08 behind Grok and just ahead of Astra and Sol. It is far below the larger Claude models (0.65–0.88).
  - **Best:**
    - Product planning (06: 9.5, second).
    - Infrastructure (03: 8.75, tied first with Sonnet): the most complete runbook of the twelve.
    - Feature building (01: 9.25): its tests killed every mutant the grader tried.
    - Incident analysis (09: 9.25).
    - The playful frontend (13: 9.0), which had the cleanest measured accessibility.
    - Its writing average (8.75) beats Grok's, Astra's and Sol's.
  - **Weakest:**
    - Maintenance (04: 7.0): like four others, it didn't declare `py-modules`, so the package can't be built and both CI jobs fail.
    - The operations dashboard (11: 7.75): plain, with a sparse detail panel.
    - Scheduling (10: 8.0): calls a soft deadline hard and skips a fallback slot.
    - The bug fix (02: 8.75): the hidden-test failure above.
  - **Run:** 34 minutes. Claude Code prices the tokens at $1.74 at API rates (17.7M cache-read, 844k output); the run was on a subscription, so nothing was charged. Task 11 took 24 of the 34 minutes testing its own page in headless Firefox.
- **GPT-6 Astra and GPT-6.1 Sol** scored 6.5–10. Both are strong on code fixes (02: 9.75 and 10) and weak on infrastructure (03: 7.0 and 6.5). The graders found their pages and prose competent but generic.
- **Grok 4.7** scored very unevenly:
  - **Strong:** code (9.75 on 01, 10 on 02) and operations (9.0 on incident analysis).
  - **Weak:** social media (6.75), the lowest of the top seven.
  - **Cost and speed:** among the cheapest in dollars ($6.74 for 12 tasks), and by far the slowest (80 min).
- **MiniMax M3.1 Flash** (mcode, xhigh) is second in the lower tier this pass, 0.10 behind muse:
  - **Best:** feature building (01: 9.0), product planning (06: 8.75) and the operations dashboard (11: 8.75); its frontends average 8.0, above muse, mimo and Luna.
  - **Weakest:** writing (6.38): the story 4.75 (last), technical writing 5.75 and social media 6.25, mostly for inventing facts the brief didn't give. That is the same failure mode as Luna, muse and mimo. It also fails a hidden test in the bug fix (02: 8.0, last).
  - **Run:** 42 min 16 s; 0.58M input + 18.6M cache-read + 398k output tokens. As a preview it was free: the Token Plan's counters didn't move.
- **MiniMax M3** (mcode) is last by a wide margin, 1.4 points below M3.1 Flash:
  - **Effort:** mcode doesn't let M3's reasoning effort be chosen, so it ran at its fixed default while M3.1 Flash ran on xhigh. It finished in 8 min 49 s with about a quarter of Flash's cache-read tokens, which looks like much shallower work per task.
  - **Last on 8 of 13 tasks** (01, 03, 05, 08, 09, 10, 11, 12). Feature building (01: 6.25) mishandles a job that lists the same dependency twice: valid input is rejected as a cycle, which the hidden tests miss. Infrastructure (03: 3.5) leaves Redis unauthenticated and builds from a directory that doesn't exist. The writing invents product facts (08: 4.25) and drops the brief's Guarantee/Recommendation labels (05: 4.75).
  - **Best:** the bug fix (02: 8.5) and the playful frontend (13: 6.75).
  - **Usage:** M3 is billed, unlike the Flash preview: about 2% of a 5-hour Token Plan window, with the weekly window unchanged.
  - **Process lapses** were found after the eleven-way grading, so that pass's graders didn't see them. This pass's graders did, as process notes.
    - **Task 04:** it used the network to pip-install `build`, `twine`, `ruff` and their dependencies (24 packages, plus an editable install of its own package) into the user's Python environment, to run the checks it reports. The brief forbids network use and work outside the task directory.
    - **Task 03:** it wrote a copy of its `.env.example` outside its repository (a mistyped path); the deliverable was unaffected.
- **GPT-6 Luna, muse and mimo** repeat the failures seen in earlier passes:
  - packages that don't build (04);
  - invented facts in writing;
  - thin test suites;
  - generic frontends with real bugs;
  - mimo's recursive cycle check crashing on large inputs (01).

### What is inferred

- Within the top tier and within the middle tier, gaps are small enough that another run could reorder models on a given work type. This pass's shifts (±0.3 for some models between passes) show that. The gaps between the tiers are well beyond grading noise.
- Haiku 5.5 belongs in the middle tier with Grok, Astra and Sol, not above them. Its 0.23–0.29 lead over Astra and Sol is smaller than how far those two moved between passes.
- Opus 5.5 on extra effort might score higher. This run can't say.
- MiniMax M3.1 Flash's strength on structured work (planning, code, dashboards) against its weakness on factual discipline in prose fits the lower tier's pattern rather than a new one.
- MiniMax M3 scoring 1.4 points below M3.1 Flash is mostly an effort effect, not proof the larger model is weaker. Flash ran on xhigh and M3 on a default mcode won't change, and M3 finished in a fifth of the time with a quarter of the cache-read tokens. Through mcode as it stands, though, M3 is the weaker choice.
- Quota "hunger" depends on the account's plan as much as the model. Astra drained a 5-hour window on one account and used 3% of the weekly quota on another for similar token counts.

## Recommendations by work type

- **Code:** Sonnet 5.5, Opus 5.5 or Fable 5.1. Grok is close behind; its code was excellent when it worked, and cheap.
- **Writing and planning:** Sonnet 5.5 or Opus 5.5. Haiku 5.5 is the best choice outside the top three (8.75 on writing). Avoid Grok for customer-facing copy.
- **Incident analysis and operations:** Sonnet 5.5 or Fable 5.1. Haiku and Grok are good alternatives on evidence handling.
- **Frontend:** Sonnet 5.5.
- **Cost-sensitive work:** Haiku 5.5. It reached the middle tier for $1.74 at API prices (about $0.016 per point), roughly an eighth of what Sonnet or Opus cost (about $0.12 per point), and it isn't slow. Sonnet 5.5 is still the best value if quality matters most. Grok 4.7 ($6.74 for 12 tasks) is slow and uneven.
- **muse, GPT-6 Luna, mimo and the MiniMax models:** not for unsupervised work on these task types. MiniMax M3.1 Flash is usable as a second opinion on code and plans, not for customer-facing writing. MiniMax M3 at mcode's default effort is not recommended for any of these task types.

## Caveats

- **One run per model and one blind grader per task per pass.** The graders were Claude Opus 5.5 subagents, so four contestants share its model family and one is the same model. Blinding reduces that bias but doesn't remove it: random letters per task, and names, paths and model IDs removed. Opus did not come out on top. This pass, though, the Claude models' averages rose and the GPT models' fell. It ran with a rewritten grader brief on a different machine, so a shift in grading cannot be told apart from a family bias.
- **Effort levels differ:**
  - Sonnet and Fable ran on extra, Opus on high and Haiku on xhigh (the CLI's name for extra).
  - The GPT and Grok models ran on xhigh, except Luna, which ran on max.
  - muse ran on max, and mimo on its default.
- **Different setups:**
  - Sonnet, Fable and Opus ran in Claude Code's cloud. Haiku ran headless through the Claude Code CLI on cachyos, in a fresh repository outside the home directory, with no CLAUDE.md, memory, plugins, hooks or MCP, and with Bash sandboxed with no network.
  - The GPT models ran in Codex CLI and Grok in Grok CLI, both on this Mac, with personal instructions and memory kept out.
  - muse ran through tincan, and mimo a week earlier on cachyos.
  - The MiniMax models ran through mcode on this Mac in the normal HOME (mcode refuses a clean one): no personal instruction files reached them, but the user's skills did, as for muse. M3.1 Flash ran on xhigh; M3's effort can't be chosen in mcode, so it ran on its default.
- **Cost figures aren't comparable across providers.** The cloud Claude figures come from account balances. Haiku's is the CLI's API-equivalent figure for a subscription run. Grok's comes from its CLI, and GPT, muse and MiniMax report tokens (and GPT quota) only.
- **Objective checks for the earlier models are carried over.** Checks and cross-tests for the eleven earlier models are carried over from their original runs on the Mac. On cachyos two of them differ only because of the environment: muse's and M3's task-04 suites need `packaging`, which isn't installed there, and one cross-test cell is timing-sensitive.
- **Not checked:** ruff lint results in task 04, and nginx syntax in task 03 (no nginx binary was available). No containers were started.
