## Results

Scores come from the latest blind pass, which graded all twenty-four entries together (2026-10-13, after muse-wonder was added). HY4 preview appears twice: once through OpenRouter and opencode, once through CodeBuddy. Grok 4.7's task 13 stopped when its usage balance ran out and awaits a re-run, so Grok is compared on its **average per task** over 12 tasks. Three OpenRouter submissions ran at reduced reasoning effort: Mistral Large 4's tasks 12 and 13, and Qwen 3.8 Max's task 13. Their high-effort attempts produced nothing.

| | Avg / task | Code | Writing | Ops | Frontend | Time | Cost / usage |
|---|---|---|---|---|---|---|---|
| **Sonnet 5.5** (extra) | **9.54** | **9.69** | 9.38 | **9.75** | **9.42** | ~28 min | $15 |
| **Fable 5.1** (extra) | 9.37 | 9.62 | 9.19 | 9.12 | **9.42** | ~49 min | $53 |
| **Opus 5.5** (high) | 9.37 | **9.69** | **9.56** | 8.88 | 9.00 | ~21 min | $14 |
| **Haiku 5.5** (xhigh) | 8.87 | 8.88 | 8.81 | 9.00 | 8.83 | ~34 min | $1.74 API-equivalent (subscription) |
| **Grok 4.7** (xhigh), 12 tasks | 8.73 | 9.56 | 7.62 | 8.50 | 9.50 | ~80 min | $6.74 |
| **GPT-6 Astra** (xhigh) | 8.62 | 8.81 | 8.38 | 9.12 | 8.33 | ~35 min | 3.6M in / 185k out tokens |
| **GPT-6.1 Sol** (xhigh) | 8.60 | 8.81 | 8.06 | 8.88 | 8.83 | ~48 min | 5.8M in / 243k out tokens |
| **Qwen 3.8 Max** (high, OpenRouter) | 8.31 | 8.69 | 8.06 | 8.00 | 8.33 | ~158 session-min | $5.44 |
| **HY4 preview** (high, OpenRouter) | 8.17 | 8.94 | 7.81 | 7.75 | 7.92 | ~113 session-min | $1.57 |
| **muse-wonder** (xhigh) | 8.10 | 7.81 | 8.31 | 8.25 | 8.08 | ~12 min | 6.7M in / 154k out tokens; subscription quota (see `RUN_METRICS.md`) |
| **HY4 preview via CodeBuddy** (high) | 7.96 | 8.12 | 7.81 | 7.88 | 8.00 | ~66 session-min | $0 reported (plan) |
| **Step-5 preview** (high, OpenRouter) | 7.96 | 8.31 | 7.50 | 7.38 | 8.50 | ~69 session-min | $2.21 |
| **muse** (max) | 7.73 | 7.25 | 7.50 | 7.88 | 8.58 | ~20 min | 6.2M in / 162k out tokens |
| **GLM-5.3** (high, OpenRouter) | 7.73 | 7.81 | 7.88 | 7.00 | 7.92 | ~29 min | $1.49 |
| **MiniMax M3.1 Flash** (xhigh, mcode) | 7.63 | 7.94 | 6.88 | 7.38 | 8.42 | ~42 min | 0.58M in + 18.6M cache-read / 398k out tokens; free preview |
| **mimo** | 7.62 | 8.31 | 7.75 | 6.75 | 7.08 | not recorded | not recorded |
| **GPT-6 Luna** (max) | 7.35 | 7.62 | 7.38 | 7.00 | 7.17 | ~34 min | 3.5M in / 220k out tokens |
| **Kimi K3** (high, OpenRouter) | 7.12 | 7.06 | 7.25 | 5.62 | 8.00 | ~14 min | $3.47 |
| **Mistral Large 4** (high; 12–13 reduced) | 6.38 | 7.12 | 5.75 | 5.88 | 6.58 | ~24 min + re-runs | $1.23 |
| **DeepSeek V4 Pro** (high, OpenRouter) | 6.33 | 6.88 | 5.94 | 5.50 | 6.67 | ~12 min | $0.43 |
| **Gemini 3.1 Pro** (high, agy) | 6.23 | 7.00 | 6.31 | 5.25 | 5.75 | ~27 min | 1.56M in + 7.45M cache-read / 530k out tokens |
| **Gemini 3.8 Flash** (high, agy) | 6.15 | 7.19 | 6.06 | 5.38 | 5.42 | ~22 min | 2.35M in + 16.1M cache-read / 512k out tokens |
| **MiniMax M3** (default, mcode) | 6.08 | 6.25 | 5.75 | 5.12 | 6.92 | ~9 min | 0.55M in + 4.8M cache-read / 190k out tokens |
| **Nemotron 3 Ultra** (high, OpenRouter) | 4.71 | 6.19 | 4.19 | 3.75 | 4.08 | ~8 min | $0.76 |

