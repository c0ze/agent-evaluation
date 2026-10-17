## Results

Scores come from the latest blind pass, which graded all twenty-five entries together (2026-10-17, after Gemini 4 Argon was added and Grok 4.7's task 13 was re-run). HY4 preview appears twice: once through OpenRouter and opencode, once through CodeBuddy. Gemini 4 Argon ran through the Gemini web chat, with no tools: it could not run code, tests or a browser (see the caveats). Three OpenRouter submissions ran at reduced reasoning effort: Mistral Large 4's tasks 12 and 13, and Qwen 3.8 Max's task 13. Their high-effort attempts produced nothing.

| | Avg / task | Code | Writing | Ops | Frontend | Time | Cost / usage |
|---|---|---|---|---|---|---|---|
| **Sonnet 5.5** (extra) | **9.48** | **9.75** | **9.38** | **9.50** | **9.25** | ~28 min | $15 |
| **Opus 5.5** (high) | 9.35 | 9.62 | 9.31 | 9.12 | 9.17 | ~21 min | $14 |
| **Fable 5.1** (extra) | 9.19 | 9.56 | 9.00 | 9.25 | 8.92 | ~49 min | $53 |
| **Haiku 5.5** (xhigh) | 8.75 | 8.75 | 8.75 | 9.00 | 8.58 | ~34 min | $1.74 API-equivalent (subscription) |
| **Grok 4.7** (xhigh) | 8.71 | 9.50 | 8.06 | 8.50 | 8.67 | ~80 min + 52 min (task 13 re-run) | $12.01 |
| **GPT-6 Astra** (xhigh) | 8.71 | 9.31 | 8.56 | 9.00 | 7.92 | ~35 min | 3.6M in / 185k out tokens |
| **GPT-6.1 Sol** (xhigh) | 8.63 | 9.12 | 8.38 | 8.62 | 8.33 | ~48 min | 5.8M in / 243k out tokens |
| **Qwen 3.8 Max** (high, OpenRouter) | 8.25 | 8.62 | 8.25 | 8.25 | 7.75 | ~158 session-min | $5.44 |
| **HY4 preview via CodeBuddy** (high) | 8.12 | 8.31 | 8.25 | 7.88 | 7.83 | ~66 session-min | $0 reported (plan) |
| **muse-wonder** (xhigh) | 8.10 | 7.69 | 8.19 | 8.88 | 8.00 | ~12 min | 6.7M in / 154k out tokens; subscription quota (see `RUN_METRICS.md`) |
| **Step-5 preview** (high, OpenRouter) | 7.96 | 8.44 | 7.25 | 8.38 | 8.00 | ~69 session-min | $2.21 |
| **HY4 preview** (high, OpenRouter) | 7.87 | 8.62 | 7.69 | 8.00 | 7.00 | ~113 session-min | $1.57 |
| **muse** (max) | 7.85 | 7.31 | 7.81 | 8.38 | 8.25 | ~20 min | 6.2M in / 162k out tokens |
| **GLM-5.3** (high, OpenRouter) | 7.65 | 7.94 | 7.88 | 7.12 | 7.33 | ~29 min | $1.49 |
| **MiniMax M3.1 Flash** (xhigh, mcode) | 7.54 | 7.88 | 6.38 | 7.62 | 8.58 | ~42 min | 0.58M in + 18.6M cache-read / 398k out tokens; free preview |
| **mimo** | 7.52 | 8.06 | 7.44 | 7.25 | 7.08 | not recorded | not recorded |
| **Kimi K3** (high, OpenRouter) | 7.46 | 7.62 | 7.06 | 7.38 | 7.83 | ~14 min | $3.47 |
| **GPT-6 Luna** (max) | 7.38 | 7.50 | 7.50 | 7.50 | 7.00 | ~34 min | 3.5M in / 220k out tokens |
| **Gemini 4 Argon** (High, Gemini chat, no tools) | 7.23 | 7.38 | 7.00 | 7.12 | 7.42 | ~61 session-min | Google AI Pro plan; 17% of the weekly limit |
| **Mistral Large 4** (high; 12–13 reduced) | 6.44 | 7.44 | 5.44 | 6.62 | 6.33 | ~24 min + re-runs | $1.23 |
| **DeepSeek V4 Pro** (high, OpenRouter) | 6.13 | 7.00 | 5.69 | 5.25 | 6.17 | ~12 min | $0.43 |
| **Gemini 3.1 Pro** (high, agy) | 6.12 | 7.12 | 5.50 | 5.75 | 5.83 | ~27 min | 1.56M in + 7.45M cache-read / 530k out tokens |
| **Gemini 3.8 Flash** (high, agy) | 5.96 | 7.31 | 6.00 | 5.62 | 4.33 | ~22 min | 2.35M in + 16.1M cache-read / 512k out tokens |
| **MiniMax M3** (default, mcode) | 5.94 | 6.12 | 5.56 | 5.12 | 6.75 | ~9 min | 0.55M in + 4.8M cache-read / 190k out tokens |
| **Nemotron 3 Ultra** (high, OpenRouter) | 4.90 | 6.31 | 4.25 | 4.50 | 4.17 | ~8 min | $0.76 |

Totals (of 130): Sonnet 123.25, Opus 121.5, Fable 119.5, Haiku 113.75, Grok 113.25, Astra 113.25, Sol 112.25, Qwen 3.8 Max 107.25, HY4 via CodeBuddy 105.5, muse-wonder 105.25, Step-5 preview 103.5, HY4 102.25, muse 102.0, GLM-5.3 99.5, MiniMax M3.1 Flash 98.0, mimo 97.75, Kimi K3 97.0, Luna 96.0, Gemini 4 Argon 94.0, Mistral Large 4 83.75, DeepSeek V4 Pro 79.75, Gemini 3.1 Pro 79.5, Gemini 3.8 Flash 77.5, MiniMax M3 77.25, Nemotron 3 Ultra 63.75. Session time for the later OpenRouter and CodeBuddy runs is the sum of task session lengths, because their batches were interrupted (see `RUN_METRICS.md`); for Argon it is the sum of the kept chat replies, spread over about 20 hours to fit the Gemini plan's 5-hour usage windows. muse-wonder's time is the sum of its two passes (4 min 45 s, then 7 min 15 s). Grok's cost is its original run without the interrupted task-13 attempt plus the re-run ($5.27).

### What was observed

- **Every entry completed every task.**
  - **Hidden contract tests:** every model passed them for task 01. For task 02, all but MiniMax M3.1 Flash and Haiku 5.5 passed: their `get` raises on an expired entry but leaves it in the map. Gemini 4 Argon passed both without having run anything.
  - **Frontends:** no page scrolled sideways at 390 px or made a network request.
  - **Interruptions not caused by the model** (each re-run from the template with the identical prompt or command):
    - Astra's tasks 10–13 (quota).
    - Grok's task 13 (usage balance; re-run on 2026-10-16 on cachyos with the same flags and a newer Grok CLI).
    - MiniMax M3.1 Flash's task 11 (job limit).
    - Gemini 3.1 Pro's task 11 (agy's headless permission auto-deny).
    - The third OpenRouter batch (/tmp filled up with opencode's npm caches, then the credit ran out).
    - HY4-through-CodeBuddy's tasks 11 and 13 (the CodeBuddy plan's rate limit).
    - muse-wonder's tasks 10–13 (the Muse subscription's 5-hour window ran out as they started; Muse later reset all quotas after fixing a drain that ran too fast).
    - Gemini 4 Argon's task 07 (the orchestrator navigated the chat away before saving the reply) and tasks 12 and 13 (the chat reset itself mid-reply, twice for task 12).
  - **Three tasks produced nothing at the standard high effort:** Mistral Large 4's 12 and 13, and Qwen 3.8 Max's 13. Each time, a single response's reasoning hit opencode's 32,000-token cap per response. At the user's request they were re-run at reduced effort, and the graders were told so.
