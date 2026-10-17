## Results

Scores come from the latest blind pass, which graded all twenty-six entries together (2026-10-17, after muse-wonder-full was added). HY4 preview appears twice: once through OpenRouter and opencode, once through CodeBuddy. Gemini 4 Argon ran through the Gemini web chat, with no tools: it could not run code, tests or a browser (see the caveats). Three OpenRouter submissions ran at reduced reasoning effort: Mistral Large 4's tasks 12 and 13, and Qwen 3.8 Max's task 13. Their high-effort attempts produced nothing.

| | Avg / task | Code | Writing | Ops | Frontend | Time | Cost / usage |
|---|---|---|---|---|---|---|---|
| **Sonnet 5.5** (extra) | **9.38** | **9.62** | 9.19 | **9.62** | **9.17** | ~28 min | $15 |
| **Opus 5.5** (high) | 9.29 | **9.62** | **9.31** | 9.38 | 8.75 | ~21 min | $14 |
| **Fable 5.1** (extra) | 9.23 | 9.56 | 9.12 | 9.38 | 8.83 | ~49 min | $53 |
| **Haiku 5.5** (xhigh) | 8.73 | 8.75 | 8.81 | 8.75 | 8.58 | ~34 min | $1.74 API-equivalent (subscription) |
| **Grok 4.7** (xhigh) | 8.71 | 9.38 | 7.94 | 8.88 | 8.75 | ~80 min + 52 min (task 13 re-run) | $12.01 |
| **GPT-6 Astra** (xhigh) | 8.60 | 9.44 | 8.38 | 8.38 | 7.92 | ~35 min | 3.6M in / 185k out tokens |
| **muse-wonder-full** (xhigh) | 8.58 | 8.62 | 8.81 | 8.50 | 8.25 | ~31 min | 7.1M in / 198k out tokens; 33% of a 5-hour window (see `RUN_METRICS.md`) |
| **GPT-6.1 Sol** (xhigh) | 8.56 | 9.19 | 8.19 | 8.12 | 8.50 | ~48 min | 5.8M in / 243k out tokens |
| **HY4 preview** (high, OpenRouter) | 8.25 | 9.00 | 7.94 | 8.38 | 7.58 | ~113 session-min | $1.57 |
| **Qwen 3.8 Max** (high, OpenRouter) | 8.17 | 8.25 | 8.12 | 8.25 | 8.08 | ~158 session-min | $5.44 |
| **HY4 preview via CodeBuddy** (high) | 8.13 | 8.19 | 8.19 | 7.88 | 8.17 | ~66 session-min | $0 reported (plan) |
| **muse-wonder** (xhigh) | 8.13 | 7.69 | 8.38 | 8.25 | 8.33 | ~12 min | 6.7M in / 154k out tokens; subscription quota (see `RUN_METRICS.md`) |
| **MiniMax M3.1 Flash** (xhigh, mcode) | 7.92 | 8.25 | 7.00 | 7.75 | 8.83 | ~42 min | 0.58M in + 18.6M cache-read / 398k out tokens; free preview |
| **Step-5 preview** (high, OpenRouter) | 7.73 | 8.06 | 7.19 | 7.62 | 8.08 | ~69 session-min | $2.21 |
| **GLM-5.3** (high, OpenRouter) | 7.67 | 7.69 | 8.12 | 6.88 | 7.58 | ~29 min | $1.49 |
| **mimo** | 7.58 | 8.50 | 7.50 | 7.00 | 6.83 | not recorded | not recorded |
| **muse** (max) | 7.58 | 7.12 | 7.50 | 7.88 | 8.08 | ~20 min | 6.2M in / 162k out tokens |
| **Gemini 4 Argon** (High, Gemini chat, no tools) | 7.31 | 7.06 | 7.44 | 7.12 | 7.58 | ~61 session-min | Google AI Pro plan; 17% of the weekly limit |
| **Kimi K3** (high, OpenRouter) | 7.31 | 7.06 | 7.38 | 6.50 | 8.08 | ~14 min | $3.47 |
| **GPT-6 Luna** (max) | 7.27 | 7.56 | 7.25 | 7.00 | 7.08 | ~34 min | 3.5M in / 220k out tokens |
| **Mistral Large 4** (high; 12–13 reduced) | 6.54 | 7.19 | 5.75 | 6.75 | 6.58 | ~24 min + re-runs | $1.23 |
| **DeepSeek V4 Pro** (high, OpenRouter) | 6.48 | 6.94 | 6.25 | 5.62 | 6.75 | ~12 min | $0.43 |
| **Gemini 3.1 Pro** (high, agy) | 6.46 | 7.25 | 6.12 | 5.62 | 6.42 | ~27 min | 1.56M in + 7.45M cache-read / 530k out tokens |
| **Gemini 3.8 Flash** (high, agy) | 6.23 | 7.12 | 6.31 | 5.88 | 5.17 | ~22 min | 2.35M in + 16.1M cache-read / 512k out tokens |
| **MiniMax M3** (default, mcode) | 6.08 | 6.25 | 5.44 | 5.88 | 6.83 | ~9 min | 0.55M in + 4.8M cache-read / 190k out tokens |
| **Nemotron 3 Ultra** (high, OpenRouter) | 4.88 | 6.12 | 4.06 | 4.00 | 4.92 | ~8 min | $0.76 |

