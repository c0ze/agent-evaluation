## Results

Scores come from the latest blind pass, which graded all thirty entries together (2026-11-19, after GPT-6.2 Sol and GPT-6.2 Astra were added). HY4 preview appears twice: once through OpenRouter and opencode, once through CodeBuddy. Gemini 4 Argon ran through the Gemini web chat, with no tools: it could not run code, tests or a browser (see the caveats). Three OpenRouter submissions ran at reduced reasoning effort: Mistral Large 4's tasks 12 and 13, and Qwen 3.8 Max's task 13. Their high-effort attempts produced nothing.

| | Avg / task | Code | Writing | Ops | Frontend | Time | Cost / usage |
|---|---|---|---|---|---|---|---|
| **Fable 5.2** (high, CLI) | **9.38** | 9.56 | **9.50** | **9.38** | 9.00 | ~30 min | $33.66 API-equivalent (subscription) |
| **Sonnet 5.5** (extra) | 9.35 | **9.69** | 9.31 | 9.25 | 9.00 | ~28 min | $15 |
| **Fable 5.1** (extra) | 9.17 | 9.50 | 9.06 | 8.75 | **9.17** | ~49 min | $53 |
| **Opus 5.5** (high) | 9.15 | 9.62 | 9.31 | 9.00 | 8.42 | ~21 min | $14 |
| **Haiku 5.5** (xhigh) | 8.85 | 8.75 | 9.06 | 8.75 | 8.75 | ~34 min | $1.74 API-equivalent (subscription) |
| **Grok 4.7** (xhigh) | 8.71 | 9.38 | 8.19 | 8.62 | 8.58 | ~80 min + 52 min (task 13 re-run) | $12.01 |
| **GPT-6 Astra** (xhigh) | 8.65 | 9.31 | 8.44 | 8.50 | 8.17 | ~35 min | 3.6M in / 185k out tokens |
| **muse-wonder-full** (xhigh) | 8.56 | 8.81 | 8.88 | 8.62 | 7.75 | ~31 min | 7.1M in / 198k out tokens; 33% of a 5-hour window (see `RUN_METRICS.md`) |
| **GPT-6.1 Sol** (xhigh) | 8.52 | 9.06 | 8.25 | 8.25 | 8.33 | ~48 min | 5.8M in / 243k out tokens |
| **GPT-6.2 Astra** (xhigh) | 8.44 | 9.00 | 8.62 | 7.00 | 8.42 | ~46 min | 5.8M in / 148k out tokens |
| **GPT-6.2 Sol** (xhigh) | 8.42 | 9.06 | 8.19 | 7.88 | 8.25 | ~52 min | 5.8M in / 180k out tokens |
| **Gemini 4 Hydrogen** (xhigh, agy) | 8.35 | 8.88 | 7.94 | 7.75 | 8.58 | ~29 min | 1.21M in + 11.6M cache-read / 694k out tokens |
| **HY4 preview** (high, OpenRouter) | 8.15 | 9.00 | 7.75 | 8.38 | 7.42 | ~113 session-min | $1.57 |
| **muse-wonder** (xhigh) | 8.13 | 8.06 | 8.25 | 8.25 | 8.00 | ~12 min | 6.7M in / 154k out tokens; subscription quota (see `RUN_METRICS.md`) |
| **Qwen 3.8 Max** (high, OpenRouter) | 8.13 | 8.56 | 8.06 | 8.38 | 7.50 | ~158 session-min | $5.44 |
| **HY4 preview via CodeBuddy** (high) | 7.98 | 8.06 | 8.19 | 7.75 | 7.75 | ~66 session-min | $0 reported (plan) |
| **Step-5 preview** (high, OpenRouter) | 7.87 | 8.25 | 7.31 | 7.62 | 8.25 | ~69 session-min | $2.21 |
| **MiniMax M3.1 Flash** (xhigh, mcode) | 7.79 | 8.25 | 6.75 | 7.50 | 8.75 | ~42 min | 0.58M in + 18.6M cache-read / 398k out tokens; free preview |
| **muse** (max) | 7.69 | 7.31 | 7.44 | 8.00 | 8.33 | ~20 min | 6.2M in / 162k out tokens |
| **mimo** | 7.63 | 7.94 | 8.06 | 7.38 | 6.83 | not recorded | not recorded |
| **GLM-5.3** (high, OpenRouter) | 7.60 | 7.88 | 7.94 | 6.50 | 7.50 | ~29 min | $1.49 |
| **Kimi K3** (high, OpenRouter) | 7.42 | 7.44 | 7.25 | 6.88 | 8.00 | ~14 min | $3.47 |
| **GPT-6 Luna** (max) | 7.35 | 7.38 | 7.69 | 7.00 | 7.08 | ~34 min | 3.5M in / 220k out tokens |
| **Gemini 4 Argon** (High, Gemini chat, no tools) | 7.23 | 7.56 | 7.00 | 6.88 | 7.33 | ~61 session-min | Google AI Pro plan; 17% of the weekly limit |
| **Mistral Large 4** (high; 12–13 reduced) | 6.29 | 7.50 | 5.50 | 6.00 | 5.92 | ~24 min + re-runs | $1.23 |
| **DeepSeek V4 Pro** (high, OpenRouter) | 6.25 | 7.12 | 6.00 | 5.38 | 6.00 | ~12 min | $0.43 |
| **Gemini 3.1 Pro** (high, agy) | 6.19 | 7.00 | 6.25 | 5.38 | 5.58 | ~27 min | 1.56M in + 7.45M cache-read / 530k out tokens |
| **Gemini 3.8 Flash** (high, agy) | 6.12 | 7.38 | 5.88 | 5.75 | 5.00 | ~22 min | 2.35M in + 16.1M cache-read / 512k out tokens |
| **MiniMax M3** (default, mcode) | 6.06 | 6.69 | 5.44 | 4.88 | 6.83 | ~9 min | 0.55M in + 4.8M cache-read / 190k out tokens |
| **Nemotron 3 Ultra** (high, OpenRouter) | 4.92 | 6.25 | 4.62 | 4.75 | 3.67 | ~8 min | $0.76 |

