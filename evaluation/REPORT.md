## Results

Scores come from the latest blind pass, which graded all eighteen models together (2026-10-11, after Kimi K3, DeepSeek V4 Pro, GLM-5.3 and Mistral Large 4 were added through OpenRouter). Grok 4.7's task 13 stopped when its usage balance ran out and awaits a re-run, so Grok is compared on its **average per task** over 12 tasks.

| | Avg / task | Code | Writing | Ops | Frontend | Time | Cost / usage |
|---|---|---|---|---|---|---|---|
| **Sonnet 5.5** (extra) | **9.42** | 9.62 | 9.44 | **9.62** | **9.00** | ~28 min | $15 |
| **Fable 5.1** (extra) | 9.37 | **9.75** | 9.25 | 9.38 | **9.00** | ~49 min | $53 |
| **Opus 5.5** (high) | 9.27 | 9.56 | **9.50** | 9.12 | 8.67 | ~21 min | $14 |
| **Grok 4.7** (xhigh), 12 tasks | 8.83 | 9.38 | 8.19 | 8.88 | **9.00** | ~80 min | $6.74 |
| **Haiku 5.5** (xhigh) | 8.69 | 8.75 | 8.88 | 8.75 | 8.33 | ~34 min | $1.74 API-equivalent (subscription) |
| **GPT-6 Astra** (xhigh) | 8.69 | 9.25 | 8.50 | 8.25 | 8.50 | ~35 min | 3.6M in / 185k out tokens |
| **GPT-6.1 Sol** (xhigh) | 8.62 | 8.94 | 8.62 | 8.00 | 8.58 | ~48 min | 5.8M in / 243k out tokens |
| **GLM-5.3** (high, OpenRouter) | 7.67 | 7.81 | 8.19 | 6.50 | 7.58 | ~29 min | $1.49 |
| **MiniMax M3.1 Flash** (xhigh, mcode) | 7.60 | 7.94 | 6.56 | 7.88 | 8.33 | ~42 min | 0.58M in + 18.6M cache-read / 398k out tokens; free preview |
| **muse** (max) | 7.50 | 7.00 | 7.56 | 7.75 | 7.92 | ~20 min | 6.2M in / 162k out tokens |
| **mimo** | 7.42 | 8.12 | 7.69 | 6.62 | 6.67 | not recorded | not recorded |
| **Kimi K3** (high, OpenRouter) | 7.27 | 6.88 | 7.50 | 6.75 | 7.83 | ~14 min | $3.47 |
| **GPT-6 Luna** (max) | 7.27 | 7.38 | 7.81 | 6.38 | 7.00 | ~34 min | 3.5M in / 220k out tokens |
| **MiniMax M3** (default, mcode) | 6.15 | 6.19 | 6.25 | 5.12 | 6.67 | ~9 min | 0.55M in + 4.8M cache-read / 190k out tokens; 2% of a 5-hour window |
| **DeepSeek V4 Pro** (high, OpenRouter) | 6.08 | 6.81 | 6.00 | 5.25 | 5.75 | ~12 min | $0.43 |
| **Gemini 3.8 Flash** (high, agy) | 6.06 | 7.06 | 5.94 | 5.75 | 5.08 | ~22 min | 2.35M in + 16.1M cache-read / 512k out tokens |
| **Gemini 3.1 Pro** (high, agy) | 5.98 | 6.56 | 6.19 | 5.38 | 5.33 | ~27 min | 1.56M in + 7.45M cache-read / 530k out tokens |
| **Mistral Large 4** (high, OpenRouter) | 5.37 | 6.94 | 6.00 | 6.25 | 1.83 | ~24 min | $0.79 |

Totals (of 130): Sonnet 122.5, Fable 121.75, Opus 120.5, Haiku 113.0, Astra 113.0, Sol 112.0, GLM-5.3 99.75, MiniMax M3.1 Flash 98.75, muse 97.5, mimo 96.5, Kimi K3 94.5, Luna 94.5, MiniMax M3 80.0, DeepSeek V4 Pro 79.0, Gemini 3.8 Flash 78.75, Gemini 3.1 Pro 77.75, Mistral Large 4 69.75; Grok 106.0 of 120.

### What was observed

- **Every model completed every task it ran, except Mistral Large 4's tasks 12 and 13.**
  - **Mistral's missing pages:** in each attempt, one response spent its whole budget reasoning and hit opencode's fixed 32,000-token cap per response. opencode then ended the session before any file was written. Re-run once each with the identical command, the same thing happened, so both score 0. Over its other 11 tasks Mistral averages 6.34.
  - **Hidden contract tests:** every model passed them for task 01. For task 02, all but MiniMax M3.1 Flash and Haiku 5.5 passed. Both fail `test_expiry_boundary_removes_entry`: their `get` raises on an expired entry but leaves it in the map.
  - **Frontends:** no delivered page scrolled sideways at 390 px or made a network request.
  - **Interruptions not caused by the model** (each re-run once from the template with the identical command):
    - Astra's tasks 10–13 (quota).
    - Grok's task 13 (usage balance; still to be re-run).
    - MiniMax M3.1 Flash's task 11 (the orchestrator's job limit).
    - Gemini 3.1 Pro's task 11 (agy ended the session on a permission it can't prompt for headless).
    - Mistral's tasks 12 and 13 (the output cap above).