- **Sonnet 5.5 is first again** (9.48), ahead of Opus (9.35) and Fable (9.19). In this pass Sonnet had the best or tied-best score on 9 of 13 tasks, Opus on 6, Fable on 3, Grok on 2, and Qwen 3.8 Max, Sol, Astra and Haiku on 1 each.
- **Six tiers:**
  - **Sonnet, Opus and Fable:** 9.2–9.5 per task.
  - **Haiku 5.5, Grok 4.7, GPT-6 Astra and GPT-6.1 Sol:** 8.6–8.8.
  - **Qwen 3.8 Max, HY4 preview (both harnesses), muse-wonder, Step-5 preview and muse:** 7.85–8.25.
  - **GLM-5.3, MiniMax M3.1 Flash, mimo, Kimi K3, GPT-6 Luna and Gemini 4 Argon:** 7.2–7.7.
  - **Mistral Large 4, DeepSeek V4 Pro, Gemini 3.1 Pro, Gemini 3.8 Flash and MiniMax M3:** 5.9–6.4.
  - **Nemotron 3 Ultra:** 4.9, last or tied last on 7 of 13 tasks.
- **Gemini 4 Argon** (Thinking: High, through the Gemini web chat because no API access was available) is 19th at 7.23. That is about a point above Gemini 3.1 Pro and 3.8 Flash through agy, but it worked under a handicap no other entry had: each task's files were pasted into one chat message and it returned whole files, so it never ran its code or tests or saw its pages.
  - **Strong:** the editorial page (12: 8.5, 5th), the planning document (06: 8.25) and the bug fix (02: 8.75, behaviourally correct).
  - **Weak:** maintenance (04: 5.25), where its hand-written version normaliser changes ordinary versions (`1.02.0` → `1.2.0`) while the changelog says output is preserved; social media (08: 5.75), where the replies invent a Help-menu diagnostic log, a support email and a billing adjustment; and the story (07: 6.25), whose middle explains its own twist with pseudo-technical detail.
  - **Verification claims:** in tasks 01 and 02 its RESPONSE.md reports test runs that could not have happened (01 says "All 11 unit tests … pass" for a file with 13). In task 04 it says execution was unavailable but still labels ruff "PASS". The tests do pass when run.
  - **Speed and usage:** about an hour of reply time, spread over 20 hours by the Google AI Pro plan's 5-hour windows (a task took roughly a fifth to a third of a window). It reported its model ID as `gemini-3.1-pro-preview` in every reply.
