## Results

Scores come from the latest blind pass, which graded all twenty-two models together (2026-10-12, after Qwen 3.8 Max, Nemotron 3 Ultra, Step-5 preview and HY4 preview were added through OpenRouter). Grok 4.7's task 13 stopped when its usage balance ran out and awaits a re-run, so Grok is compared on its **average per task** over 12 tasks. Three submissions ran at reduced reasoning effort: Mistral Large 4's tasks 12 and 13, and Qwen 3.8 Max's task 13. Their high-effort attempts produced nothing (see below).

| | Avg / task | Code | Writing | Ops | Frontend | Time | Cost / usage |
|---|---|---|---|---|---|---|---|
| **Opus 5.5** (high) | **9.38** | 9.62 | **9.50** | 9.38 | **8.92** | ~21 min | $14 |
| **Sonnet 5.5** (extra) | 9.37 | **9.69** | **9.50** | **9.75** | 8.50 | ~28 min | $15 |
| **Fable 5.1** (extra) | 9.33 | 9.62 | 9.31 | 9.50 | 8.83 | ~49 min | $53 |
| **Grok 4.7** (xhigh), 12 tasks | 8.92 | 9.44 | 8.44 | 8.88 | 8.88 | ~80 min | $6.74 |
| **Haiku 5.5** (xhigh) | 8.69 | 8.75 | 8.75 | 8.75 | 8.50 | ~34 min | $1.74 API-equivalent (subscription) |
| **GPT-6.1 Sol** (xhigh) | 8.69 | 9.06 | 8.56 | 8.50 | 8.50 | ~48 min | 5.8M in / 243k out tokens |
| **GPT-6 Astra** (xhigh) | 8.69 | 9.19 | 8.62 | 8.50 | 8.25 | ~35 min | 3.6M in / 185k out tokens |
| **Qwen 3.8 Max** (high, OpenRouter) | 8.35 | 8.81 | 8.19 | 8.50 | 7.83 | ~158 session-min | $5.44 |
| **HY4 preview** (high, OpenRouter) | 8.27 | 8.94 | 8.31 | 7.88 | 7.58 | ~113 session-min | $1.57 |
| **Step-5 preview** (high, OpenRouter) | 7.96 | 8.19 | 7.62 | 8.12 | 8.00 | ~69 session-min | $2.21 |
| **GLM-5.3** (high, OpenRouter) | 7.81 | 7.75 | 8.12 | 7.12 | 7.92 | ~29 min | $1.49 |
| **muse** (max) | 7.79 | 7.44 | 7.75 | 8.12 | 8.08 | ~20 min | 6.2M in / 162k out tokens |
| **MiniMax M3.1 Flash** (xhigh, mcode) | 7.73 | 8.06 | 7.25 | 7.25 | 8.25 | ~42 min | 0.58M in + 18.6M cache-read / 398k out tokens; free preview |
| **mimo** | 7.58 | 7.94 | 7.69 | 7.00 | 7.33 | not recorded | not recorded |
| **GPT-6 Luna** (max) | 7.58 | 7.88 | 7.75 | 7.25 | 7.17 | ~34 min | 3.5M in / 220k out tokens |
| **Kimi K3** (high, OpenRouter) | 7.37 | 7.31 | 7.50 | 6.62 | 7.75 | ~14 min | $3.47 |
| **DeepSeek V4 Pro** (high, OpenRouter) | 6.58 | 7.31 | 6.38 | 5.38 | 6.67 | ~12 min | $0.43 |
| **Mistral Large 4** (high; 12–13 reduced) | 6.42 | 7.38 | 5.56 | 6.38 | 6.33 | ~24 min + re-runs | $1.23 |
| **Gemini 3.8 Flash** (high, agy) | 6.37 | 7.31 | 6.12 | 6.38 | 5.42 | ~22 min | 2.35M in + 16.1M cache-read / 512k out tokens |
| **MiniMax M3** (default, mcode) | 6.31 | 6.44 | 6.19 | 5.12 | 7.08 | ~9 min | 0.55M in + 4.8M cache-read / 190k out tokens |
| **Gemini 3.1 Pro** (high, agy) | 6.31 | 7.06 | 6.00 | 6.00 | 5.92 | ~27 min | 1.56M in + 7.45M cache-read / 530k out tokens |
| **Nemotron 3 Ultra** (high, OpenRouter) | 5.06 | 6.38 | 4.38 | 4.62 | 4.50 | ~8 min | $0.76 |