Totals (of 130): Fable 5.2 122.0, Sonnet 121.5, Fable 5.1 119.25, Opus 119.0, Haiku 115.0, Grok 113.25, Astra 112.5, muse-wonder-full 111.25, Sol 110.75, GPT-6.2 Astra 109.75, GPT-6.2 Sol 109.5, Gemini 4 Hydrogen 108.5, HY4 106.0, muse-wonder 105.75, Qwen 3.8 Max 105.75, HY4 via CodeBuddy 103.75, Step-5 preview 102.25, MiniMax M3.1 Flash 101.25, muse 100.0, mimo 99.25, GLM-5.3 98.75, Kimi K3 96.5, Luna 95.5, Gemini 4 Argon 94.0, Mistral Large 4 81.75, DeepSeek V4 Pro 81.25, Gemini 3.1 Pro 80.5, Gemini 3.8 Flash 79.5, MiniMax M3 78.75, Nemotron 3 Ultra 64.0. Session time for the later OpenRouter and CodeBuddy runs is the sum of task session lengths, because their batches were interrupted (see `RUN_METRICS.md`); for Argon it is the sum of the kept chat replies, spread over about 20 hours to fit the Gemini plan's 5-hour usage windows. muse-wonder's time is the sum of its two passes (4 min 45 s, then 7 min 15 s); muse-wonder-full ran two tasks at a time (55 min summed); Fable 5.2, Gemini 4 Hydrogen and both GPT-6.2 models ran four at a time; GPT-6.2 Astra's time is its scheduled run (33 min 56 s) plus task 11's re-run (12 min 12 s). Grok's cost is its original run without the interrupted task-13 attempt plus the re-run ($5.27).

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
    - HY4-through-CodeBuddy's tasks 11 and 13 (the CodeBuddy plan's rate limit).
    - muse-wonder's tasks 10–13 (the Muse subscription's 5-hour window ran out as they started; Muse later reset all quotas after fixing a drain that ran too fast).
    - Gemini 4 Argon's task 07 (the orchestrator navigated the chat away before saving the reply) and tasks 12 and 13 (the chat reset itself mid-reply, twice for task 12).
  - **Three tasks produced nothing at the standard high effort:** Mistral Large 4's 12 and 13, and Qwen 3.8 Max's 13. Each time, a single response's reasoning hit opencode's 32,000-token cap per response. At the user's request they were re-run at reduced effort, and the graders were told so.
