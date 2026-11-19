## Results

Scores come from the latest blind pass, which graded all thirty-four entries together (2026-11-19, after Gemini 4 Neon, HY4, HY4 Flash and DeepSeek V4.1 Flash were added). HY4 preview appears twice: once through OpenRouter and opencode, once through CodeBuddy; the released HY4 and HY4 Flash ran through CodeBuddy. Gemini 4 Argon ran through the Gemini web chat, with no tools: it could not run code, tests or a browser (see the caveats). Three OpenRouter submissions ran at reduced reasoning effort: Mistral Large 4's tasks 12 and 13, and Qwen 3.8 Max's task 13. Their high-effort attempts produced nothing.

| | Avg / task | Code | Writing | Ops | Frontend | Time | Cost / usage |
|---|---|---|---|---|---|---|---|
| **Sonnet 5.5** (extra) | **9.35** | **9.56** | 9.25 | 9.50 | **9.08** | ~28 min | $15 |
| **Fable 5.2** (high, CLI) | **9.35** | 9.44 | **9.38** | **9.62** | 9.00 | ~30 min | $33.66 API-equivalent (subscription) |
| **Opus 5.5** (high) | 9.19 | 9.38 | **9.38** | 9.38 | 8.58 | ~21 min | $14 |
| **Fable 5.1** (extra) | 9.17 | 9.44 | 9.00 | 9.38 | 8.92 | ~49 min | $53 |
| **Grok 4.7** (xhigh) | 8.75 | 9.38 | 8.19 | 8.50 | 8.83 | ~80 min + 52 min (task 13 re-run) | $12.01 |
| **GPT-6 Astra** (xhigh) | 8.71 | 9.19 | 8.62 | 8.75 | 8.17 | ~35 min | 3.6M in / 185k out tokens |
| **Haiku 5.5** (xhigh) | 8.69 | 8.56 | 9.00 | 8.75 | 8.42 | ~34 min | $1.74 API-equivalent (subscription) |
| **GPT-6.1 Sol** (xhigh) | 8.62 | 9.00 | 8.31 | 8.75 | 8.42 | ~48 min | 5.8M in / 243k out tokens |
| **Gemini 4 Neon** (high, agy) | 8.62 | 8.81 | 8.25 | 8.25 | **9.08** | ~30 min | 0.91M in + 5.80M cache-read / 447k out tokens |
| **GPT-6.2 Astra** (xhigh) | 8.58 | 9.25 | 8.50 | 8.00 | 8.17 | ~46 min | 5.8M in / 148k out tokens |
| **DeepSeek V4.1 Flash** (high, CodeBuddy) | 8.46 | 8.75 | 8.19 | 8.50 | 8.42 | ~85 session-min | $0 reported (plan) |
| **muse-wonder-full** (xhigh) | 8.42 | 8.62 | 8.69 | 8.38 | 7.83 | ~31 min | 7.1M in / 198k out tokens; 33% of a 5-hour window (see `RUN_METRICS.md`) |
| **Gemini 4 Hydrogen** (xhigh, agy) | 8.40 | 8.88 | 7.94 | 8.12 | 8.58 | ~29 min | 1.21M in + 11.6M cache-read / 694k out tokens |
| **GPT-6.2 Sol** (xhigh) | 8.35 | 9.25 | 7.69 | 7.75 | 8.42 | ~52 min | 5.8M in / 180k out tokens |
| **Qwen 3.8 Max** (high, OpenRouter) | 8.27 | 8.56 | 8.38 | 8.00 | 7.92 | ~158 session-min | $5.44 |
| **HY4 preview** (high, OpenRouter) | 8.13 | 9.00 | 7.62 | 8.50 | 7.42 | ~113 session-min | $1.57 |
| **HY4** (high, CodeBuddy) | 8.10 | 8.31 | 8.06 | 8.50 | 7.58 | ~125 session-min | $0 reported (plan) |
| **muse-wonder** (xhigh) | 8.08 | 7.81 | 8.19 | 8.62 | 7.92 | ~12 min | 6.7M in / 154k out tokens; subscription quota (see `RUN_METRICS.md`) |
| **HY4 preview via CodeBuddy** (high) | 8.02 | 8.06 | 8.19 | 8.00 | 7.75 | ~66 session-min | $0 reported (plan) |
| **MiniMax M3.1 Flash** (xhigh, mcode) | 7.77 | 8.38 | 6.75 | 7.88 | 8.25 | ~42 min | 0.58M in + 18.6M cache-read / 398k out tokens; free preview |
| **Step-5 preview** (high, OpenRouter) | 7.75 | 8.19 | 7.00 | 7.75 | 8.17 | ~69 session-min | $2.21 |
| **mimo** | 7.63 | 8.06 | 7.56 | 7.38 | 7.33 | not recorded | not recorded |
| **muse** (max) | 7.63 | 7.31 | 7.25 | 8.50 | 8.00 | ~20 min | 6.2M in / 162k out tokens |
| **GLM-5.3** (high, OpenRouter) | 7.58 | 7.75 | 7.62 | 7.12 | 7.58 | ~29 min | $1.49 |
| **GPT-6 Luna** (max) | 7.52 | 7.81 | 7.69 | 7.12 | 7.17 | ~34 min | 3.5M in / 220k out tokens |
| **HY4 Flash** (high, CodeBuddy) | 7.42 | 7.56 | 7.38 | 6.75 | 7.75 | ~42 session-min | $0 reported (plan) |
| **Kimi K3** (high, OpenRouter) | 7.38 | 7.31 | 7.38 | 7.25 | 7.58 | ~14 min | $3.47 |
| **Gemini 4 Argon** (High, Gemini chat, no tools) | 7.31 | 7.38 | 7.19 | 7.38 | 7.33 | ~61 session-min | Google AI Pro plan; 17% of the weekly limit |
| **Mistral Large 4** (high; 12–13 reduced) | 6.58 | 7.19 | 5.88 | 7.00 | 6.42 | ~24 min + re-runs | $1.23 |
| **Gemini 3.1 Pro** (high, agy) | 6.40 | 7.19 | 6.06 | 6.50 | 5.75 | ~27 min | 1.56M in + 7.45M cache-read / 530k out tokens |
| **DeepSeek V4 Pro** (high, OpenRouter) | 6.38 | 7.19 | 6.06 | 5.75 | 6.17 | ~12 min | $0.43 |
| **Gemini 3.8 Flash** (high, agy) | 6.21 | 7.31 | 6.06 | 5.88 | 5.17 | ~22 min | 2.35M in + 16.1M cache-read / 512k out tokens |
| **MiniMax M3** (default, mcode) | 6.00 | 6.50 | 5.56 | 5.62 | 6.17 | ~9 min | 0.55M in + 4.8M cache-read / 190k out tokens |
| **Nemotron 3 Ultra** (high, OpenRouter) | 4.98 | 6.38 | 4.50 | 4.50 | 4.08 | ~8 min | $0.76 |