Totals (of 130): Opus 122.0, Sonnet 121.75, Fable 121.25, Haiku 113.0, Sol 113.0, Astra 113.0, Qwen 3.8 Max 108.5, HY4 preview 107.5, Step-5 preview 103.5, GLM-5.3 101.5, muse 101.25, MiniMax M3.1 Flash 100.5, mimo 98.5, Luna 98.5, Kimi K3 95.75, DeepSeek V4 Pro 85.5, Mistral Large 4 83.5, Gemini 3.8 Flash 82.75, MiniMax M3 82.0, Gemini 3.1 Pro 82.0, Nemotron 3 Ultra 65.75; Grok 107.0 of 120. Session time for the batch-3 models is the sum of task session lengths, because their batch was interrupted (see `RUN_METRICS.md`).

### What was observed

- **Every model completed every task it ran.**
  - **Hidden contract tests:** every model passed them for task 01. For task 02, all but MiniMax M3.1 Flash and Haiku 5.5 passed: their `get` raises on an expired entry but leaves it in the map.
  - **Frontends:** no page scrolled sideways at 390 px or made a network request.
  - **Interruptions not caused by the model** (each re-run from the template with the identical command):
    - Astra's tasks 10–13 (quota).
    - Grok's task 13 (usage balance; still to be re-run).
    - MiniMax M3.1 Flash's task 11 (job limit).
    - Gemini 3.1 Pro's task 11 (agy's headless permission auto-deny).
    - The third OpenRouter batch: /tmp filled up with opencode's npm caches, and later the OpenRouter credit ran out.
  - **Three tasks produced nothing at the standard high effort:** Mistral Large 4's 12 and 13, and Qwen 3.8 Max's 13. In each attempt and its identical re-run, a single response spent its whole budget reasoning and hit opencode's 32,000-token cap per response, and opencode ended the session before any file was written. At the user's request these were re-run at reduced reasoning effort: Mistral 12 and Qwen 13 at medium, and Mistral 13 at low after medium also hit the cap. All three completed, and the graders were told in a process note. They scored 7.25, 6.25 and 8.25.
- **The top three are now effectively tied.** Opus 5.5 is first by 0.01 over Sonnet 5.5 (9.38 against 9.37), with Fable at 9.33. That ends Sonnet's run of first places from the 4-way to the 18-way pass, within noise. In this pass Sonnet had the best or tied-best score on 7 of 13 tasks and Opus on 6; Fable, Grok and Sol had 2 each, and Astra, Haiku and GLM-5.3 1 each (six models tied at 10 on the bug fix).
- **Five tiers:**
  - **Opus, Sonnet and Fable:** 9.3–9.4 per task.
  - **Grok 4.7, Haiku 5.5, GPT-6.1 Sol and GPT-6 Astra:** 8.7–8.9. The last three are exactly level at 8.69.
  - **Qwen 3.8 Max and HY4 preview:** 8.3–8.4.
  - **Step-5 preview, GLM-5.3, muse, MiniMax M3.1 Flash, mimo, GPT-6 Luna and Kimi K3:** 7.4–8.0.
  - **DeepSeek V4 Pro, Mistral Large 4, both Gemini models, MiniMax M3 and Nemotron 3 Ultra:** 5.1–6.6. Nemotron is alone at the bottom, 1.25 below the next model.
- **Grading repeatability:**
  - **Per task:** between the eighteen-way and twenty-two-way passes, scores for the same submissions moved by 0.49 points on average, and 42 of 231 moved by a point or more.
  - **Per model:** averages mostly drifted up again, by up to 0.33, and DeepSeek by 0.50. Mistral's +1.06 comes mainly from its two former zeros. Sonnet and Fable dipped slightly.