- **Grok 4.7 now has all 13 tasks.** The re-run task 13 scored 8.75 (4th), so Grok's 8.71 average matches GPT-6 Astra's and its 113.25 total ties Astra's. Grok had the best or tied-best score on tasks 01 and 02 and is 2nd on the dashboard (11: 9.25).
- **muse-wonder** is 10th at 8.10, 0.25 ahead of muse-spark (7.85). Strong on incident analysis (09: 9.5), the bug fix (02: 9.75) and social media (08: 9.0); still weak on infrastructure (03: 5.75, 22nd of 25), where it drops every Linux capability from Redis and nginx, including the ones their stock entrypoints need, so the stack likely never starts (inferred from the images; no containers were started).
- **Grading noise:**
  - **Per task:** between the twenty-four-way and twenty-five-way passes, scores for the same submissions moved by 0.45 points on average, and 47 of 311 moved by a point or more.
  - **Per model:** averages moved by 0.11 on average. The largest moves were Kimi K3 +0.35 and HY4 preview −0.31; nothing else moved more than 0.2.
  - **What it means:** as before, a model's average can move about ±0.4 from one pass to the next, with no steady direction.
- **HY4 preview through CodeBuddy against OpenRouter/opencode:** 8.12 against 7.87, flipped back from the last pass (7.96 against 8.17).
  - **Where CodeBuddy did better:** social media (08: 8.75 against 6.75) and the dashboard (11: 8.0 against 5.25).
  - **Where it did worse:** maintenance (04: 7.0 against 8.75) and the story (07: 8.0 against 8.75).
  - The gap has now changed sign twice, so this doesn't show that either harness is better. It shows that a single run varies a lot task by task, and that grading does too.
- **Qwen 3.8 Max** stays the best entry outside the top two tiers. Its code is strong (8.62; 01: 10, 02: 9.5), and its weakest areas are the frontends and planning.
- **Nemotron 3 Ultra** is last by about a point. It's last or tied last on 7 of 13 tasks, and its task-04 run tried `pip install` twice (blocked).
- **Patterns across the field are unchanged:**
  - packages that don't build;
  - `normalize_version` output changed while claimed unchanged;
  - Redis left unauthenticated, or hardened until it can't start;
  - invented product facts in social posts;
  - "no alert" treated as "no impact";
  - CSS that overrides the `hidden` attribute.

### What is inferred

- **Only tier-level differences are reliable.** With 25 entries and model averages moving by up to ±0.4 between passes, differences under about 0.4 aren't meaningful. The top three can't be separated, nor can the four in the second tier, or the six in the third. The gaps between tiers are still well beyond that.
- **muse-wonder against muse-spark:** wonder is ahead by 0.25 on average in this pass (0.37 in the last). It ran one effort step lower (xhigh against max), in a newer Muse Code release, and with a stricter blank slate (no personal skills, outer sandbox). The gap is near the noise floor for one run each, so this says wonder is at least as good, not by how much.
- **Gemini 4 Argon's score measures the model plus a tool-less chat harness.** Every other entry could run its tests and, in most harnesses, open its pages; Argon could not, and its weakest areas (version behaviour in 04, invented details in 08) are ones that checking or a closer reading of the sources would have caught. Its result is not directly comparable to an agentic run of the same model, and says little about Argon in an agent harness. Against the two Gemini models run through agy it is clearly ahead (7.23 against 6.12 and 5.96), despite the handicap.
- **Harness effects are smaller than run-to-run variation, as far as this design can show.** One run per entry can't separate harness from luck. Measuring that would take several runs of the same model in each harness.
- **The OpenRouter results describe each model as served by OpenRouter through opencode.** opencode's fixed 32k cap per response affected Mistral's and Qwen's high-effort frontend attempts.
- **The Gemini 3.1 Pro and 3.8 Flash results describe Gemini through agy's headless mode; Argon's describe the Gemini web chat.**
- Opus 5.5 on extra effort might score higher. This run can't say.

