## Results

Scores come from the latest blind pass, which graded all ten models together (2026-10-04, after MiniMax M3.1 Flash was added). Grok 4.7's task 13 stopped when its usage balance ran out and awaits a re-run, so Grok is compared on its **average per task** over 12 tasks.

| | Avg / task | Code | Writing | Ops | Frontend | Time | Cost / usage |
|---|---|---|---|---|---|---|---|
| **Sonnet 5.5** (extra) | **9.30** | **9.56** | 9.25 | **9.25** | **9.05** | ~28 min | $15 |
| **Opus 5.5** (high) | 8.90 | 9.31 | **9.44** | 7.75 | 8.38 | ~21 min | $14 |
| **Fable 5.1** (extra) | 8.86 | 9.44 | 8.69 | 8.75 | 8.38 | ~49 min | $53 |
| **Grok 4.7** (xhigh), 12 tasks | 8.62 | 9.19 | 7.94 | 8.62 | 8.82 | ~80 min | $6.74 |
| **GPT-6 Astra** (xhigh) | 8.58 | 9.19 | 8.50 | 8.75 | 7.75 | ~35 min | 3.6M in / 185k out tokens |
| **GPT-6.1 Sol** (xhigh) | 8.48 | 8.81 | 8.12 | 9.00 | 8.17 | ~48 min | 5.8M in / 243k out tokens |
| **GPT-6 Luna** (max) | 7.06 | 7.06 | 7.62 | 7.00 | 6.33 | ~34 min | 3.5M in / 220k out tokens |
| **muse** (max) | 6.92 | 6.44 | 7.25 | 7.50 | 6.75 | ~20 min | 6.2M in / 162k out tokens |
| **mimo** | 6.92 | 7.25 | 7.50 | 6.38 | 6.08 | not recorded | not recorded |
| **MiniMax M3.1 Flash** (xhigh, mcode) | 6.79 | 7.12 | 6.12 | 6.75 | 7.25 | ~42 min | 0.58M in + 18.6M cache-read / 398k out tokens |

Totals (of 130): Sonnet 120.9, Opus 115.65, Fable 115.15, Astra 111.5, Sol 110.25, Luna 91.75, muse 90.0, mimo 90.0, MiniMax M3.1 Flash 88.25; Grok 103.4 of 120.

### What was observed

- **Every model completed every task it ran.** Every model passed the hidden contract tests for task 01. For task 02, all but MiniMax M3.1 Flash passed: its `get` raises on an expired entry but leaves it in the map, so `len()` still counts it (`test_expiry_boundary_removes_entry`). No frontend page scrolled sideways at 390 px or made a network request. Three runs were interrupted by something other than the model: Astra's tasks 10–13 (quota; re-run from the template on another account), Grok's task 13 (usage balance; to be re-run) and MiniMax's task 11 (killed by the orchestrator's own job limit; re-run from the template).
- **Sonnet 5.5 is first in every grading pass so far** (4-way, 5-way, 6-way, 9-way, 10-way). In this pass it had the best or tied-best score on 7 of 13 tasks; Opus on 6, Fable, Sol and Grok on 2 each, Astra on 1 (ties counted for each).
- **Three tiers, unchanged by the ten-way pass:**
  - **Claude models:** 8.9–9.3 per task.
  - **GPT-6 Astra, GPT-6.1 Sol and Grok 4.7:** 8.5–8.6.
  - **GPT-6 Luna, muse, mimo and MiniMax M3.1 Flash:** 6.8–7.1.
- **Grading repeatability.** Between the nine-way and ten-way passes, per-task scores for the same submissions moved by 0.47 points on average, and 16 of 116 moved by a point or more. The ten-way graders ran more checks than before (building every package in task 04, mutation-testing every suite in 01 and 02), which accounts for some of the movement; no model's average moved by more than 0.35, and the order of the nine earlier models only changed within the middle tier (Grok moved up past Astra and Sol) and at the bottom (mimo drew level with muse).
- **GPT-6 Astra** was the most consistent non-Claude model: 9.75 on the bug fix, 9 on the story (07), and no score below 7.5. Its weak spot was frontend (7.75 average).
- **GPT-6.1 Sol** scored 7.5–10 and was the best non-Claude model on operations (9.0). The graders found its pages and prose competent but generic.
- **Grok 4.7** scored very unevenly:
  - **Strong:** code, with 10 on both 01 and 02, and the most control-room-like dashboard (11: 9.0).
  - **Weak:** social media (6.75) and its story (7.75).
  - **Cost and speed:** by far the cheapest in dollars ($6.74 for 12 tasks), and by far the slowest (80 min).