Totals (of 130): Sonnet 124.0, Fable 121.75, Opus 121.75, Haiku 115.25, Astra 112.0, Sol 111.75, Qwen 3.8 Max 108.0, HY4 106.25, muse-wonder 105.25, HY4 via CodeBuddy 103.5, Step-5 preview 103.5, muse 100.5, GLM-5.3 100.5, MiniMax M3.1 Flash 99.25, mimo 99.0, Luna 95.5, Kimi K3 92.5, Mistral Large 4 83.0, DeepSeek V4 Pro 82.25, Gemini 3.1 Pro 81.0, Gemini 3.8 Flash 80.0, MiniMax M3 79.0, Nemotron 3 Ultra 61.25; Grok 104.75 of 120. Session time for the later OpenRouter and CodeBuddy runs is the sum of task session lengths, because their batches were interrupted (see `RUN_METRICS.md`). muse-wonder's time is the sum of its two passes (4 min 45 s, then 7 min 15 s).

### What was observed

- **Every entry completed every task it ran.**
  - **Hidden contract tests:** every model passed them for task 01. For task 02, all but MiniMax M3.1 Flash and Haiku 5.5 passed: their `get` raises on an expired entry but leaves it in the map.
  - **Frontends:** no page scrolled sideways at 390 px or made a network request.
  - **Interruptions not caused by the model** (each re-run from the template with the identical command):
    - Astra's tasks 10–13 (quota).
    - Grok's task 13 (usage balance; still to be re-run).
    - MiniMax M3.1 Flash's task 11 (job limit).
    - Gemini 3.1 Pro's task 11 (agy's headless permission auto-deny).
    - The third OpenRouter batch (/tmp filled up with opencode's npm caches, then the credit ran out).
    - HY4-through-CodeBuddy's tasks 11 and 13 (the CodeBuddy plan's rate limit).
    - muse-wonder's tasks 10–13 (the Muse subscription's 5-hour window ran out as they started; Muse later reset all quotas after fixing a drain that ran too fast).
  - **Three tasks produced nothing at the standard high effort:** Mistral Large 4's 12 and 13, and Qwen 3.8 Max's 13. Each time, a single response's reasoning hit opencode's 32,000-token cap per response. At the user's request they were re-run at reduced effort, and the graders were told so.
- **Sonnet 5.5 is first again** (9.54), ahead of Fable and Opus, which tie at 9.37. In this pass Opus and Sonnet each had the best or tied-best score on 6 of 13 tasks, Fable on 3, Grok on 2, and Sol, Qwen 3.8 Max and Haiku on 1 each (seven tied at 10 on the bug fix).
- **Six tiers:**
  - **Sonnet, Fable and Opus:** 9.4–9.5 per task.
  - **Haiku 5.5, Grok 4.7, GPT-6 Astra and GPT-6.1 Sol:** 8.6–8.9.
  - **Qwen 3.8 Max, HY4 preview (both harnesses), muse-wonder and Step-5 preview:** 8.0–8.3.
  - **muse, GLM-5.3, MiniMax M3.1 Flash, mimo, GPT-6 Luna and Kimi K3:** 7.1–7.7.
  - **Mistral Large 4, DeepSeek V4 Pro, Gemini 3.1 Pro, Gemini 3.8 Flash and MiniMax M3:** 6.1–6.4.
  - **Nemotron 3 Ultra:** 4.7, last or tied last on 10 of 13 tasks.
