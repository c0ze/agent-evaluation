## Results

Scores come from the latest blind pass, which graded all twenty-three entries together (2026-10-12, after HY4 preview was run a second time through Tencent's own CodeBuddy CLI). HY4 preview appears twice: once through OpenRouter and opencode, once through CodeBuddy. Grok 4.7's task 13 stopped when its usage balance ran out and awaits a re-run, so Grok is compared on its **average per task** over 12 tasks. Three OpenRouter submissions ran at reduced reasoning effort: Mistral Large 4's tasks 12 and 13, and Qwen 3.8 Max's task 13. Their high-effort attempts produced nothing.

| | Avg / task | Code | Writing | Ops | Frontend | Time | Cost / usage |
|---|---|---|---|---|---|---|---|
| **Sonnet 5.5** (extra) | **9.44** | 9.44 | **9.38** | **9.50** | **9.50** | ~28 min | $15 |
| **Fable 5.1** (extra) | 9.31 | **9.56** | 9.19 | 9.12 | 9.25 | ~49 min | $53 |
| **Opus 5.5** (high) | 9.23 | 9.50 | 9.31 | 9.25 | 8.75 | ~21 min | $14 |
| **Haiku 5.5** (xhigh) | 8.77 | 8.69 | 8.81 | 9.00 | 8.67 | ~34 min | $1.74 API-equivalent (subscription) |
| **GPT-6 Astra** (xhigh) | 8.71 | 9.44 | 8.38 | 8.75 | 8.17 | ~35 min | 3.6M in / 185k out tokens |
| **Grok 4.7** (xhigh), 12 tasks | 8.67 | 9.25 | 8.00 | 8.62 | 8.88 | ~80 min | $6.74 |
| **GPT-6.1 Sol** (xhigh) | 8.65 | 9.00 | 8.12 | 9.00 | 8.67 | ~48 min | 5.8M in / 243k out tokens |
| **Qwen 3.8 Max** (high, OpenRouter) | 8.19 | 8.56 | 8.12 | 8.12 | 7.83 | ~158 session-min | $5.44 |
| **HY4 preview via CodeBuddy** (high) | 8.04 | 8.44 | 8.25 | 7.50 | 7.58 | ~66 session-min | $0 reported (plan) |
| **HY4 preview** (high, OpenRouter) | 7.85 | 8.56 | 7.56 | 7.50 | 7.50 | ~113 session-min | $1.57 |
| **MiniMax M3.1 Flash** (xhigh, mcode) | 7.65 | 7.88 | 6.81 | 7.75 | 8.42 | ~42 min | 0.58M in + 18.6M cache-read / 398k out tokens; free preview |
| **Step-5 preview** (high, OpenRouter) | 7.62 | 8.00 | 6.94 | 8.00 | 7.75 | ~69 session-min | $2.21 |
| **GLM-5.3** (high, OpenRouter) | 7.60 | 7.94 | 7.81 | 6.62 | 7.50 | ~29 min | $1.49 |
| **muse** (max) | 7.56 | 7.12 | 7.44 | 7.75 | 8.17 | ~20 min | 6.2M in / 162k out tokens |
| **GPT-6 Luna** (max) | 7.35 | 7.50 | 7.50 | 7.25 | 7.00 | ~34 min | 3.5M in / 220k out tokens |
| **mimo** | 7.33 | 8.06 | 7.69 | 6.25 | 6.58 | not recorded | not recorded |
| **Kimi K3** (high, OpenRouter) | 7.33 | 7.00 | 7.62 | 6.50 | 7.92 | ~14 min | $3.47 |
| **Mistral Large 4** (high; 12–13 reduced) | 6.40 | 7.06 | 5.88 | 6.50 | 6.17 | ~24 min + re-runs | $1.23 |
| **DeepSeek V4 Pro** (high, OpenRouter) | 6.21 | 6.81 | 5.94 | 5.75 | 6.08 | ~12 min | $0.43 |
| **Gemini 3.8 Flash** (high, agy) | 6.13 | 7.12 | 6.06 | 5.75 | 5.17 | ~22 min | 2.35M in + 16.1M cache-read / 512k out tokens |
| **MiniMax M3** (default, mcode) | 6.08 | 6.38 | 5.88 | 5.12 | 6.58 | ~9 min | 0.55M in + 4.8M cache-read / 190k out tokens |
| **Gemini 3.1 Pro** (high, agy) | 5.88 | 6.94 | 5.50 | 5.12 | 5.50 | ~27 min | 1.56M in + 7.45M cache-read / 530k out tokens |
| **Nemotron 3 Ultra** (high, OpenRouter) | 4.87 | 6.31 | 4.44 | 4.12 | 4.00 | ~8 min | $0.76 |

Totals (of 130): Sonnet 122.75, Fable 121.0, Opus 120.0, Haiku 114.0, Astra 113.25, Sol 112.5, Qwen 3.8 Max 106.5, HY4 via CodeBuddy 104.5, HY4 102.0, MiniMax M3.1 Flash 99.5, Step-5 preview 99.0, GLM-5.3 98.75, muse 98.25, Luna 95.5, mimo 95.25, Kimi K3 95.25, Mistral Large 4 83.25, DeepSeek V4 Pro 80.75, Gemini 3.8 Flash 79.75, MiniMax M3 79.0, Gemini 3.1 Pro 76.5, Nemotron 3 Ultra 63.25; Grok 104.0 of 120. Session time for the later OpenRouter and CodeBuddy runs is the sum of task session lengths, because their batches were interrupted (see `RUN_METRICS.md`).

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
  - **Three tasks produced nothing at the standard high effort:** Mistral Large 4's 12 and 13, and Qwen 3.8 Max's 13. Each time, a single response's reasoning hit opencode's 32,000-token cap per response. At the user's request they were re-run at reduced effort, and the graders were told so.
- **Sonnet 5.5 is first again** (9.44), ahead of Fable (9.31) and Opus (9.23). Opus led the twenty-two-way pass by 0.01; the top three swap places within noise. In this pass Sonnet had the best or tied-best score on 8 of 13 tasks and Opus on 4; Fable and Astra had 2 each, and Grok, Sol, GLM-5.3 and Haiku 1 each (six tied at 10 on the bug fix).
- **Six tiers:**
  - **Sonnet, Fable and Opus:** 9.2–9.4 per task.
  - **Haiku 5.5, GPT-6 Astra, Grok 4.7 and GPT-6.1 Sol:** 8.65–8.8. Haiku is ahead of the other three this time.
  - **Qwen 3.8 Max and HY4 preview (both harnesses):** 7.9–8.2.
  - **MiniMax M3.1 Flash, Step-5 preview, GLM-5.3, muse, GPT-6 Luna, mimo and Kimi K3:** 7.3–7.7.
  - **Mistral Large 4, DeepSeek V4 Pro, Gemini 3.8 Flash, MiniMax M3 and Gemini 3.1 Pro:** 5.9–6.4.
  - **Nemotron 3 Ultra:** 4.9, last on 7 of 13 tasks.
- **Grading noise grew:**
  - **Per task:** between the twenty-two-way and twenty-three-way passes, scores for the same submissions moved by 0.51 points on average, and 58 of 285 moved by a point or more.
  - **Per model:** after two passes in which most averages rose, this one mostly fell, by 0.2–0.4: HY4 −0.42, Gemini 3.1 Pro −0.42, DeepSeek −0.37, Step-5 −0.35. Sonnet, Haiku and Astra rose slightly.
  - **What it means:** the drift has no steady direction. A model's average can move about ±0.4 from one pass to the next.
- **HY4 preview through CodeBuddy against OpenRouter/opencode:** 8.04 against 7.85, the same model on the same tasks.
  - **Where CodeBuddy did better:** infrastructure (03: 8.25 against 7.0; Redis auth and a minimal app with health endpoints), social media (08: 9.0 against 7.0; the opencode run invented a founder story and seat deals) and the dashboard (11: 8.0 against 6.25; the opencode run invented nine extra incidents).
  - **Where it did worse:** maintenance (04: 7.75 against 9.0; it now rejects component-free strings) and the editorial page (12: 7.25 against 8.25).
  - The 0.19 gap is smaller than the 0.42 that the opencode run's own score moved between passes, so this doesn't show that either harness is better. It shows that a single run varies a lot task by task.
- **Qwen 3.8 Max** stays the best entry outside the top two tiers. Its code is strong (8.56; 01: 9.5, 02: 9.75), and its weakest areas are infrastructure (03: 7.25) and planning (06: 7.25).
- **Nemotron 3 Ultra** is last by about a point. It's last or near last almost everywhere, and its task-04 run tried `pip install` twice (blocked).
- **Patterns across the field are unchanged:**
  - packages that don't build;
  - `normalize_version` output changed while claimed unchanged;
  - Redis left unauthenticated;
  - invented product facts in social posts;
  - "no alert" treated as "no impact";
  - CSS that overrides the `hidden` attribute.

### What is inferred

- **Only tier-level differences are reliable now.** With 23 entries and model averages moving by up to ±0.4 between passes, differences under about 0.4 aren't meaningful. The top three can't be separated, nor can the four in the second tier, the two HY4 entries, or most of the 7.3–7.7 group. The gaps between tiers are still well beyond that.
- **Harness effects are smaller than run-to-run variation, as far as this design can show.** One run per entry can't separate harness from luck. Measuring that would take several runs of the same model in each harness.
- **The OpenRouter results describe each model as served by OpenRouter through opencode.** opencode's fixed 32k cap per response affected Mistral's and Qwen's high-effort frontend attempts.
- **The Gemini results describe Gemini through agy's headless mode.**
- Opus 5.5 on extra effort might score higher. This run can't say.

## Recommendations by work type

- **Code:** Fable 5.1, Opus 5.5 or Sonnet 5.5. GPT-6 Astra (9.44 on code) and Grok are close behind. Among open-weights models, Qwen 3.8 Max and HY4 preview (about 8.5).
- **Writing and planning:** Sonnet 5.5 or Opus 5.5. Haiku 5.5 is the best choice outside the top three.
- **Incident analysis and operations:** Sonnet 5.5. Opus, Fable, Haiku and Sol are good alternatives.
- **Frontend:** Sonnet 5.5 or Fable 5.1.
- **Cost-sensitive work:** Haiku 5.5 ($1.74 at API prices for second-tier quality). Among the OpenRouter models, HY4 preview ($1.57) is the best value. Through CodeBuddy it scored as well or better at no per-token cost, within that plan's rate limits.
- **Not for unsupervised work on these task types:** Nemotron 3 Ultra, Gemini 3.1 Pro and 3.8 Flash through agy, MiniMax M3, DeepSeek V4 Pro and Mistral Large 4.

## Caveats

- **One run per entry and one blind grader per task per pass.** The graders were Claude Opus 5.5 subagents, so four contestants share its model family and one is the same model. Blinding reduces that bias but doesn't remove it. The grader brief was rewritten for the twelve-way pass (`tools/grader-prompt.md`; the original wasn't kept).
- **Effort levels differ:**
  - Sonnet and Fable ran on extra, Opus on high and Haiku on xhigh.
  - The GPT and Grok models ran on xhigh, except Luna, which ran on max.
  - The Gemini models ran on agy's High variants, the OpenRouter models on opencode's `high` variant (three tasks at reduced effort), and HY4 via CodeBuddy on `high`.
  - muse ran on max, and mimo on its default.
- **Different setups:**
  - Sonnet, Fable and Opus ran in Claude Code's cloud.
  - Haiku ran in the Claude Code CLI, and the Gemini models in the Antigravity CLI, both on cachyos with OS sandboxes.
  - The eight OpenRouter models ran in opencode, and HY4 also in CodeBuddy, on cachyos with **no OS sandbox**. Permission rules and a transcript audit stood in for one; CodeBuddy ran with the user's real HOME because its sign-in requires it.
  - The GPT models ran in Codex CLI and Grok in Grok CLI on the Mac.
  - The MiniMax models ran through mcode, muse through tincan, and mimo a week earlier.
  - Every setup kept personal instructions, memory and other models' outputs out.
- **Cost figures aren't comparable across providers.** The cloud Claude figures come from account balances, Haiku's is an API-equivalent figure, and CodeBuddy reports $0 for plan usage. OpenRouter and Grok report dollars, and the others report tokens.
- **Objective checks for earlier models are carried over** from their original runs. On cachyos, task-04 suites that import `packaging` were run in a scratch venv with it.
- **Not checked:** ruff lint results in task 04, and nginx syntax in task 03 (no nginx binary was available). No containers were started.