Totals (of 130): Sonnet 122.0, Opus 120.75, Fable 120.0, Haiku 113.5, Grok 113.25, Astra 111.75, muse-wonder-full 111.5, Sol 111.25, HY4 107.25, Qwen 3.8 Max 106.25, HY4 via CodeBuddy 105.75, muse-wonder 105.75, MiniMax M3.1 Flash 103.0, Step-5 preview 100.5, GLM-5.3 99.75, mimo 98.5, muse 98.5, Gemini 4 Argon 95.0, Kimi K3 95.0, Luna 94.5, Mistral Large 4 85.0, DeepSeek V4 Pro 84.25, Gemini 3.1 Pro 84.0, Gemini 3.8 Flash 81.0, MiniMax M3 79.0, Nemotron 3 Ultra 63.5. Session time for the later OpenRouter and CodeBuddy runs is the sum of task session lengths, because their batches were interrupted (see `RUN_METRICS.md`); for Argon it is the sum of the kept chat replies, spread over about 20 hours to fit the Gemini plan's 5-hour usage windows. muse-wonder's time is the sum of its two passes (4 min 45 s, then 7 min 15 s); muse-wonder-full ran two tasks at a time (55 min summed). Grok's cost is its original run without the interrupted task-13 attempt plus the re-run ($5.27).

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
- **Sonnet 5.5 is first again** (9.38), ahead of Opus (9.29) and Fable (9.23). In this pass Sonnet had the best or tied-best score on 7 of 13 tasks, Opus on 6, Fable, Grok and Astra on 2 each, and Sol, GLM-5.3 and MiniMax M3.1 Flash on 1 each.
- **Six tiers:**
  - **Sonnet, Opus and Fable:** 9.2–9.4 per task.
  - **Haiku 5.5, Grok 4.7, GPT-6 Astra, muse-wonder-full and GPT-6.1 Sol:** 8.55–8.75.
  - **HY4 preview (both harnesses), Qwen 3.8 Max, muse-wonder and MiniMax M3.1 Flash:** 7.9–8.25.
  - **Step-5 preview, GLM-5.3, mimo, muse, Gemini 4 Argon, Kimi K3 and GPT-6 Luna:** 7.25–7.75.
  - **Mistral Large 4, DeepSeek V4 Pro, Gemini 3.1 Pro, Gemini 3.8 Flash and MiniMax M3:** 6.1–6.55.
  - **Nemotron 3 Ultra:** 4.9, last or tied last on 9 of 13 tasks.