Totals (of 130): Sonnet 121.5, Fable 5.2 121.5, Opus 119.5, Fable 5.1 119.25, Grok 113.75, Astra 113.25, Haiku 113.0, Sol 112.0, Gemini 4 Neon 112.0, GPT-6.2 Astra 111.5, DeepSeek V4.1 Flash 110.0, muse-wonder-full 109.5, Gemini 4 Hydrogen 109.25, GPT-6.2 Sol 108.5, Qwen 3.8 Max 107.5, HY4 preview 105.75, HY4 105.25, muse-wonder 105.0, HY4 preview via CodeBuddy 104.25, MiniMax M3.1 Flash 101.0, Step-5 preview 100.75, mimo 99.25, muse 99.25, GLM-5.3 98.5, Luna 97.75, HY4 Flash 96.5, Kimi K3 96.0, Gemini 4 Argon 95.0, Mistral Large 4 85.5, Gemini 3.1 Pro 83.25, DeepSeek V4 Pro 83.0, Gemini 3.8 Flash 80.75, MiniMax M3 78.0, Nemotron 3 Ultra 64.75. Session time for the later OpenRouter and CodeBuddy runs is the sum of task session lengths, because their batches were interrupted or ran one task at a time (see `RUN_METRICS.md`); for Argon it is the sum of the kept chat replies, spread over about 20 hours to fit the Gemini plan's 5-hour usage windows. muse-wonder's time is the sum of its two passes (4 min 45 s, then 7 min 15 s); muse-wonder-full ran two tasks at a time (55 min summed); Fable 5.2, Gemini 4 Hydrogen, Gemini 4 Neon and both GPT-6.2 models ran four at a time; HY4, HY4 Flash and DeepSeek V4.1 Flash ran one task at a time, and their session time leaves out attempts cut off by a gateway error; GPT-6.2 Astra's time is its scheduled run (33 min 56 s) plus task 11's re-run (12 min 12 s). Grok's cost is its original run without the interrupted task-13 attempt plus the re-run ($5.27).