## Recommendations by work type

- **Code:** Sonnet 5.5, Opus 5.5 or Fable 5.1. Grok (9.50 on code) is close behind, then GPT-6 Astra (9.31). Among the rest, HY4 preview and Qwen 3.8 Max (8.62).
- **Writing and planning:** Sonnet 5.5 or Opus 5.5. Haiku 5.5 (8.75) is the best choice outside the top three; GPT-6 Astra (8.56) is next.
- **Incident analysis and operations:** Sonnet 5.5 or Fable 5.1. Opus, Haiku, Astra and muse-wonder (8.88) are good alternatives.
- **Frontend:** Sonnet 5.5 or Opus 5.5. Fable, Grok 4.7 and MiniMax M3.1 Flash (8.58) follow.
- **Cost-sensitive work:** Haiku 5.5 ($1.74 at API prices for second-tier quality). Among the OpenRouter models, HY4 preview ($1.57) is the best value. muse-wonder is fast and inside the Muse subscription, but its quota use per task is high (about a tenth of a 5-hour window for a frontend task after Muse's fix).
- **Not for unsupervised work on these task types:** Nemotron 3 Ultra, Gemini 3.1 Pro and 3.8 Flash through agy, MiniMax M3, DeepSeek V4 Pro and Mistral Large 4. Check muse-wonder's infrastructure output before using it. Through a chat window, Gemini 4 Argon's code and claims need checking: it reports test runs it never made.

## Caveats

- **One run per entry and one blind grader per task per pass.** The graders were Claude Opus 5.5 subagents, so four contestants share its model family and one is the same model. Blinding reduces that bias but doesn't remove it. The grader brief was rewritten for the twelve-way pass (`tools/grader-prompt.md`; the original wasn't kept). The twenty-four-way pass ran on the Mac with the same brief, adapted only for paths and the browser (Playwright's bundled Chromium instead of Chrome); the twenty-five-way pass ran on cachyos with Chrome.
- **Effort levels differ:**
  - Sonnet and Fable ran on extra, Opus on high and Haiku on xhigh.
  - The GPT and Grok models ran on xhigh, except Luna, which ran on max.
  - Gemini 3.1 Pro and 3.8 Flash ran on agy's High variants, Gemini 4 Argon on the Gemini app's Thinking level High, the OpenRouter models on opencode's `high` variant (three tasks at reduced effort), and HY4 via CodeBuddy on `high`.
  - muse ran on max, muse-wonder on xhigh, and mimo on its default.
- **Different setups:**
  - Sonnet, Fable and Opus ran in Claude Code's cloud.
  - Haiku ran in the Claude Code CLI, and the Gemini models in the Antigravity CLI, both on cachyos with OS sandboxes.
  - The eight OpenRouter models ran in opencode, and HY4 also in CodeBuddy, on cachyos with **no OS sandbox**. Permission rules and a transcript audit stood in for one; CodeBuddy ran with the user's real HOME because its sign-in requires it.
  - The GPT models ran in Codex CLI and Grok in Grok CLI on the Mac; Grok's task 13 was re-run in Grok CLI on cachyos (Linux workspace sandbox, same flags).
  - Gemini 4 Argon ran in the Gemini web chat (Google AI Pro account), in the Claude desktop app's browser: one temporary chat per task, each task's files pasted into a single message, and the reply's files copied out verbatim (checked with SHA-256). It had no tools. Its context included the account's location and two saved custom skills; no past chats or memories.
  - The MiniMax models ran through mcode, muse through tincan, and mimo a week earlier.
  - muse-wonder ran in Muse Code on the Mac with a clean HOME (no personal skills, rules or earlier sessions) inside an outer macOS sandbox that blocked reads of the rest of the home directory and all network except HTTPS. The earlier muse run loaded the user's skills and used Muse's own sandbox.
  - Every setup kept personal instructions, memory and other models' outputs out.
- **Cost figures aren't comparable across providers.** The cloud Claude figures come from account balances, Haiku's is an API-equivalent figure, and CodeBuddy reports $0 for plan usage. OpenRouter and Grok report dollars, the Muse runs report tokens and subscription quota, Argon reports only the Gemini plan's usage meter, and the others report tokens.
- **Objective checks for earlier models are carried over** from their original runs; muse-wonder's were run on the Mac, where re-running the full cross-test matrix reproduced every recorded result. Argon's checks and Grok's task-13 screenshots were run on cachyos. On cachyos, task-04 suites that import `packaging` were run in a scratch venv with it.
- **Not checked:** ruff lint results in task 04, and nginx syntax in task 03 (no nginx binary was available). No containers were started.
