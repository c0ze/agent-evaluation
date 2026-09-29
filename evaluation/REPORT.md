## Results

Scores come from the latest blind pass, which graded all nine models together. Grok 4.7's task 13 stopped when its usage balance ran out and awaits a re-run, so Grok is compared on its **average per task** over 12 tasks.

| | Avg / task | Code | Writing | Ops | Frontend | Time | Cost / usage |
|---|---|---|---|---|---|---|---|
| **Sonnet 5.5** (extra) | **9.42** | **9.81** | 9.12 | **9.50** | **9.25** | ~28 min | $15 |
| **Opus 5.5** (high) | 9.08 | 9.56 | **9.31** | 8.50 | 8.50 | ~21 min | $14 |
| **Fable 5.1** (extra) | 8.83 | 9.62 | 8.25 | 8.62 | 8.67 | ~49 min | $53 |
| **GPT-6 Astra** (xhigh) | 8.69 | 9.31 | 8.81 | 8.50 | 7.83 | ~35 min | 3.6M in / 185k out tokens |
| **GPT-6.1 Sol** (xhigh) | 8.58 | 8.88 | 8.44 | 8.50 | 8.42 | ~48 min | 5.8M in / 243k out tokens |
| **Grok 4.7** (xhigh), 12 tasks | 8.42 | 9.31 | 7.31 | 8.50 | 8.75 | ~80 min | $6.74 |
| **GPT-6 Luna** (max) | 7.00 | 7.06 | 7.75 | 7.00 | 5.92 | ~34 min | 3.5M in / 220k out tokens |
| **muse** (max) | 6.92 | 6.81 | 6.75 | 7.75 | 6.75 | ~20 min | 6.2M in / 162k out tokens |
| **mimo** | 6.58 | 7.06 | 7.00 | 6.25 | 5.58 | not recorded | not recorded |

Totals (of 130): Sonnet 122.5, Opus 118.0, Fable 114.75, Astra 113.0, Sol 111.5, Luna 91.0, muse 90.0, mimo 85.5; Grok 101.0 of 120.

### What was observed

- **Every model completed every task it ran** and passed the hidden 11-test contract suite for tasks 01–02. No frontend page scrolled sideways at 390 px or made a network request. Two runs were interrupted by quota rather than failing: Astra's tasks 10–13 (re-run from the template on another account) and Grok's task 13 (to be re-run).
- **Sonnet 5.5 is first in every grading pass so far** (4-way, 5-way, 6-way, 9-way). In this pass it had the best or tied-best score on 10 of 13 tasks; Opus on 6, Fable and Grok on 2 each, Astra on 1 (ties counted for each).
- **Three tiers:**
  - **Claude models:** 8.8–9.4 per task.
  - **GPT-6 Astra, GPT-6.1 Sol and Grok 4.7:** 8.4–8.7.
  - **GPT-6 Luna, muse and mimo:** 6.6–7.0.
- **Grading repeatability.** Between the six-way and nine-way passes, per-task scores for the same submissions moved by 0.37 points on average, and 5 of 78 moved by a point or more.
- **GPT-6 Astra** was the most consistent non-Claude model:
  - Its bug fix scored a clean 10, and its story (07) and incident analysis (09) scored 9.
  - Its weak spot was frontend. On task 12, hidden line breaks joined words at 390 px. On task 13, the hero pushed the care queue below the fold, and it showed the real date against fixed data.
- **GPT-6.1 Sol** had no failures and scored 8–9.75 on every task. Its packaging work was the most thorough (task 04: built, installed and tested offline). The graders found its pages and prose competent but generic.
- **Grok 4.7** scored very unevenly:
  - **Strong:** code, with 10 on both 01 and 02 (its cycle diagnostic names exactly the jobs on cycles). It had the most rigorous incident analysis (9.25) and the most control-room-like dashboard (9.0).
  - **Weak:** social media (5.5), where its voice was cold and it invented purchasing and training facts. Its story also scored low (7.25).
  - **Cost and speed:** by far the cheapest in dollars ($6.74 for 12 tasks), and by far the slowest (80 min).
- **GPT-6 Luna, muse and mimo** repeat the failures seen in earlier passes:
  - packages that don't build (04);
  - invented facts in writing;
  - thin test suites;
  - generic frontends with real bugs;
  - mimo's recursive cycle check crashing on large inputs (01).

### What is inferred

- Within the Claude tier and within the GPT/Grok tier, gaps are small enough that another run could reorder models on a given work type. The gaps between the tiers are well beyond grading noise.
- Opus 5.5 on extra effort might score higher. This run can't say.
- Quota "hunger" depends on the account's plan as much as the model. Astra drained a 5-hour window on one account and used 3% of the weekly quota on another for similar token counts.

## Recommendations by work type

- **Code:** Sonnet 5.5, Fable 5.1 or Opus 5.5. Astra and Grok are close behind; Grok's code was excellent when it worked, and cheapest.
- **Writing and planning:** Opus 5.5 or Sonnet 5.5. Astra is the best non-Claude choice. Avoid Grok for customer-facing copy.
- **Incident analysis and operations:** Sonnet 5.5. Grok and Astra are strong alternatives on evidence handling.
- **Frontend:** Sonnet 5.5. Grok 4.7 for dense operational UIs.
- **Cost-sensitive work:** Opus 5.5 or Sonnet 5.5 (about $0.12 per point) if you pay per dollar. Grok 4.7 is cheaper still ($6.74 for 12 tasks) but slow and uneven.
- **GPT-6 Luna, muse and mimo:** not for unsupervised work on these task types.

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
- **Cost figures aren't comparable across providers.** Claude figures come from account balances, Grok's from its CLI, and GPT and muse report tokens and quota only.
- **Not checked:** ruff lint results in task 04, and nginx syntax in task 03 (no nginx binary was available). No containers were started.