- **Fable 5.2 and Sonnet 5.5 share first place** (9.38 and 9.35, 0.03 apart), with Fable 5.1 (9.17) and Opus (9.15) close behind. Sonnet was first in the last three passes; the order of the top two has no meaning at this margin. In this pass Fable 5.2 had the best or tied-best score on 6 of 13 tasks, Sonnet and Opus on 5 each, Astra, Fable 5.1 and MiniMax M3.1 Flash on 2 each, and Grok, Sol, GLM-5.3 and Haiku on 1 each.
- **Six tiers:**
  - **Fable 5.2, Sonnet, Fable 5.1 and Opus:** 9.15–9.4 per task.
  - **Haiku 5.5, Grok 4.7, GPT-6 Astra, muse-wonder-full, GPT-6.1 Sol, GPT-6.2 Astra, GPT-6.2 Sol and Gemini 4 Hydrogen:** 8.35–8.85.
  - **HY4 preview (both harnesses), muse-wonder, Qwen 3.8 Max, Step-5 preview, MiniMax M3.1 Flash, muse, mimo and GLM-5.3:** 7.6–8.15.
  - **Kimi K3, GPT-6 Luna and Gemini 4 Argon:** 7.2–7.45.
  - **Mistral Large 4, DeepSeek V4 Pro, Gemini 3.1 Pro, Gemini 3.8 Flash and MiniMax M3:** 6.05–6.3.
  - **Nemotron 3 Ultra:** 4.9, last or tied last on 7 of 13 tasks.
- **GPT-6.2 Sol and GPT-6.2 Astra** (`gpt-6.2-sol` and `gpt-6.2-astra`, both xhigh, Codex CLI 0.170.0 on the Mac) are 11th at 8.42 and 10th at 8.44. Both are in the second tier, a little below their predecessors in the same pass (GPT-6.1 Sol 8.52, GPT-6 Astra 8.65), which is within the noise.
  - **Code is unchanged:** both score 9.0–9.06 on code against 9.06–9.31 for their predecessors. Both build task 01 on `graphlib.TopologicalSorter` and pass every hidden test.
  - **Weak:** operations. On incident analysis Sol scores 6.75 and Astra 6.5 (20th and 21st), against 8.0 and 8.25 for their predecessors: short write-ups with little mechanism depth, thin or missing contributing-factors sections, and customer updates with no apology. Astra's weekly plan (10: 7.5) barely separates hard deadlines from preferences, while Sol's (10: 9.0) is 3rd.
  - **Strong:** Astra's plant-care app (13: 9.25, 5th), plan (06: 8.75) and story (07: 8.75); Sol's least-privilege database setup in the infrastructure task (03: 8.75, 8th) and its plan and plant-care app (10 and 13: 9.0).
  - **Style:** terse throughout. RESPONSE.md files fold causes and fixes together, and the graders often marked them down for what they leave out rather than for errors.
  - **Run:** Sol took 52 minutes, Astra 46, with the same input tokens as GPT-6.1 Sol and less output (180k and 148k against 243k). They ran on a different account (ChatGPT Team) from the earlier GPT runs and with an isolated Codex home rather than a set-aside `AGENTS.md`.