### What was observed

- **Every entry completed every task.**
  - **Hidden contract tests:** every model passed them for task 01. For task 02, all but MiniMax M3.1 Flash and Haiku 5.5 passed: their `get` raises on an expired entry but leaves it in the map. Gemini 4 Argon passed both without having run anything.
  - **Frontends:** no page scrolled sideways at 390 px or made a network request.
  - **Interruptions not caused by the model** (each re-run from the template with the identical prompt or command):
    - Astra's tasks 10–13 (quota).
    - GPT-6.2 Astra's task 11 (the workspace ran out of credits; re-run after a refill).
    - Grok's task 13 (usage balance; re-run on 2026-10-16 on cachyos with the same flags and a newer Grok CLI).
    - MiniMax M3.1 Flash's task 11 (job limit).
    - Gemini 3.1 Pro's task 11 (agy's headless permission auto-deny).
    - The third OpenRouter batch (/tmp filled up with opencode's npm caches, then the credit ran out).
    - HY4-preview-through-CodeBuddy's tasks 11 and 13 (the CodeBuddy plan's rate limit).
    - Twelve sessions of the 2026-11-19 CodeBuddy batch, which ended on the TokenHub gateway's `400 … read body failed` error: HY4's tasks 11–13, HY4 Flash's 01–05 and DeepSeek V4.1 Flash's 10–13. HY4's tasks 11 and 13 hit it again on their first re-run.
    - muse-wonder's tasks 10–13 (the Muse subscription's 5-hour window ran out as they started; Muse later reset all quotas after fixing a drain that ran too fast).
    - Gemini 4 Argon's task 07 (the orchestrator navigated the chat away before saving the reply) and tasks 12 and 13 (the chat reset itself mid-reply, twice for task 12).
  - **Three tasks produced nothing at the standard high effort:** Mistral Large 4's 12 and 13, and Qwen 3.8 Max's 13. Each time, a single response's reasoning hit opencode's 32,000-token cap per response. At the user's request they were re-run at reduced effort, and the graders were told so.
- **Sonnet 5.5 and Fable 5.2 tie for first place** (9.35 each, 121.5 of 130), with Opus (9.19) and Fable 5.1 (9.17) close behind. Fable 5.2 led the last pass by 0.03; a tie at this margin says nothing about their order. In this pass Fable 5.2 had the best or tied-best score on 5 of 13 tasks, Sonnet and Opus on 4 each, Grok and Fable 5.1 on 2 each, and nine others on 1 each (most of those are ties at 10 on the bug fix).
- **Six tiers:**
  - **Sonnet, Fable 5.2, Opus and Fable 5.1:** 9.15–9.35 per task.
  - **Grok 4.7, GPT-6 Astra, Haiku 5.5, GPT-6.1 Sol, Gemini 4 Neon, GPT-6.2 Astra, DeepSeek V4.1 Flash, muse-wonder-full, Gemini 4 Hydrogen and GPT-6.2 Sol:** 8.35–8.75.
  - **Qwen 3.8 Max, HY4 preview (both harnesses), HY4, muse-wonder, MiniMax M3.1 Flash and Step-5 preview:** 7.75–8.3.
  - **muse, mimo, GLM-5.3, GPT-6 Luna, HY4 Flash, Kimi K3 and Gemini 4 Argon:** 7.3–7.65.
  - **Mistral Large 4, Gemini 3.1 Pro, DeepSeek V4 Pro, Gemini 3.8 Flash and MiniMax M3:** 6.0–6.6.
  - **Nemotron 3 Ultra:** 4.98, last or tied last on 10 of 13 tasks.
- **Gemini 4 Neon** (`gemini-4-neon-high`, high effort, agy 1.5.12 on the ThinkPad) is 9th at 8.62, level with GPT-6.1 Sol (both 112.0 of 130), and the best Gemini entry: 0.22 above Gemini 4 Hydrogen, which ran through the same harness at xhigh.
  - **Strong:** frontends. Its frontend average (9.08) ties Sonnet's for the best in the field: the editorial page (12: 9.5, tied 1st with Fable 5.1) is a print-journal layout with a metadata masthead and numbered marginal labels, the dashboard (11: 9.0) is 2nd, the plant-care app (13: 8.75) 4th. Also the scheduler (01: 9.25), the bug fix (02: 9.75) and infrastructure (03: 8.75, 6th), where it keeps Postgres read-only with only the capabilities it needs.
  - **Weak:** maintenance (04: 7.5), where a stdlib PEP 440 normaliser rewrites `1.02` and `v1.2.3` and raises on non-PEP 440 strings (documented, but a behaviour change); the story (07: 7.25, 22nd), whose future message is a long explanatory monologue; the weekly plan (10: 7.75), which states QA's Friday availability as fact and calls the Thursday demo confirmed.
  - **Run:** 30 minutes four at a time, 447k output and 221k thinking tokens, fewer than Hydrogen (694k and 466k).