- **MiniMax M3.1 Flash** (mcode, xhigh) is new in this pass and ranks last overall, 0.13 behind muse and mimo:
  - **Best:** product planning (06: 8.5, "complete, well-argued plan with good product calls"), feature building (01: 8.25; correct on every random graph, but it rejects whitespace-only IDs the contract allows) and bug fixing (02: 8.0). Its operations dashboard came 5th of 10 (11: 7.75); the grader called it the most "control room" looking, held back by invented detail.
  - **Weakest:** writing. It came last on technical writing (05: 4.25, "invents several behaviors and mishandles both contradictions"), the story (07: 5.5, "the logic is muddled") and social media (08: 6.25, "invents product behaviour and features"). Its packaging change (04: 5.5) rejects version strings the old code accepted.
  - **Pattern:** inventing facts the brief didn't give, the same failure mode as Luna, muse and mimo, and worst in customer-facing text. Its frontends were its strongest group (7.25 average, above Luna, muse and mimo).
  - **Run:** 42 min 16 s and 0.58M input + 18.6M cache-read + 398k output tokens; its Token Plan counters didn't move, so cost can't be measured.
- **GPT-6 Luna, muse and mimo** repeat the failures seen in earlier passes:
  - packages that don't build (04);
  - invented facts in writing;
  - thin test suites;
  - generic frontends with real bugs;
  - mimo's recursive cycle check crashing on large inputs (01).

### What is inferred

- Within the Claude tier and within the GPT/Grok tier, gaps are small enough that another run could reorder models on a given work type. The gaps between the tiers are well beyond grading noise.
- Opus 5.5 on extra effort might score higher. This run can't say.
- MiniMax M3.1 Flash is a "Flash" preview model at xhigh effort; MiniMax's larger models might do better. Its strength on structured work (planning, code, dashboards) against its weakness on factual discipline in prose fits the lower tier's pattern rather than a new one.
- Quota "hunger" depends on the account's plan as much as the model. Astra drained a 5-hour window on one account and used 3% of the weekly quota on another for similar token counts.

## Recommendations by work type

- **Code:** Sonnet 5.5, Fable 5.1 or Opus 5.5. Astra and Grok are close behind; Grok's code was excellent when it worked, and cheapest.
- **Writing and planning:** Opus 5.5 or Sonnet 5.5. Astra is the best non-Claude choice. Avoid Grok for customer-facing copy.
- **Incident analysis and operations:** Sonnet 5.5. Grok and Astra are strong alternatives on evidence handling.
- **Frontend:** Sonnet 5.5. Grok 4.7 for dense operational UIs.
- **Cost-sensitive work:** Opus 5.5 or Sonnet 5.5 (about $0.12 per point) if you pay per dollar. Grok 4.7 is cheaper still ($6.74 for 12 tasks) but slow and uneven.
- **GPT-6 Luna, muse, mimo and MiniMax M3.1 Flash:** not for unsupervised work on these task types. MiniMax M3.1 Flash is usable as a second opinion on code and plans, not for customer-facing writing.

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
  - MiniMax M3.1 Flash ran through mcode on this Mac in the normal HOME (mcode refuses a clean one): no personal instruction files reached it, but the user's skills did, as for muse.
- **Cost figures aren't comparable across providers.** Claude figures come from account balances, Grok's from its CLI, and GPT, muse and MiniMax report tokens (and GPT quota) only.
- **Not checked:** ruff lint results in task 04, and nginx syntax in task 03 (no nginx binary was available). No containers were started.
