## Results

Scores come from the latest blind pass, which graded all eleven models together (2026-10-04, after MiniMax M3.1 Flash and MiniMax M3 were added). Grok 4.7's task 13 stopped when its usage balance ran out and awaits a re-run, so Grok is compared on its **average per task** over 12 tasks.

| | Avg / task | Code | Writing | Ops | Frontend | Time | Cost / usage |
|---|---|---|---|---|---|---|---|
| **Sonnet 5.5** (extra) | **9.31** | **9.50** | 9.25 | **9.50** | **9.00** | ~28 min | $15 |
| **Fable 5.1** (extra) | 8.96 | 9.44 | 8.62 | 9.00 | 8.75 | ~49 min | $53 |
| **Opus 5.5** (high) | 8.96 | 9.31 | **9.31** | 8.25 | 8.50 | ~21 min | $14 |
| **Grok 4.7** (xhigh), 12 tasks | 8.67 | 9.12 | 7.69 | 9.38 | **9.00** | ~80 min | $6.74 |
| **GPT-6 Astra** (xhigh) | 8.60 | 9.19 | 8.69 | 9.12 | 7.33 | ~35 min | 3.6M in / 185k out tokens |
| **GPT-6.1 Sol** (xhigh) | 8.52 | 9.00 | 8.50 | 8.88 | 7.67 | ~48 min | 5.8M in / 243k out tokens |
| **muse** (max) | 7.21 | 6.88 | 7.25 | 8.12 | 7.00 | ~20 min | 6.2M in / 162k out tokens |
| **GPT-6 Luna** (max) | 7.10 | 7.00 | 7.50 | 7.50 | 6.42 | ~34 min | 3.5M in / 220k out tokens |
| **mimo** | 6.92 | 7.50 | 7.06 | 6.75 | 6.08 | not recorded | not recorded |
| **MiniMax M3.1 Flash** (xhigh, mcode) | 6.81 | 7.56 | 5.94 | 6.38 | 7.25 | ~42 min | 0.58M in + 18.6M cache-read / 398k out tokens; free preview |
| **MiniMax M3** (default, mcode) | 5.52 | 5.62 | 5.19 | 5.50 | 5.83 | ~9 min | 0.55M in + 4.8M cache-read / 190k out tokens; 2% of a 5-hour window |

Totals (of 130): Sonnet 121.0, Fable 116.5, Opus 116.5, Astra 111.75, Sol 110.75, muse 93.75, Luna 92.25, mimo 90.0, MiniMax M3.1 Flash 88.5, MiniMax M3 71.75; Grok 104.0 of 120.

### What was observed

- **Every model completed every task it ran.** Every model passed the hidden contract tests for task 01. For task 02, all but MiniMax M3.1 Flash passed: its `get` raises on an expired entry but leaves it in the map, so `len()` still counts it (`test_expiry_boundary_removes_entry`). No frontend page scrolled sideways at 390 px or made a network request. Three runs were interrupted by something other than the model: Astra's tasks 10–13 (quota; re-run from the template on another account), Grok's task 13 (usage balance; to be re-run) and MiniMax M3.1 Flash's task 11 (killed by the orchestrator's own job limit; re-run from the template).
- **Sonnet 5.5 is first in every grading pass so far** (4-way, 5-way, 6-way, 9-way, 10-way, 11-way). In this pass it had the best or tied-best score on 7 of 13 tasks; Fable and Opus on 4 each, Grok on 3, Astra on 2, Sol on 1 (ties counted for each).
- **Four tiers:**
  - **Claude models:** 9.0–9.3 per task.
  - **GPT-6 Astra, GPT-6.1 Sol and Grok 4.7:** 8.5–8.7.
  - **muse, GPT-6 Luna, mimo and MiniMax M3.1 Flash:** 6.8–7.2.
  - **MiniMax M3:** 5.5.
- **Grading repeatability.** Between the ten-way and eleven-way passes, per-task scores for the same submissions moved by 0.36 points on average, and 11 of 129 moved by a point or more; every model's average moved by 0.1 or less except muse (+0.29). The order changed only where models were close: Fable drew level with Opus, and muse moved past Luna.
- **GPT-6 Astra** was the most consistent non-Claude model on code and writing: 10 on the bug fix and 8.75 on the story (07). Its weak spot was frontend (7.33 average).
- **GPT-6.1 Sol** scored 7–10. The graders found its pages and prose competent but generic.
- **Grok 4.7** scored very unevenly:
  - **Strong:** code (9.75 on 01, 10 on 02), operations (9.38, second only to Sonnet) and frontend (9.0, tied with Sonnet).
  - **Weak:** social media (6.5) and its story (8.0).
  - **Cost and speed:** by far the cheapest in dollars ($6.74 for 12 tasks), and by far the slowest (80 min).