- **DeepSeek V4.1 Flash** (`deepseek/deepseek-flash`, high, Tencent CodeBuddy on the TokenHub plan) is 11th at 8.46, in the second tier and 2.08 above DeepSeek V4 Pro (6.38), which ran through opencode and OpenRouter.
  - **Even:** no task below 7.5. Strong on infrastructure (03: 8.75, 6th, with a tagged-release rollback and an honest list of what Compose does not do), the story (07: 8.75, 5th), incident analysis (09: 8.75) and the plant-care app (13: 8.75, 4th).
  - **Weak:** maintenance (04: 7.5; no `py-modules`, so its CI install step fails); the webhook guide (05: 7.75, 20th), which labels invented details as guarantees and whose 300-second tolerance would reject a retry carrying the original timestamp; the dashboard (11: 8.0), which adds five incidents not in `DATA.json` and sets most text at 9 px.
  - **Run:** the heaviest token user of the batch, 47.8M input (46.9M of it cache reads) and 649k output over 85 session-minutes; each frontend task took 14–21 minutes with many self-screenshots.
- **HY4** (`hy4`, high, CodeBuddy) is 17th at 8.10, in the third tier and level with HY4 preview (8.13 through OpenRouter, 8.02 through CodeBuddy).
  - **Strong:** the bug fix (02: 10, tied best; its 19 tests kill every mutant), the webhook guide (05: 8.75), incident analysis (09: 8.75) and the product plan (06: 8.5), which never purges unsynced data.
  - **Weak:** the dashboard (11: 6.75, 24th), whose mobile layout keeps the nav rail as a narrow column and cuts off table columns; social media (08: 7.25, 26th), with invented product facts and a 354-character Bluesky reply; maintenance (04: 7.0), which imports `packaging` only to discard the result and has no `py-modules`; infrastructure (03: 7.5).
  - **Run:** 125 session-minutes one task at a time, the slowest of the batch.
- **HY4 Flash** (`hy4-flash`, high, CodeBuddy) is 26th at 7.42, in the fourth tier, 0.68 below HY4.
  - **Weak:** the product plan (06: 5.5, 30th), whose capture-age purge can delete unsynced work and whose sections contradict each other; maintenance (04: 5.25, 27th), a canonicalising normaliser with a new dependency while the changelog claims output is preserved, and tests that can't tell the difference; the weekly plan (10: 6.5, 29th), which splits the two-hour finance block; incident analysis (09: 7.0), with factual slips.
  - **Better:** the bug fix (02: 9.75), social media (08: 8.25) and the editorial page (12: 8.0).
  - **Run:** 42 session-minutes and 252k output tokens, the lightest of the four new entries.
- **GPT-6.2 Sol and GPT-6.2 Astra** (`gpt-6.2-sol` and `gpt-6.2-astra`, both xhigh, Codex CLI 0.170.0 on the Mac) are 14th at 8.35 and 10th at 8.58. Both are in the second tier, a little below their predecessors in the same pass (GPT-6.1 Sol 8.62, GPT-6 Astra 8.71), which is within the noise.
  - **Code is unchanged:** both score 9.25 on code against 9.0–9.19 for their predecessors. Both build task 01 on `graphlib.TopologicalSorter` and pass every hidden test.
  - **Weak:** incident analysis. Sol scores 6.75 (27th) and Astra 7.5 (21st), against 8.25 and 8.5 for their predecessors: short write-ups with little mechanism depth, thin or missing contributing-factors sections, and short customer updates.
  - **Strong:** Sol's infrastructure task (03: 9.25, 1st), with Compose file secrets and a separate least-privilege database role; its weekly plan (10: 8.75). Astra's plan (06: 8.5), which rejects timers as insufficient for the 24-hour purge, and its weekly plan (10: 8.5).
  - **Style:** terse throughout. RESPONSE.md files fold causes and fixes together, and the graders often marked them down for what they leave out rather than for errors.
  - **Run:** Sol took 52 minutes, Astra 46, with the same input tokens as GPT-6.1 Sol and less output (180k and 148k against 243k). They ran on a different account (ChatGPT Team) from the earlier GPT runs and with an isolated Codex home rather than a set-aside `AGENTS.md`.