- **muse-wonder-full** (Meta's `muse-wonder-full-1.0`, Muse Code 1.4.10, xhigh) is 7th at 8.58, level with GPT-6 Astra (8.60) and GPT-6.1 Sol (8.56) and 0.45 ahead of muse-wonder (8.13). It ran on cachyos, two tasks at a time, in 31 minutes, using 33% of one 5-hour subscription window.
  - **Even across the board:** no task below 7.5, and the strongest writing score outside the top three (8.81, level with Haiku). Best placings: the weekly plan (10: 9.0, 3rd), the webhook guide (05: 8.75, 4th) and social media (08: 9.0, 4th).
  - **Fixed what held muse-wonder back:** infrastructure went from 6.0 to 8.0. It hardens the stack without breaking it, though Redis takes its password on the command line and has no memory cap. Maintenance went from 6.5 to 7.5: it switches to strict PEP 440 normalisation through `packaging`, a real behaviour change for spellings like `1.02`, but discloses it everywhere and the package builds.
  - **Weaker:** incident analysis (09: 8.0) has a vague customer update with no times; the dashboard (11: 8.25) has two-letter rail "icons" and hides columns behind horizontal scroll on phones.
- **Gemini 4 Argon** (Thinking: High, through the Gemini web chat because no API access was available) is 18th at 7.31 (tied with Kimi K3). That is about a point above Gemini 3.1 Pro and 3.8 Flash through agy, but it worked under a handicap no other entry had: each task's files were pasted into one chat message and it returned whole files, so it never ran its code or tests or saw its pages.
  - **Strong:** the editorial page (12: 8.5) and the planning document (06: 8.25); the bug fix (02: 9.0) is behaviourally correct.
  - **Weak:** maintenance (04: 6.25), where its hand-written version normaliser changes ordinary versions (`1.02.0` → `1.2.0`) while the changelog says output is preserved; social media (08: 6.5), where the replies invent a Help-menu diagnostic log, a support email and a billing adjustment; and the story (07: 6.5), whose middle explains its own twist with pseudo-technical detail.
  - **Verification claims:** in tasks 01 and 02 its RESPONSE.md reports test runs that could not have happened (01 says "All 11 unit tests … pass" for a file with 13). In task 04 it says execution was unavailable but still labels ruff "PASS". The tests do pass when run.
  - **Speed and usage:** about an hour of reply time, spread over 20 hours by the Google AI Pro plan's 5-hour windows (a task took roughly a fifth to a third of a window). It reported its model ID as `gemini-3.1-pro-preview` in every reply.
- **Grok 4.7** (complete since its task-13 re-run, 8.5 in this pass) is 5th at 8.71, with the best or tied-best score on tasks 01 and 02.
- **muse-wonder** is 11th at 8.13, 0.55 ahead of muse-spark (7.58). Strong on the bug fix (02: 9.75) and social media (08: 8.75); still weak on infrastructure (03: 6.0, 19th of 26), where it drops every Linux capability from Redis and nginx, including the ones their stock entrypoints need, so the stack likely never starts (inferred from the images; no containers were started).
- **Grading noise:**
  - **Per task:** between the twenty-five-way and twenty-six-way passes, scores for the same submissions moved by 0.42 points on average, and 38 of 325 moved by a point or more.
  - **Per model:** averages moved by 0.14 on average. The largest moves were HY4 preview +0.38, MiniMax M3.1 Flash +0.38, DeepSeek V4 Pro +0.35 and Gemini 3.1 Pro +0.34.
  - **What it means:** as before, a model's average can move about ±0.4 from one pass to the next, with no steady direction.
- **HY4 preview through CodeBuddy against OpenRouter/opencode:** 8.13 against 8.25, flipped again from the last pass (8.12 against 7.87).
  - **Where CodeBuddy did better:** social media (08: 8.75 against 8.0) and the dashboard (11: 9.0 against 7.5).
  - **Where it did worse:** maintenance (04: 7.5 against 8.75) and the story (07: 7.75 against 8.5).
  - The gap has now changed sign three times, so this doesn't show that either harness is better. It shows that a single run varies a lot task by task, and that grading does too.
- **Qwen 3.8 Max** (8.17) and HY4 preview (8.25) lead the third tier; HY4's code is the strongest there (9.00).
- **Nemotron 3 Ultra** is last by about 1.2 points. It's last or tied last on 9 of 13 tasks, and its task-04 run tried `pip install` twice (blocked).
- **Patterns across the field are unchanged:**
  - packages that don't build;
  - `normalize_version` output changed while claimed unchanged;
  - Redis left unauthenticated, or hardened until it can't start;
  - invented product facts in social posts;
  - "no alert" treated as "no impact";
  - CSS that overrides the `hidden` attribute.

### What is inferred

- **Only tier-level differences are reliable.** With 26 entries and model averages moving by up to ±0.4 between passes, differences under about 0.4 aren't meaningful. The top three can't be separated, nor can the five in the second tier, or the five in the third. The gaps between tiers are still well beyond that.
- **The Muse models:** muse-wonder-full is ahead of muse-wonder by 0.45 and of muse-spark by 1.0. The full-versus-wonder gap is at the edge of the noise floor for one run each, but it comes mostly from the two tasks where wonder's output was likely broken (03 and 04), so the full model's main gain looks like fewer serious mistakes rather than better work everywhere. wonder against muse-spark (0.55 in this pass, 0.25 in the last) again says wonder is at least as good, not by how much. The three ran in different Muse Code releases with different blank-slate setups; wonder-full ran on Linux under bubblewrap rather than the Mac's sandbox.
- **Gemini 4 Argon's score measures the model plus a tool-less chat harness.** Every other entry could run its tests and, in most harnesses, open its pages; Argon could not, and its weakest areas (version behaviour in 04, invented details in 08) are ones that checking or a closer reading of the sources would have caught. Its result is not directly comparable to an agentic run of the same model, and says little about Argon in an agent harness. Against the two Gemini models run through agy it is clearly ahead (7.23 against 6.12 and 5.96), despite the handicap.
- **Harness effects are smaller than run-to-run variation, as far as this design can show.** One run per entry can't separate harness from luck. Measuring that would take several runs of the same model in each harness.
- **The OpenRouter results describe each model as served by OpenRouter through opencode.** opencode's fixed 32k cap per response affected Mistral's and Qwen's high-effort frontend attempts.
- **The Gemini 3.1 Pro and 3.8 Flash results describe Gemini through agy's headless mode; Argon's describe the Gemini web chat.**
- Opus 5.5 on extra effort might score higher. This run can't say.

## Recommendations by work type

- **Code:** Sonnet 5.5, Opus 5.5 or Fable 5.1. GPT-6 Astra (9.44 on code) and Grok (9.38) are close behind, then Sol (9.19). Among the rest, HY4 preview (9.00).
- **Writing and planning:** Opus 5.5, Sonnet 5.5 or Fable 5.1. Haiku 5.5 and muse-wonder-full (8.81) are the best choices outside the top three.
- **Incident analysis and operations:** Sonnet 5.5, Opus or Fable. Grok (8.88), Haiku (8.75) and muse-wonder-full (8.50) are good alternatives.
- **Frontend:** Sonnet 5.5. Fable and MiniMax M3.1 Flash (8.83), then Opus and Grok 4.7 (8.75), follow.
- **Cost-sensitive work:** Haiku 5.5 ($1.74 at API prices for second-tier quality). Among the OpenRouter models, HY4 preview ($1.57) is the best value. Within a Muse subscription, muse-wonder-full gives second-tier quality for about 2.5% of a 5-hour window per task.
- **Not for unsupervised work on these task types:** Nemotron 3 Ultra, Gemini 3.1 Pro and 3.8 Flash through agy, MiniMax M3, DeepSeek V4 Pro and Mistral Large 4. Check muse-wonder's infrastructure output before using it. Through a chat window, Gemini 4 Argon's code and claims need checking: it reports test runs it never made.

## Caveats

- **One run per entry and one blind grader per task per pass.** The graders were Claude Opus 5.5 subagents, so four contestants share its model family and one is the same model. Blinding reduces that bias but doesn't remove it. The grader brief was rewritten for the twelve-way pass (`tools/grader-prompt.md`; the original wasn't kept). The twenty-four-way pass ran on the Mac with the same brief, adapted only for paths and the browser (Playwright's bundled Chromium instead of Chrome); the twenty-five-way and twenty-six-way passes ran on cachyos with Chrome.
- **Effort levels differ:**
  - Sonnet and Fable ran on extra, Opus on high and Haiku on xhigh.
  - The GPT and Grok models ran on xhigh, except Luna, which ran on max.
  - Gemini 3.1 Pro and 3.8 Flash ran on agy's High variants, Gemini 4 Argon on the Gemini app's Thinking level High, the OpenRouter models on opencode's `high` variant (three tasks at reduced effort), and HY4 via CodeBuddy on `high`.
  - muse ran on max, muse-wonder and muse-wonder-full on xhigh, and mimo on its default.
- **Different setups:**
  - Sonnet, Fable and Opus ran in Claude Code's cloud.
  - Haiku ran in the Claude Code CLI, and the Gemini models in the Antigravity CLI, both on cachyos with OS sandboxes.
  - The eight OpenRouter models ran in opencode, and HY4 also in CodeBuddy, on cachyos with **no OS sandbox**. Permission rules and a transcript audit stood in for one; CodeBuddy ran with the user's real HOME because its sign-in requires it.
  - The GPT models ran in Codex CLI and Grok in Grok CLI on the Mac; Grok's task 13 was re-run in Grok CLI on cachyos (Linux workspace sandbox, same flags).
  - Gemini 4 Argon ran in the Gemini web chat (Google AI Pro account), in the Claude desktop app's browser: one temporary chat per task, each task's files pasted into a single message, and the reply's files copied out verbatim (checked with SHA-256). It had no tools. Its context included the account's location and two saved custom skills; no past chats or memories.
  - The MiniMax models ran through mcode, muse through tincan, and mimo a week earlier.
  - muse-wonder ran in Muse Code on the Mac with a clean HOME (no personal skills, rules or earlier sessions) inside an outer macOS sandbox that blocked reads of the rest of the home directory and all network except HTTPS. muse-wonder-full ran in Muse Code on cachyos with the same flags, a clean HOME per task and bubblewrap in place of the macOS sandbox (home directory, /tmp and mounts hidden; network not restricted, though a tool-call audit found none used). The earlier muse run loaded the user's skills and used Muse's own sandbox.
  - Every setup kept personal instructions, memory and other models' outputs out.
- **Cost figures aren't comparable across providers.** The cloud Claude figures come from account balances, Haiku's is an API-equivalent figure, and CodeBuddy reports $0 for plan usage. OpenRouter and Grok report dollars, the Muse runs report tokens and subscription quota, Argon reports only the Gemini plan's usage meter, and the others report tokens.
- **Objective checks for earlier models are carried over** from their original runs; muse-wonder's were run on the Mac, where re-running the full cross-test matrix reproduced every recorded result. Argon's and muse-wonder-full's checks and Grok's task-13 screenshots were run on cachyos. On cachyos, task-04 suites that import `packaging` were run in a scratch venv with it.
- **Not checked:** ruff lint results in task 04, and nginx syntax in task 03 (no nginx binary was available). No containers were started.