- **Fable 5.2** (`claude-fable-5-2`, high effort, Claude Code CLI on the ThinkPad) is 1st at 9.38, 0.03 ahead of Sonnet and 0.21 ahead of Fable 5.1, with the best or tied-best score on 6 tasks: the scheduler (01: 10), the webhook guide (05: 9.75), the story (07: 9.25), social media (08: 9.75), incident analysis (09: 9.25) and the weekly plan (10: 9.5).
  - **Notable work:** the strongest test suite for task 01 (51 tests, including a reference-model comparison on random graphs and permutation tests); a story whose twist is shown by a physical clue rather than explained; an incident write-up that rates each link of the causal chain as observed, inferred or weakly supported.
  - **Weaker:** nothing below 9.0. The editorial page (12: 9.0) still has no live region on its form; its task-02 suite adds NaN and constructor-validation tests the brief doesn't ask for, so it fails all 29 other implementations in the cross-test.
  - **Run:** 30 minutes, $33.66 at API prices (subscription, nothing charged). It is not like-for-like with Fable 5.1, which ran in Claude Code's cloud on extra effort.
- **Gemini 4 Hydrogen** (`gemini-4-hydrogen-xhigh` through agy) is 12th at 8.35, at the bottom of the second tier and about two points above Gemini 3.1 Pro (6.19) and 3.8 Flash (6.12) run the same way, and 1.12 above Argon through the chat (7.23).
  - **Weak:** maintenance (04: 7.5), where it writes its own PEP 440 canonicaliser that rewrites `1.02` and `v1.0` (documented, but a behaviour change); the story (07: 7.5), competent but plot-driven; incident analysis (09: 7.5), which labels some inferences as observed.
  - **Strong:** the scheduler (01: 9.75, tied 3rd), the bug fix (02: 9.5), and the frontends (13: 9.0, 12: 8.75). Unlike the Gemini 3.x runs, agy's sandbox now let it screenshot its own pages, which it did on all three frontend tasks.