- **Sonnet 5.5 is first in every grading pass so far** (4-way through 18-way), now only 0.05 ahead of Fable. In this pass it had the best or tied-best score on 6 of 13 tasks, as did Opus; Fable had 4. Astra, Haiku, Sol, Grok and Gemini 3.8 Flash had 1 each (ties counted for each; six models tied at 10 on the bug fix).
- **Four tiers:**
  - **Sonnet, Fable and Opus:** 9.3–9.4 per task.
  - **Grok 4.7, Haiku 5.5, GPT-6 Astra and GPT-6.1 Sol:** 8.6–8.8.
  - **GLM-5.3, MiniMax M3.1 Flash, muse, mimo, Kimi K3 and GPT-6 Luna:** 7.3–7.7.
  - **MiniMax M3, DeepSeek V4 Pro, both Gemini models and Mistral Large 4:** 5.4–6.2.
- **Grading repeatability:**
  - **Per task:** between the fourteen-way and eighteen-way passes, scores for the same submissions moved by 0.48 points on average, and 29 of 181 moved by a point or more.
  - **Per model:** this time almost every average rose, by up to 0.25, with MiniMax M3.1 Flash up 0.46. Luna was the exception, at −0.12. Among the earlier models, MiniMax M3.1 Flash moved from below mimo to above muse, Luna fell below mimo, and Haiku drew level with Astra. The top seven kept their order.
- **GLM-5.3** (Z.ai, through opencode on OpenRouter) is the best of the four OpenRouter newcomers and leads the third tier, 0.95 below Sol:
  - **Best:** the bug fix (02: 9.75), feature building (01: 9.25), social media (08: 9.0, tied third) and the editorial page (12: 8.75).
  - **Weakest:**
    - The infrastructure task (03: 6.75): Redis left unauthenticated.
    - Maintenance (04: 5.5): it added a strict validator that now rejects ordinary versions like `1.0.post1`.
    - Incident analysis (09: 6.25): it misreads the logs about flag reloading.
    - The dashboard (11: 6.25): it says "All systems nominal" beside a critical incident.
  - **Run:** $1.49 and 29 min.
- **Kimi K3** (Moonshot, high) has good frontends (7.83; 12: 8.75), the bug fix (02: 9.5) and one of the better schedules (10: 8.5).
  - **Weakest:**
    - Maintenance (04: 4.5): it can't be built and changes output.
    - Incident analysis (09: 5.0): a wrong date and unsupported claims.
    - Infrastructure (03: 5.25): its Dockerfile copies `.env` into the image while its RESPONSE says no secrets are baked in.
  - **Run:** very fast, 14 min for $3.47. It reasoned little: about 44k reasoning tokens in total, against 290–320k for the Gemini models.
- **DeepSeek V4 Pro** wrote correct code (01: 8.0, 02: 8.75), but most of its work is thin.
  - **Last on three tasks:** infrastructure (03: 4.25, `.env` baked into the image), planning (06: 5.0, a conflict policy that contradicts itself) and incident analysis (09: 4.25, tied).
  - **Broken pages:** its dashboard is empty when opened from disk (11: 5.0), and Undo on its plant page loses the plant (13: 5.5).
  - **Run:** by far the cheapest model in the evaluation: $0.43 for all 13 tasks, in 12 min.
- **Mistral Large 4:**
  - **Best:** a plain, accurate webhook guide with no invented facts (05: 8.0), feature building (01: 8.5) and the schedule (10: 7.25).
  - **Weakest:** the weakest story (07: 4.75, last), social posts that invent Japanese support and a licensing process (08: 5.5), and maintenance (04: 4.25). Plus the two missing pages.
- **Gemini 3.1 Pro and Gemini 3.8 Flash** (Antigravity CLI, high) stay in the bottom tier.
  - **Last places:** both are last on maintenance (04: 3.75), Flash on social media (08: 4.25) and Pro on scheduling and the dashboard (10: 5.25, 11: 4.25).
  - **Flash's playful page** is still broken on load (13: 2.25).
- **Haiku 5.5** is tied fifth with Astra:
  - **Best:** infrastructure (03: 9.25, tied first), planning (06: 9.5) and writing (8.88).
  - **Weakest:** maintenance (04: 7.5).
- **GPT-6 Astra and GPT-6.1 Sol** scored 7.5–10. Astra tied first on infrastructure (03: 9.25), and Sol scored 10 on the bug fix.
- **Grok 4.7:** strong on code (9.38) and frontend (9.0), weak on social media (6.75).
- **MiniMax M3.1 Flash:** strong frontends (8.33; 11 and 12: 9.0 each) and planning (06: 9.0). Its writing is weak (6.56; 05: 5.0, last), and it fails the hidden bug-fix test.
- **MiniMax M3** (default effort) is last or tied last on 01, 02 and 09; 03 (4.5) leaves Redis unauthenticated.
- **GPT-6 Luna, muse and mimo** repeat the failures seen in earlier passes:
  - packages that don't build (04);
  - invented facts in writing;
  - thin test suites;
  - generic frontends with real bugs.