- **muse-wonder** (Meta's new Muse model, through Muse Code on xhigh) is 10th at 8.10, in the tier just below the GPT and Grok models and 0.37 ahead of muse-spark (7.73), which ran on max.
  - **Strong:** the bug fix (02: 9.75), incident analysis (09: 9.0), social media (08: 8.75) and the editorial page (12: 8.75). Its writing average (8.31) is the best outside the top two tiers.
  - **Weak:** infrastructure (03: 5.75, 20th of 24). It drops every Linux capability from Redis and nginx, including the ones their stock entrypoints need to switch users, so the stack likely never starts (inferred from the images; no containers were started). The playful frontend (13: 7.0) shows an empty undo bar from load because CSS overrides the `hidden` attribute. In maintenance (04: 7.5) `normalize_version` now rejects `2.0RC1`.
  - **Speed and quota:** it was the fastest full run (about 12 minutes). Before Muse's fix it also drained the subscription fastest: tasks 01–09 used a whole 5-hour window and a quarter of the weekly quota in about five minutes. After the fix, the four heaviest tasks used 34% of a 5-hour window and 11% of the week.
- **Grading noise:**
  - **Per task:** between the twenty-three-way and twenty-four-way passes, scores for the same submissions moved by 0.41 points on average, and 34 of 298 moved by a point or more.
  - **Per model:** averages moved by 0.13 on average. The largest moves were up: Step-5 +0.35, Gemini 3.1 Pro +0.35, HY4 +0.33, mimo +0.29. The largest drop was Kimi K3, −0.21.
  - **What it means:** as before, a model's average can move about ±0.4 from one pass to the next, with no steady direction.
- **HY4 preview through CodeBuddy against OpenRouter/opencode:** 7.96 against 8.17, the reverse of the last pass (8.04 against 7.85).
  - **Where CodeBuddy did better:** social media (08: 7.75 against 6.75) and the dashboard (11: 8.75 against 7.25).
  - **Where it did worse:** infrastructure (03: 6.5 against 8.25), maintenance (04: 7.75 against 9.0) and the editorial page (12: 7.25 against 8.25).
  - The gap flipped sign between passes, so this doesn't show that either harness is better. It shows that a single run varies a lot task by task, and that grading does too.
- **Qwen 3.8 Max** stays the best entry outside the top two tiers. Its code is strong (8.69; 01: 9.25, 02: 10), and its weakest areas are planning (06: 7.75) and operations.
- **Nemotron 3 Ultra** is last by about 1.4 points. It's last or tied last on 10 of 13 tasks, and its task-04 run tried `pip install` twice (blocked).
- **Patterns across the field are unchanged:**
  - packages that don't build;
  - `normalize_version` output changed while claimed unchanged;
  - Redis left unauthenticated, or hardened until it can't start;
  - invented product facts in social posts;
  - "no alert" treated as "no impact";
  - CSS that overrides the `hidden` attribute.

### What is inferred

- **Only tier-level differences are reliable.** With 24 entries and model averages moving by up to ±0.4 between passes, differences under about 0.4 aren't meaningful. The top three can't be separated, nor can the four in the second tier, or Qwen, the two HY4 entries, muse-wonder and Step-5. The gaps between tiers are still well beyond that.
- **muse-wonder against muse-spark:** wonder is ahead by 0.37 on average: ahead on 8 tasks, behind on 3 (infrastructure, operations and the playful frontend) and level on 2. Its largest gains are maintenance (+2.25), the story (+1.5) and incident analysis (+1.25). It ran one effort step lower (xhigh against max), in a newer Muse Code release, and with a stricter blank slate (no personal skills, outer sandbox). The gap is near the noise floor for one run each, so this says wonder is at least as good, probably better, not by how much.
- **Harness effects are smaller than run-to-run variation, as far as this design can show.** One run per entry can't separate harness from luck. Measuring that would take several runs of the same model in each harness.
- **The OpenRouter results describe each model as served by OpenRouter through opencode.** opencode's fixed 32k cap per response affected Mistral's and Qwen's high-effort frontend attempts.
- **The Gemini results describe Gemini through agy's headless mode.**
- Opus 5.5 on extra effort might score higher. This run can't say.

## Recommendations by work type

- **Code:** Opus 5.5, Sonnet 5.5 or Fable 5.1. Grok (9.56 on code) is close behind. Among the rest, HY4 preview (8.94) and Qwen 3.8 Max (8.69).
- **Writing and planning:** Opus 5.5 or Sonnet 5.5. Haiku 5.5 is the best choice outside the top three; muse-wonder (8.31) and GPT-6 Astra (8.38) are next.
- **Incident analysis and operations:** Sonnet 5.5. Astra, Fable, Haiku and Sol are good alternatives.
- **Frontend:** Sonnet 5.5 or Fable 5.1. Grok 4.7 is close on 12 tasks.
- **Cost-sensitive work:** Haiku 5.5 ($1.74 at API prices for second-tier quality). Among the OpenRouter models, HY4 preview ($1.57) is the best value. muse-wonder is fast and inside the Muse subscription, but its quota use per task is high (about a tenth of a 5-hour window for a frontend task after Muse's fix).
- **Not for unsupervised work on these task types:** Nemotron 3 Ultra, Gemini 3.1 Pro and 3.8 Flash through agy, MiniMax M3, DeepSeek V4 Pro and Mistral Large 4. Check muse-wonder's infrastructure output before using it.

## Caveats

- **One run per entry and one blind grader per task per pass.** The graders were Claude Opus 5.5 subagents, so four contestants share its model family and one is the same model. Blinding reduces that bias but doesn't remove it. The grader brief was rewritten for the twelve-way pass (`tools/grader-prompt.md`; the original wasn't kept). The twenty-four-way pass ran on the Mac with the same brief, adapted only for paths and the browser (Playwright's bundled Chromium instead of Chrome).
- **Effort levels differ:**
  - Sonnet and Fable ran on extra, Opus on high and Haiku on xhigh.
  - The GPT and Grok models ran on xhigh, except Luna, which ran on max.
  - The Gemini models ran on agy's High variants, the OpenRouter models on opencode's `high` variant (three tasks at reduced effort), and HY4 via CodeBuddy on `high`.
  - muse ran on max, muse-wonder on xhigh, and mimo on its default.
- **Different setups:**
  - Sonnet, Fable and Opus ran in Claude Code's cloud.
  - Haiku ran in the Claude Code CLI, and the Gemini models in the Antigravity CLI, both on cachyos with OS sandboxes.
  - The eight OpenRouter models ran in opencode, and HY4 also in CodeBuddy, on cachyos with **no OS sandbox**. Permission rules and a transcript audit stood in for one; CodeBuddy ran with the user's real HOME because its sign-in requires it.
  - The GPT models ran in Codex CLI and Grok in Grok CLI on the Mac.
  - The MiniMax models ran through mcode, muse through tincan, and mimo a week earlier.
  - muse-wonder ran in Muse Code on the Mac with a clean HOME (no personal skills, rules or earlier sessions) inside an outer macOS sandbox that blocked reads of the rest of the home directory and all network except HTTPS. The earlier muse run loaded the user's skills and used Muse's own sandbox.
  - Every setup kept personal instructions, memory and other models' outputs out.
- **Cost figures aren't comparable across providers.** The cloud Claude figures come from account balances, Haiku's is an API-equivalent figure, and CodeBuddy reports $0 for plan usage. OpenRouter and Grok report dollars, the Muse runs report tokens and subscription quota, and the others report tokens.
- **Objective checks for earlier models are carried over** from their original runs; muse-wonder's were run on the Mac, where re-running the full cross-test matrix reproduced every recorded result. On cachyos, task-04 suites that import `packaging` were run in a scratch venv with it.
- **Not checked:** ruff lint results in task 04, and nginx syntax in task 03 (no nginx binary was available). No containers were started.