- **muse-wonder-full** (Meta's `muse-wonder-full-1.0`, Muse Code 1.4.10, xhigh) is 8th at 8.56, unchanged from the last pass and 0.43 ahead of muse-wonder (8.13). Its writing average (8.88) is the second best outside the top tier, after Haiku (9.06); its frontends are its weakest group (7.75).
- **Gemini 4 Argon** (Thinking: High, through the Gemini web chat because no API access was available) is 24th at 7.23. That is about a point above Gemini 3.1 Pro and 3.8 Flash through agy and 1.12 below Gemini 4 Hydrogen through agy, but it worked under a handicap no other entry had: each task's files were pasted into one chat message and it returned whole files, so it never ran its code or tests or saw its pages.
  - **Strong:** the plan and the editorial page (06 and 12: 8.5); the bug fix (02: 9.25) is behaviourally correct.
  - **Weak:** maintenance (04: 6.25), where its hand-written version normaliser changes ordinary versions (`1.02.0` → `1.2.0`) while the changelog says output is preserved; social media (08: 5.5), where the replies invent a Help-menu diagnostic log, a support email and a billing adjustment; the story (07: 6.0), whose middle explains its own twist with pseudo-technical detail; and the scheduler (01: 7.75), whose recursive cycle search crashes on long cycles.
  - **Verification claims:** in tasks 01 and 02 its RESPONSE.md reports test runs that could not have happened (01 says "All 11 unit tests … pass" for a file with 13). In task 04 it says execution was unavailable but still labels ruff "PASS". The tests do pass when run.
  - **Speed and usage:** about an hour of reply time, spread over 20 hours by the Google AI Pro plan's 5-hour windows (a task took roughly a fifth to a third of a window). It reported its model ID as `gemini-3.1-pro-preview` in every reply.
- **Grok 4.7** is 6th at 8.71, with the best or tied-best score on the bug fix (02: 10) and strong code overall (9.38).
- **muse-wonder** is 14th at 8.13, 0.44 ahead of muse-spark (7.69). Strong on the bug fix (02: 9.75) and social media (08: 8.75); still weak on infrastructure (03: 6.0, 26th of 30), where it drops every Linux capability from Redis and nginx, including the ones their stock entrypoints need, so the stack likely never starts (inferred from the images; no containers were started).
- **Grading noise:**
  - **Per task:** between the twenty-eight-way and thirty-way passes, scores for the same submissions moved by 0.50 points on average, and 69 of 364 moved by a point or more.
  - **Per model:** averages moved by 0.12 on average. The largest moves were Mistral Large 4 −0.38, Gemini 3.8 Flash −0.35, and HY4 preview and muse-wonder +0.31 each (both reversing their moves in the last pass).
  - **What it means:** as before, a model's average can move about ±0.4 from one pass to the next, with no steady direction.
- **HY4 preview through CodeBuddy against OpenRouter/opencode:** 7.98 against 8.15, flipped again from the last pass (8.13 against 7.85).
  - **Where CodeBuddy did better:** the webhook guide (05: 9.25 against 7.75), social media (08: 8.5 against 7.0) and the dashboard (11: 8.0 against 6.5).
  - **Where it did worse:** maintenance (04: 7.0 against 9.0), infrastructure (03: 6.75 against 8.5) and the story (07: 7.5 against 9.0).
  - The gap has now changed sign five times, so this doesn't show that either harness is better. It shows that a single run varies a lot task by task, and that grading does too.
- **HY4 preview through OpenRouter** (8.15) leads the third tier, with muse-wonder and Qwen 3.8 Max (8.13) level behind it.
- **Nemotron 3 Ultra** is last by about 1.1 points. It's last or tied last on 7 of 13 tasks and 28th or lower on 12, and its task-04 run tried `pip install` twice (blocked).
- **Patterns across the field are unchanged:**
  - packages that don't build;
  - `normalize_version` output changed while claimed unchanged;
  - Redis left unauthenticated, or hardened until it can't start;
  - invented product facts in social posts;
  - "no alert" treated as "no impact";
  - CSS that overrides the `hidden` attribute.

### What is inferred

- **Only tier-level differences are reliable.** With 30 entries and model averages moving by up to ±0.4 between passes, differences under about 0.4 aren't meaningful. The four in the top tier can't be separated (Fable 5.2 and Sonnet are 0.03 apart), nor can the eight in the second. The gaps between tiers are still well beyond that.
- **GPT-6.2 against the earlier GPT-6 models:** no measurable gain on these tasks. Sol is 0.10 and Astra 0.21 below their predecessors, both within the noise; their code is as strong and their output shorter. Their one consistent weakness, thin incident write-ups, is a single task, so it may not hold over another run. The 6.2 runs also used a different account, Codex release and isolation method, which this design can't separate from the model.
- **Fable 5.2 against Fable 5.1:** 9.38 against 9.17, within the noise floor, and the two ran in different harnesses (local CLI on high against the cloud on extra). This says 5.2 is at least as good on these tasks at a lower effort setting, not that it is better.
- **Gemini 4 Hydrogen against the earlier Gemini models:** the two-point gap to Gemini 3.1 Pro and 3.8 Flash through the same harness is far beyond the noise, so it is a real improvement. Part of it may be the newer agy (1.5.8 against 1.3.3), whose sandbox let Hydrogen look at its own pages; the frontend gap (8.58 against about 5.3) is the largest.
- **The Muse models:** muse-wonder-full is ahead of muse-wonder by 0.43 and of muse-spark by 0.87. The full-versus-wonder gap (0.75 in the last pass) is within the noise for one run each; most of it comes from infrastructure (03: 8.5 against 6.0), where wonder's output was likely broken, so the full model's gain looks like fewer serious mistakes rather than better work everywhere. wonder against muse-spark (0.44 in this pass, 0.12 in the last) is within the noise. The three ran in different Muse Code releases with different blank-slate setups; wonder-full ran on Linux under bubblewrap rather than the Mac's sandbox.
- **Gemini 4 Argon's score measures the model plus a tool-less chat harness.** Every other entry could run its tests and, in most harnesses, open its pages; Argon could not, and its weakest areas (version behaviour in 04, invented details in 08) are ones that checking or a closer reading of the sources would have caught. Its result is not directly comparable to an agentic run of the same model, and says little about Argon in an agent harness. Against Gemini 3.1 Pro and 3.8 Flash through agy it is ahead (7.23 against 6.19 and 6.12) despite the handicap; Gemini 4 Hydrogen, agentic through agy, is well ahead of it (8.35).
- **Harness effects are smaller than run-to-run variation, as far as this design can show.** One run per entry can't separate harness from luck. Measuring that would take several runs of the same model in each harness.
- **The OpenRouter results describe each model as served by OpenRouter through opencode.** opencode's fixed 32k cap per response affected Mistral's and Qwen's high-effort frontend attempts.
- **The Gemini 3.1 Pro, 3.8 Flash and 4 Hydrogen results describe Gemini through agy's headless mode; Argon's describe the Gemini web chat.**
- Opus 5.5 on extra effort might score higher. This run can't say.

## Recommendations by work type

- **Code:** Sonnet 5.5, Opus 5.5, Fable 5.2 or Fable 5.1 (9.5–9.69 on code), with Grok (9.38) and GPT-6 Astra (9.31) next. The GPT-6.2 models (9.0–9.06) are close behind.
- **Writing and planning:** Fable 5.2 (9.5), Sonnet 5.5 or Opus 5.5 (9.31). Haiku 5.5 (9.06) and muse-wonder-full (8.88) are the best choices outside the top tier.
- **Incident analysis and operations:** Fable 5.2 (9.38) or Sonnet 5.5 (9.25), then Opus (9.0). Avoid the GPT-6.2 models here without review (7.0–7.88).
- **Frontend:** Fable 5.1 (9.17), Sonnet 5.5 or Fable 5.2 (9.0). Haiku and MiniMax M3.1 Flash follow (8.75), then Grok and Gemini 4 Hydrogen (8.58).
- **Cost-sensitive work:** Haiku 5.5 ($1.74 at API prices for second-tier quality). Among the OpenRouter models, HY4 preview ($1.57) is the best value. Within a Muse subscription, muse-wonder-full gives second-tier quality for about 2.5% of a 5-hour window per task. On a Google account, Gemini 4 Hydrogen through agy gives second-tier quality with no per-task charge reported.
- **Not for unsupervised work on these task types:** Nemotron 3 Ultra, Gemini 3.1 Pro and 3.8 Flash through agy (use Gemini 4 Hydrogen instead), MiniMax M3, DeepSeek V4 Pro and Mistral Large 4. Check muse-wonder's infrastructure output before using it. Through a chat window, Gemini 4 Argon's code and claims need checking: it reports test runs it never made.

## Caveats

- **One run per entry and one blind grader per task per pass.** In the thirty-way pass the task-06 grader split the reading of 29 submissions among six helper agents with a shared checklist, then re-checked the deciding quotes itself and evened out scores between helpers; every other task was read by its one grader. The graders were Claude Opus 5.5 subagents, so five contestants share its model family and one is the same model. Blinding reduces that bias but doesn't remove it. The grader brief was rewritten for the twelve-way pass (`tools/grader-prompt.md`; the original wasn't kept). The twenty-four-way pass ran on the Mac with the same brief, adapted only for paths and the browser (Playwright's bundled Chromium instead of Chrome); the twenty-five-way and twenty-six-way passes ran on cachyos with Chrome, the twenty-eight-way pass on the ThinkPad with Chrome, and the thirty-way pass on the Mac with Chrome (paths and the Chrome location adapted; graders got their own copy of Playwright outside the repository). On the Mac the graders' sandbox blocked local network servers, so the frontend graders served pages through Playwright request interception instead of `python3 -m http.server`, and Docker and nginx were not available, so the task-03 grader checked compose files by parsing them rather than with `docker compose config`.
- **Effort levels differ:**
  - Sonnet and Fable 5.1 ran on extra, Opus and Fable 5.2 on high, and Haiku on xhigh.
  - The GPT and Grok models ran on xhigh, except Luna, which ran on max.
  - Gemini 3.1 Pro and 3.8 Flash ran on agy's High variants, Gemini 4 Hydrogen on agy's XHigh variant with `--effort xhigh`, Gemini 4 Argon on the Gemini app's Thinking level High, the OpenRouter models on opencode's `high` variant (three tasks at reduced effort), and HY4 via CodeBuddy on `high`.
  - muse ran on max, muse-wonder and muse-wonder-full on xhigh, and mimo on its default.
- **Different setups:**
  - Sonnet, Fable 5.1 and Opus ran in Claude Code's cloud.
  - Haiku ran in the Claude Code CLI, and Gemini 3.1 Pro and 3.8 Flash in the Antigravity CLI, both on cachyos with OS sandboxes. Fable 5.2 (Claude Code CLI 2.1.325) and Gemini 4 Hydrogen (agy 1.5.8) ran the same way on the ThinkPad; that agy version let the model take headless Firefox screenshots of its pages, which the 3.x runs could not.
  - The eight OpenRouter models ran in opencode, and HY4 also in CodeBuddy, on cachyos with **no OS sandbox**. Permission rules and a transcript audit stood in for one; CodeBuddy ran with the user's real HOME because its sign-in requires it.
  - The GPT models ran in Codex CLI and Grok in Grok CLI on the Mac; GPT-6.2 Sol and Astra ran in Codex CLI 0.170.0 on a ChatGPT Team account, with a dedicated HOME and CODEX_HOME holding only the login, so none of the user's skills, plugins or `AGENTS.md` applied; Grok's task 13 was re-run in Grok CLI on cachyos (Linux workspace sandbox, same flags).
  - Gemini 4 Argon ran in the Gemini web chat (Google AI Pro account), in the Claude desktop app's browser: one temporary chat per task, each task's files pasted into a single message, and the reply's files copied out verbatim (checked with SHA-256). It had no tools. Its context included the account's location and two saved custom skills; no past chats or memories.
  - The MiniMax models ran through mcode, muse through tincan, and mimo a week earlier.
  - muse-wonder ran in Muse Code on the Mac with a clean HOME (no personal skills, rules or earlier sessions) inside an outer macOS sandbox that blocked reads of the rest of the home directory and all network except HTTPS. muse-wonder-full ran in Muse Code on cachyos with the same flags, a clean HOME per task and bubblewrap in place of the macOS sandbox (home directory, /tmp and mounts hidden; network not restricted, though a tool-call audit found none used). The earlier muse run loaded the user's skills and used Muse's own sandbox.
  - Every setup kept personal instructions, memory and other models' outputs out.
- **Cost figures aren't comparable across providers.** The cloud Claude figures come from account balances, Haiku's is an API-equivalent figure, and CodeBuddy reports $0 for plan usage. OpenRouter and Grok report dollars, the Muse runs report tokens and subscription quota, Argon reports only the Gemini plan's usage meter, and the others report tokens.
- **Objective checks for earlier models are carried over** from their original runs; muse-wonder's were run on the Mac, where re-running the full cross-test matrix reproduced every recorded result. Argon's and muse-wonder-full's checks and Grok's task-13 screenshots were run on cachyos, Fable 5.2's and Hydrogen's on the ThinkPad (task-04 suites with the system Python, which has `packaging`). On cachyos, task-04 suites that import `packaging` were run in a scratch venv with it. GPT-6.2 Sol's and Astra's checks and screenshots were run on the Mac (Python 3.15, Chrome); their cross-test rows and columns were added there, and the three existing cells that came out differently under Python 3.15 kept their recorded values.
- **Not checked:** nginx syntax in task 03 (no nginx binary was available). No containers were started. The task-04 grader of this pass ran ruff where it found a cached binary.