- **Qwen 3.8 Max** (Alibaba, through opencode on OpenRouter) is the best model outside the top two tiers.
  - **Strong:** code (8.81; 01: 9.5, 02: 9.75, 03: 8.75, with fail-closed secrets and a solid runbook), incident analysis (09: 8.75) and a calm dashboard (11: 8.5).
  - **Weak:**
    - Maintenance (04: 7.25): its package can't be built.
    - Planning (06: 7.5): the server wins same-field conflicts, and the purge backstop has no check for unsynced data.
    - The editorial page (12: 6.75): loose pacing and a reading mode with unreadable contrast.
  - **Run:** the most expensive OpenRouter model, $5.44, with frontend tasks running 15–30 min each. Its task 13 needed the reduced-effort re-run.
- **HY4 preview** (Tencent) has strong code (8.94):
  - **Strong:** 01: 9.75, infrastructure 03: 9.0 (with Redis password-protected), maintenance 04: 8.25 (one of the few buildable packages), planning (06: 8.75) and incident analysis (09: 8.75).
  - **Weak:** its social posts invent a founder story and seat deals (08: 7.5), its schedule wrongly limits QA days (10: 7.0), and its dashboard invents nine extra incidents and has an empty state that always shows (11: 7.0).
  - **Run:** $1.57.
- **Step-5 preview** (StepFun) is even across task types:
  - **Strong:** feature building (01: 9.0), a distinctive social voice (08: 8.75) and a polished dashboard (11: 8.75).
  - **Weak:** planning (06: 6.25: it blocks offline input to enforce the purge rule), maintenance (04: 6.75, unbuildable), and infrastructure (03: 7.75: its API is published past the proxy, and Redis has no password).
  - **Run:** $2.21.
- **Nemotron 3 Ultra** (NVIDIA) is last by a wide margin: last on 7 of 13 tasks (03, 05, 06, 08, 09, 11, and tied on 12).
  - **Infrastructure (03):** `.env` baked into the image and no network segmentation.
  - **Technical writing (05):** below the word minimum and the most invented behaviour.
  - **Planning (06):** "synced" confused with "accepted".
  - **Social media (08):** below the LinkedIn word minimum while claiming 158 words.
  - **Incident analysis (09):** counts impact from the deploy and treats correlation as proof.
  - **Frontends:** the plant page shows "UNDEFINED" and declares "all caught up" while tasks remain (13: 3.5).
  - **Process note:** it tried `pip install` twice in task 04; both were blocked.
  - **Run:** fast and cheap (8 min, $0.76), but the work was thin.
- **The earlier OpenRouter models:**
  - **GLM-5.3** is unchanged in character: excellent on the bug fix (10) and social posts (9.0), weak on maintenance (04: 4.25).
  - **Kimi K3** has good frontends but weak operations work (6.62).
  - **DeepSeek V4 Pro** is cheap and thin.
  - **Mistral Large 4** is now 6.42, with real pages for 12 and 13 at reduced effort.
- **Haiku 5.5, GPT-6.1 Sol and GPT-6 Astra** are exactly level. Haiku tied first on infrastructure (03: 9.5), Sol tied first on the editorial page (12: 8.75), and Astra is strongest on code (9.19).
- **Grok 4.7:** strong on code (9.44) and frontend (8.88), weak on social media (7.0).
- **Gemini 3.1 Pro and 3.8 Flash** stay in the bottom tier. Pro is last on maintenance (04: 4.0) and Flash on the playful page (13: 3.25).
- **MiniMax M3** is last or tied last on 01, 02 and 10. **GPT-6 Luna, muse and mimo** repeat their earlier failure patterns.
- **Failures that cut across most of the field:**
  - Leaving the task-04 package unbuildable: most submissions didn't declare `py-modules`.
  - Changing `normalize_version`'s output while claiming it's unchanged.
  - Leaving Redis unauthenticated.
  - Inventing product facts in social posts.
  - Treating "no alert in the US" as "no impact in the US".
  - CSS that overrides the `hidden` attribute, which broke pages for several models.

### What is inferred