- **Fable 5.2** (`claude-fable-5-2`, high effort, Claude Code CLI on the ThinkPad) is tied 1st at 9.35, 0.18 ahead of Fable 5.1, with the best or tied-best score on 5 tasks: the scheduler (01: 9.75, with Grok), the story (07: 9.5), social media (08: 9.75), incident analysis (09: 9.75) and the weekly plan (10: 9.5, with Sonnet).
  - **Weaker:** nothing below 8.75 (infrastructure, 03). Its task-02 suite (37 tests) adds NaN and constructor-validation tests the brief doesn't ask for, so it fails every other implementation in the cross-test.
  - **Run:** 30 minutes, $33.66 at API prices (subscription, nothing charged). It is not like-for-like with Fable 5.1, which ran in Claude Code's cloud on extra effort.
- **Gemini 4 Hydrogen** (`gemini-4-hydrogen-xhigh` through agy) is 13th at 8.40, about two points above Gemini 3.1 Pro (6.40) and 3.8 Flash (6.21) run the same way, 1.09 above Argon through the chat (7.31), and 0.22 below Gemini 4 Neon.
  - **Weak:** maintenance (04: 7.5), with a stdlib PEP 440 normaliser like Neon's (documented, but a behaviour change); the story (07: 7.5); the weekly plan (10: 7.5), which never firmly places the patch review and assumes QA's availability.
  - **Strong:** the scheduler (01: 9.5, 3rd, with a deep-chain recursion test), the bug fix (02: 9.75) and the dashboard (11: 9.0, 2nd).