- **MiniMax M3.1 Flash** (mcode, xhigh) ranks with the lower tier, 0.11 behind mimo:
  - **Best:** product planning (06: 8.75), feature building (01: 8.5) and bug fixing (02: 8.25); its frontends average 7.25, above Luna, muse's and mimo's.
  - **Weakest:** writing (5.94): technical writing 4.25, the story 4.5, social media 6.25, mostly for inventing facts the brief didn't give, the same failure mode as Luna, muse and mimo.
  - **Run:** 42 min 16 s; 0.58M input + 18.6M cache-read + 398k output tokens. As a preview it was free: the Token Plan's counters didn't move.
- **MiniMax M3** (mcode) is last by a wide margin, 1.3 points below M3.1 Flash:
  - **Effort:** mcode doesn't let M3's reasoning effort be chosen, so it ran at its fixed default while M3.1 Flash ran on xhigh. It finished in 8 min 49 s with about a quarter of Flash's cache-read tokens, which looks like much shallower work per task.
  - **Last on 7 of 13 tasks** (01, 03, 05, 08, 09, 10, 12). Feature building (01: 4.75) has a real contract bug the hidden tests miss: a repeated dependency entry emits the dependent twice, giving false cycle errors or an invalid plan. Infrastructure (03: 3.5) leaves Redis unauthenticated and builds from a directory that doesn't exist. The playful frontend's task logic is broken (13: 5.0). The writing invents product facts (08: 4.75) and drops the brief's Guarantee/Recommendation labels (05: 4.0).
  - **Best:** the bug fix (02: 8.75) and product planning (06: 6.5).
  - **Usage:** M3 is billed, unlike the Flash preview: about 2% of a 5-hour Token Plan window, with the weekly window unchanged.
- **GPT-6 Luna, muse and mimo** repeat the failures seen in earlier passes:
  - packages that don't build (04);
  - invented facts in writing;
  - thin test suites;
  - generic frontends with real bugs;
  - mimo's recursive cycle check crashing on large inputs (01).

### What is inferred

- Within the Claude tier and within the GPT/Grok tier, gaps are small enough that another run could reorder models on a given work type. The gaps between the tiers are well beyond grading noise.
- Opus 5.5 on extra effort might score higher. This run can't say.
- MiniMax M3.1 Flash's strength on structured work (planning, code, dashboards) against its weakness on factual discipline in prose fits the lower tier's pattern rather than a new one.
- MiniMax M3 scoring 1.3 points below M3.1 Flash is mostly an effort effect, not proof the larger model is weaker: Flash ran on xhigh, M3 on a default mcode won't change, and M3 finished in a fifth of the time with a quarter of the cache-read tokens. Through mcode as it stands, though, M3 is the weaker choice.
- Quota "hunger" depends on the account's plan as much as the model. Astra drained a 5-hour window on one account and used 3% of the weekly quota on another for similar token counts.

## Recommendations by work type

- **Code:** Sonnet 5.5, Fable 5.1 or Opus 5.5. Astra and Grok are close behind; Grok's code was excellent when it worked, and cheapest.
- **Writing and planning:** Opus 5.5 or Sonnet 5.5. Astra is the best non-Claude choice. Avoid Grok for customer-facing copy.
- **Incident analysis and operations:** Sonnet 5.5. Grok and Astra are strong alternatives on evidence handling.
- **Frontend:** Sonnet 5.5. Grok 4.7 for dense operational UIs.
- **Cost-sensitive work:** Opus 5.5 or Sonnet 5.5 (about $0.12 per point) if you pay per dollar. Grok 4.7 is cheaper still ($6.74 for 12 tasks) but slow and uneven.
- **muse, GPT-6 Luna, mimo and the MiniMax models:** not for unsupervised work on these task types. MiniMax M3.1 Flash is usable as a second opinion on code and plans, not for customer-facing writing; MiniMax M3 at mcode's default effort is not recommended for any of these task types.

## Caveats

- **One run per model and one blind grader per task per pass.** The graders were Claude Opus 5.5 subagents, so three contestants share its model family and one is the same model. Blinding reduces that bias but doesn't remove it: random letters per task, and names, paths and model IDs removed. Opus did not come out on top.
- **Effort levels differ:**
  - Sonnet and Fable ran on extra, and Opus on high.
  - The GPT and Grok models ran on xhigh, except Luna, which ran on max.
  - muse ran on max, and mimo on its default.
- **Different setups:**
  - The Claude models ran in Claude Code's cloud.
  - The GPT models ran in Codex CLI and Grok in Grok CLI, both on this Mac, with personal instructions and memory kept out.
  - muse ran through tincan, and mimo a week earlier on cachyos.
  - The MiniMax models ran through mcode on this Mac in the normal HOME (mcode refuses a clean one): no personal instruction files reached them, but the user's skills did, as for muse. M3.1 Flash ran on xhigh; M3's effort can't be chosen in mcode, so it ran on its default.
- **Cost figures aren't comparable across providers.** Claude figures come from account balances, Grok's from its CLI, and GPT, muse and MiniMax report tokens (and GPT quota) only.
- **Not checked:** ruff lint results in task 04, and nginx syntax in task 03 (no nginx binary was available). No containers were started.