- **The top three can't be separated**, and the three-way tie at 8.69 can't be either. Model averages move by 0.1–0.3 between passes (more for a few models), so differences under about 0.3 are noise. The gaps between tiers are well beyond that.
- **Scores drift with the field.** Scores are comparative within each task. As weaker submissions were added, most earlier models' averages rose slightly in each of the last two passes. The order is more stable than the absolute numbers.
- **The OpenRouter results describe each model as served by OpenRouter**, through opencode, on one run each. Hosts can differ in speed and quantization.
- **opencode's fixed 32k cap per response** cost Mistral and Qwen their high-effort attempts on the frontend tasks. That is part model behaviour (reasoning for 28–32k tokens before writing) and part harness limit. The reduced-effort re-runs show what those models deliver when the harness lets them finish. Read their scores on those tasks as "high effort for 12 tasks plus a reduced-effort answer".
- **The Gemini results describe Gemini through agy's headless mode**, where the sandbox blocked browser self-checks. Their non-frontend tasks scored low too.
- **Nemotron 3 Ultra's speed came at the cost of depth:** about 11k reasoning tokens for all 13 tasks, the fewest of the OpenRouter models (the next lowest used about 44k).
- Opus 5.5 on extra effort might score higher. This run can't say.

## Recommendations by work type

- **Code:** Sonnet 5.5, Opus 5.5 or Fable 5.1. Grok and Astra are close behind. Among open-weights models, HY4 preview (8.94 on code) and Qwen 3.8 Max (8.81) are the strongest.
- **Writing and planning:** Opus 5.5 or Sonnet 5.5. Haiku 5.5 is the best choice outside the top three. Avoid Grok, Nemotron and the MiniMax models for customer-facing copy.
- **Incident analysis and operations:** Sonnet 5.5. Fable, Opus and Grok are good alternatives, and Qwen 3.8 Max is the best open-weights option (8.50).
- **Frontend:** Opus 5.5 or Grok 4.7; Fable and Sonnet are close.
- **Cost-sensitive work:** Haiku 5.5 ($1.74 at API prices for second-tier quality). HY4 preview ($1.57 for 8.27) is the best value among the OpenRouter models. Qwen 3.8 Max is better on average but cost $5.44.
- **Not for unsupervised work on these task types:** Nemotron 3 Ultra, DeepSeek V4 Pro, Mistral Large 4, the Gemini models through agy, MiniMax M3, GPT-6 Luna, muse and mimo.

## Caveats

- **One run per model and one blind grader per task per pass.** The graders were Claude Opus 5.5 subagents, so four contestants share its model family and one is the same model. Blinding reduces that bias but doesn't remove it. The grader brief was rewritten for the twelve-way pass (`tools/grader-prompt.md`; the original wasn't kept).
- **Effort levels differ:**
  - Sonnet and Fable ran on extra, Opus on high and Haiku on xhigh.
  - The GPT and Grok models ran on xhigh, except Luna, which ran on max.
  - The Gemini models ran on agy's High variants, and the OpenRouter models on opencode's `high` variant. Three OpenRouter tasks ran at reduced effort, as described above.
  - muse ran on max, and mimo on its default.
- **Different setups:**
  - Sonnet, Fable and Opus ran in Claude Code's cloud.
  - Haiku ran in the Claude Code CLI, and the Gemini models in the Antigravity CLI, both on cachyos with OS sandboxes.
  - The eight OpenRouter models ran in opencode on cachyos with **no OS sandbox**. Permission rules and a transcript audit stood in for one; only Nemotron tried network installs, which were blocked.
  - The GPT models ran in Codex CLI and Grok in Grok CLI on the Mac.
  - The MiniMax models ran through mcode, muse through tincan, and mimo a week earlier.
  - Every setup kept personal instructions, memory and other models' outputs out.
- **Cost figures aren't comparable across providers.** The cloud Claude figures come from account balances, and Haiku's is an API-equivalent figure. OpenRouter and Grok report dollars, and the others report tokens.
- **Objective checks for earlier models are carried over** from their original runs. On cachyos, task-04 suites that import `packaging` were run in a scratch venv with it.
- **Not checked:** ruff lint results in task 04, and nginx syntax in task 03 (no nginx binary was available). No containers were started.