- **muse-wonder-full** (Meta's `muse-wonder-full-1.0`, Muse Code 1.4.10, xhigh) is 12th at 8.42, 0.13 lower than in the last pass and 0.34 ahead of muse-wonder (8.08). Its writing average (8.69) is the second best outside the top tier, after Haiku (9.0); its frontends are its weakest group (7.83).
- **Gemini 4 Argon** (Thinking: High, through the Gemini web chat because no API access was available) is 28th at 7.31. That is about a point above Gemini 3.1 Pro and 3.8 Flash through agy, and 1.09 and 1.31 below Gemini 4 Hydrogen and Neon through agy, but it worked under a handicap no other entry had: each task's files were pasted into one chat message and it returned whole files, so it never ran its code or tests or saw its pages.
  - **Strong:** the editorial page (12: 8.75, 7th) and the webhook guide (05: 8.5); the bug fix (02: 9.5) is behaviourally correct.
  - **Weak:** maintenance (04: 6.0), where its regex version normaliser rewrites `1.02` while the changelog says output is preserved; the story (07: 6.25), whose middle explains its own twist with pseudo-technical detail; social media (08: 7.25), where the replies invent a Help-menu diagnostic log export, a support email and a billing adjustment; and the scheduler (01: 7.25), whose recursive cycle search crashes on long cycles.
  - **Verification claims:** in tasks 01 and 02 its RESPONSE.md reports test runs that could not have happened (01 says "All 11 unit tests … pass" for a file with 13). In task 04 it says execution was unavailable but still labels ruff "PASS". The tests do pass when run.
  - **Speed and usage:** about an hour of reply time, spread over 20 hours by the Google AI Pro plan's 5-hour windows (a task took roughly a fifth to a third of a window). It reported its model ID as `gemini-3.1-pro-preview` in every reply.
- **Grok 4.7** is 5th at 8.75, with the best or tied-best score on the scheduler (01: 9.75) and the bug fix (02: 10) and strong code overall (9.38).
- **muse-wonder** is 18th at 8.08, 0.45 ahead of muse-spark (7.63). Strong on the bug fix (02: 10) and social media (08: 9.0); still weak on infrastructure (03: 6.0, 31st of 34), where it drops every Linux capability from Redis and nginx, including the ones their stock entrypoints need, so the stack likely never starts (inferred from the images; no containers were started).
- **Grading noise:**
  - **Per task:** between the thirty-way and thirty-four-way passes, scores for the same submissions moved by 0.41 points on average, and 50 of 390 moved by a point or more.
  - **Per model:** averages moved by 0.08 on average. The largest moves were Mistral Large 4 +0.29, Gemini 3.1 Pro +0.21, GPT-6 Luna +0.17 and Haiku 5.5 −0.15.
  - **What it means:** as before, a model's average can move about ±0.3–0.4 from one pass to the next, with no steady direction.
- **HY4 preview through CodeBuddy against OpenRouter/opencode:** 8.02 against 8.13, the same order as in the last pass (7.98 against 8.15) after five sign changes before it.
  - **Where CodeBuddy did better:** the dashboard (11: 8.25 against 6.25), social media (08: 8.25 against 7.0) and the webhook guide (05: 8.0 against 7.5).
  - **Where it did worse:** maintenance (04: 7.25 against 8.75), infrastructure (03: 6.75 against 8.25) and the scheduler (01: 8.75 against 9.5).
  - This doesn't show that either harness is better. It shows that a single run varies a lot task by task, and that grading does too.
- **Nemotron 3 Ultra** is last by about 1.0 point. It's last or tied last on 10 of 13 tasks and 28th or lower on all 13, and its task-04 run tried `pip install` twice (blocked).
- **Patterns across the field are unchanged:**
  - packages that don't build;
  - `normalize_version` output changed while claimed unchanged;
  - Redis left unauthenticated, or hardened until it can't start;
  - invented product facts in social posts;
  - "no alert" treated as "no impact";
  - CSS that overrides the `hidden` attribute.

### What is inferred

- **Only large differences are reliable.** With 34 entries and model averages moving by up to ±0.4 between passes, differences under about 0.4 aren't meaningful. The four in the top tier can't be separated (Sonnet and Fable 5.2 are tied, Fable 5.1 0.18 behind), nor can the ten in the second. The top tier is 0.42 clear of the second and Nemotron a point below the rest; the bottom tier of five is 0.7 below the fourth. The boundaries between tiers two, three and four are rough: the gaps there are 0.08 and 0.12, so a model near one can sit on either side in another pass.
- **GPT-6.2 against the earlier GPT-6 models:** no measurable gain on these tasks. Sol is 0.27 and Astra 0.13 below their predecessors, both within the noise; their code is as strong and their output shorter. Their one consistent weakness, thin incident write-ups, is a single task, so it may not hold over another run. The 6.2 runs also used a different account, Codex release and isolation method, which this design can't separate from the model.
- **Fable 5.2 against Fable 5.1:** 9.35 against 9.17, within the noise floor, and the two ran in different harnesses (local CLI on high against the cloud on extra). This says 5.2 is at least as good on these tasks at a lower effort setting, not that it is better.
- **Gemini 4 Neon against Gemini 4 Hydrogen:** 8.62 against 8.40, within the noise. Neon ran at high effort and Hydrogen at xhigh, with agy 1.5.12 against 1.5.8. Neon's clearest lead is on frontends (9.08 against 8.58); elsewhere they are close. So Neon is at least as good at a lower effort setting, with fewer output and thinking tokens.
- **Gemini 4 Hydrogen and Neon against the earlier Gemini models:** the two-point gap to Gemini 3.1 Pro and 3.8 Flash through the same harness is far beyond the noise, so it is a real improvement. Part of it may be the newer agy (1.5.x against 1.3.3), whose sandbox let the 4.x models look at their own pages; the frontend gap (8.58–9.08 against about 5.5) is the largest.
- **HY4 against HY4 preview:** no measurable change (8.10 against 8.02 through CodeBuddy and 8.13 through OpenRouter). HY4 Flash is 0.68 below HY4, at the edge of the noise, and lower on code, writing and operations alike; with one run each, treat it as probably weaker rather than certainly.
- **DeepSeek V4.1 Flash against DeepSeek V4 Pro:** 8.46 against 6.38 is far beyond the noise, but it can't be put down to the model alone. V4 Pro ran through opencode and OpenRouter, whose 32k cap per response hurt several high-effort runs; V4.1 Flash ran through CodeBuddy on the TokenHub plan. The comparison is of two model-plus-harness pairs.
- **The Muse models:** muse-wonder-full is ahead of muse-wonder by 0.34 and of muse-spark by 0.79. The full-versus-wonder gap is within the noise for one run each; much of it comes from infrastructure (03: 8.25 against 6.0), where wonder's output was likely broken, so the full model's gain looks like fewer serious mistakes rather than better work everywhere. wonder against muse-spark (0.45) is within the noise. The three ran in different Muse Code releases with different blank-slate setups; wonder-full ran on Linux under bubblewrap rather than the Mac's sandbox.
- **Gemini 4 Argon's score measures the model plus a tool-less chat harness.** Every other entry could run its tests and, in most harnesses, open its pages; Argon could not, and its weakest areas (version behaviour in 04, invented details in 08) are ones that checking or a closer reading of the sources would have caught. Its result is not directly comparable to an agentic run of the same model, and says little about Argon in an agent harness. Against Gemini 3.1 Pro and 3.8 Flash through agy it is ahead (7.31 against 6.40 and 6.21) despite the handicap; Gemini 4 Hydrogen and Neon, agentic through agy, are well ahead of it (8.40 and 8.62).
- **Harness effects are smaller than run-to-run variation, as far as this design can show.** One run per entry can't separate harness from luck. Measuring that would take several runs of the same model in each harness.
- **The OpenRouter results describe each model as served by OpenRouter through opencode.** opencode's fixed 32k cap per response affected Mistral's and Qwen's high-effort frontend attempts.
- **The HY4, HY4 Flash and DeepSeek V4.1 Flash results describe each model through CodeBuddy on the TokenHub plan.**
- **The Gemini 3.1 Pro, 3.8 Flash, 4 Hydrogen and 4 Neon results describe Gemini through agy's headless mode; Argon's describe the Gemini web chat.**
- Opus 5.5 on extra effort might score higher. This run can't say.

## Recommendations by work type

- **Code:** Sonnet 5.5 (9.56), Fable 5.2 or Fable 5.1 (9.44), Opus 5.5 or Grok (9.38). The GPT-6.2 models (9.25) and GPT-6 Astra (9.19) are close behind.
- **Writing and planning:** Fable 5.2 or Opus 5.5 (9.38), then Sonnet 5.5 (9.25). Haiku 5.5 (9.0) and muse-wonder-full (8.69) are the best choices outside the top tier.
- **Incident analysis and operations:** Fable 5.2 (9.62) or Sonnet 5.5 (9.5), then Opus or Fable 5.1 (9.38). Avoid the GPT-6.2 models (7.75–8.0) and HY4 Flash (6.75) here without review.
- **Frontend:** Sonnet 5.5 or Gemini 4 Neon (9.08), Fable 5.2 (9.0) or Fable 5.1 (8.92). Grok (8.83) follows, then Opus and Gemini 4 Hydrogen (8.58).
- **Cost-sensitive work:** Haiku 5.5 ($1.74 at API prices for second-tier quality). Among the OpenRouter models, HY4 preview ($1.57) is the best value. On the TokenHub plan through CodeBuddy, DeepSeek V4.1 Flash gives second-tier quality with no per-task charge reported, at a high token count. Within a Muse subscription, muse-wonder-full gives second-tier quality for about 2.5% of a 5-hour window per task. On a Google account, Gemini 4 Neon (or Hydrogen) through agy gives second-tier quality with no per-task charge reported.
- **Not for unsupervised work on these task types:** Nemotron 3 Ultra, Gemini 3.1 Pro and 3.8 Flash through agy (use Gemini 4 Neon or Hydrogen instead), MiniMax M3, DeepSeek V4 Pro through OpenRouter (DeepSeek V4.1 Flash through CodeBuddy scored two points higher) and Mistral Large 4. Check muse-wonder's infrastructure output, and HY4 Flash's maintenance and planning output, before using them. Through a chat window, Gemini 4 Argon's code and claims need checking: it reports test runs it never made.

## Caveats

- **One run per entry and one blind grader per task per pass.** In the thirty-four-way pass the task-06 grader split the reading of the 34 submissions among seven read-only helper agents with a shared checklist, then scored all 34 itself on one scale and checked the key claims of six against the plans directly (the thirty-way pass's task-06 grader worked the same way with six helpers); every other task was read by its one grader. The graders were Claude Opus 5.5 subagents, so five contestants share its model family and one is the same model. Blinding reduces that bias but doesn't remove it. The grader brief was rewritten for the twelve-way pass (`tools/grader-prompt.md`; the original wasn't kept). The twenty-four-way pass ran on the Mac with the same brief, adapted only for paths and the browser (Playwright's bundled Chromium instead of Chrome); the twenty-five-way and twenty-six-way passes ran on cachyos with Chrome, the twenty-eight-way pass on the ThinkPad with Chrome, the thirty-way pass on the Mac with Chrome, and the thirty-four-way pass on the ThinkPad with Chrome (paths and the Chrome location adapted; graders got their own copy of Playwright outside the repository). On the Mac the graders' sandbox blocked local network servers, so the frontend graders served pages through Playwright request interception instead of `python3 -m http.server`, and Docker and nginx were not available, so the task-03 grader checked compose files by parsing them rather than with `docker compose config`.
- **Effort levels differ:**
  - Sonnet and Fable 5.1 ran on extra, Opus and Fable 5.2 on high, and Haiku on xhigh.
  - The GPT and Grok models ran on xhigh, except Luna, which ran on max.
  - Gemini 3.1 Pro and 3.8 Flash ran on agy's High variants, Gemini 4 Hydrogen on agy's XHigh variant with `--effort xhigh`, Gemini 4 Neon on its High variant with `--effort high`, Gemini 4 Argon on the Gemini app's Thinking level High, the OpenRouter models on opencode's `high` variant (three tasks at reduced effort), and HY4 preview, HY4, HY4 Flash and DeepSeek V4.1 Flash via CodeBuddy on `high`.
  - muse ran on max, muse-wonder and muse-wonder-full on xhigh, and mimo on its default.
- **Different setups:**
  - Sonnet, Fable 5.1 and Opus ran in Claude Code's cloud.
  - Haiku ran in the Claude Code CLI, and Gemini 3.1 Pro and 3.8 Flash in the Antigravity CLI, both on cachyos with OS sandboxes. Fable 5.2 (Claude Code CLI 2.1.325), Gemini 4 Hydrogen (agy 1.5.8) and Gemini 4 Neon (agy 1.5.12) ran the same way on the ThinkPad; those agy versions let the model take headless Firefox screenshots of its pages, which the 3.x runs could not.
  - The eight OpenRouter models ran in opencode, and HY4 preview also in CodeBuddy, on cachyos with **no OS sandbox**. HY4, HY4 Flash and DeepSeek V4.1 Flash ran in CodeBuddy 2.185 on the ThinkPad the same way, on the user's Tencent Cloud TokenHub plan and one task at a time. Permission rules and a transcript audit stood in for a sandbox; CodeBuddy ran with the user's real HOME because its sign-in requires it.
  - The GPT models ran in Codex CLI and Grok in Grok CLI on the Mac; GPT-6.2 Sol and Astra ran in Codex CLI 0.170.0 on a ChatGPT Team account, with a dedicated HOME and CODEX_HOME holding only the login, so none of the user's skills, plugins or `AGENTS.md` applied; Grok's task 13 was re-run in Grok CLI on cachyos (Linux workspace sandbox, same flags).
  - Gemini 4 Argon ran in the Gemini web chat (Google AI Pro account), in the Claude desktop app's browser: one temporary chat per task, each task's files pasted into a single message, and the reply's files copied out verbatim (checked with SHA-256). It had no tools. Its context included the account's location and two saved custom skills; no past chats or memories.
  - The MiniMax models ran through mcode, muse through tincan, and mimo a week earlier.
  - muse-wonder ran in Muse Code on the Mac with a clean HOME (no personal skills, rules or earlier sessions) inside an outer macOS sandbox that blocked reads of the rest of the home directory and all network except HTTPS. muse-wonder-full ran in Muse Code on cachyos with the same flags, a clean HOME per task and bubblewrap in place of the macOS sandbox (home directory, /tmp and mounts hidden; network not restricted, though a tool-call audit found none used). The earlier muse run loaded the user's skills and used Muse's own sandbox.
  - Every setup kept personal instructions, memory and other models' outputs out.
- **Cost figures aren't comparable across providers.** The cloud Claude figures come from account balances, Haiku's is an API-equivalent figure, and CodeBuddy reports $0 for plan usage. OpenRouter and Grok report dollars, the Muse runs report tokens and subscription quota, Argon reports only the Gemini plan's usage meter, and the others report tokens.
- **Objective checks for earlier models are carried over** from their original runs; muse-wonder's were run on the Mac, where re-running the full cross-test matrix reproduced every recorded result. Argon's and muse-wonder-full's checks and Grok's task-13 screenshots were run on cachyos, Fable 5.2's, Hydrogen's, Neon's, HY4's, HY4 Flash's and DeepSeek V4.1 Flash's on the ThinkPad (task-04 suites with the system Python, which has `packaging`); the four newest entries' cross-test rows and columns were added there, and the two existing cells that came out differently on re-running kept their recorded values. On cachyos, task-04 suites that import `packaging` were run in a scratch venv with it. GPT-6.2 Sol's and Astra's checks and screenshots were run on the Mac (Python 3.15, Chrome); their cross-test rows and columns were added there, and the three existing cells that came out differently under Python 3.15 kept their recorded values.
- **Not checked:** nginx syntax in task 03 (no nginx binary was available). No containers were started. The task-04 grader of this pass ran ruff where it found a cached binary.