- **Failures the newcomers share with the lower tiers:**
  - Leaving the task-04 package unbuildable: 11 of 18 submissions didn't declare `py-modules`.
  - Changing `normalize_version`'s output while claiming it's unchanged.
  - Leaving Redis unauthenticated.
  - Inventing product facts in the social posts.
  - CSS that overrides the `hidden` attribute, which broke pages for several models.

### What is inferred

- Within the top two tiers, gaps are small enough that another run, or another grading pass, could reorder models on a given work type. Model averages have moved by up to ±0.3 between passes, and once by 0.65. The gaps between the tiers are well beyond grading noise.
- **Scores drift with the field.** Scores are comparative within each task. Adding four mostly weaker submissions coincided with most earlier models' averages rising slightly. Read absolute numbers across passes with that in mind; the order is more stable than the values.
- **The OpenRouter results describe each model as served by OpenRouter**, through opencode, on one run each. OpenRouter picks the host, and hosts can differ in speed and quantization. K3's speed, and perhaps some of its terseness, may reflect that.
- **Mistral Large 4's two zeros come from model and harness together.** Spending 28k tokens reasoning before writing is the model's own behaviour, but a harness without a hard 32k cap would probably have let it finish.
- **The Gemini results describe Gemini through agy's headless mode.** agy's sandbox blocked their browser self-checks, but their non-frontend tasks scored low too.
- Haiku 5.5 belongs in the second tier; its exact place within it isn't stable across passes.
- Opus 5.5 on extra effort might score higher. This run can't say.
- MiniMax M3's score is mostly an effort effect: mcode won't change M3's effort.

## Recommendations by work type

- **Code:** Sonnet 5.5, Fable 5.1 or Opus 5.5. Grok and Astra are close behind.
- **Writing and planning:** Opus 5.5 or Sonnet 5.5. Haiku 5.5 is the best choice outside the top three (8.88 on writing). Avoid Grok for customer-facing copy.
- **Incident analysis and operations:** Sonnet 5.5. Fable, Opus, Grok and Haiku are good alternatives.
- **Frontend:** Sonnet 5.5 or Fable 5.1; Grok 4.7 for dense operational UIs.
- **Cost-sensitive work:** Haiku 5.5 ($1.74 at API prices for second-tier quality). Among the open-weights models on OpenRouter, GLM-5.3 is the best value ($1.49 for 7.67). DeepSeek V4 Pro is almost free ($0.43) but not good enough to run unsupervised on these tasks.
- **Kimi K3:** usable for frontend drafts and quick code fixes. It's fast and cheap, but check its infrastructure and release work, and anything factual.
- **DeepSeek V4 Pro, Mistral Large 4, the Gemini models through agy, MiniMax M3, muse, GPT-6 Luna and mimo:** not for unsupervised work on these task types. MiniMax M3.1 Flash is usable as a second opinion on code, plans and dashboards.

## Caveats

- **One run per model and one blind grader per task per pass.** The graders were Claude Opus 5.5 subagents, so four contestants share its model family and one is the same model. Blinding reduces that bias but doesn't remove it: random letters per task, and names, paths and model IDs removed. Since the grader brief was rewritten for the twelve-way pass (`tools/grader-prompt.md`; the original wasn't kept), the Claude models' averages have been somewhat higher than in the eleven-way pass.
- **Effort levels differ:**
  - Sonnet and Fable ran on extra, Opus on high and Haiku on xhigh.
  - The GPT and Grok models ran on xhigh, except Luna, which ran on max.
  - The Gemini models ran on agy's High variants, and the four OpenRouter models on opencode's `high` reasoning variant.
  - muse ran on max, and mimo on its default.
- **Different setups:**
  - Sonnet, Fable and Opus ran in Claude Code's cloud.
  - Haiku ran in the Claude Code CLI, and the Gemini models in the Antigravity CLI, both on cachyos with OS sandboxes.
  - The four OpenRouter models ran in opencode on cachyos with **no OS sandbox**. Permission rules denied web tools, paths outside the repository and network commands, and a transcript audit found no network use.
  - The GPT models ran in Codex CLI and Grok in Grok CLI on the Mac.
  - The MiniMax models ran through mcode and muse through tincan; mimo ran a week earlier.
  - Every setup kept personal instructions, memory and other models' outputs out; the MiniMax runs and muse still saw the user's skills.
- **Cost figures aren't comparable across providers.** The cloud Claude figures come from account balances, and Haiku's is the CLI's API-equivalent figure. OpenRouter and Grok report dollars. GPT, muse, MiniMax and Gemini report tokens (and GPT quota) only.
- **Objective checks for earlier models are carried over** from their original runs. On cachyos, task-04 suites that import `packaging` were run in a scratch venv with it.
- **Not checked:** ruff lint results in task 04, and nginx syntax in task 03 (no nginx binary was available). No containers were started.
