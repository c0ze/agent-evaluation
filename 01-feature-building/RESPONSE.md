# Task 01 — dependency-aware scheduler

## Design

`plan_jobs(jobs)` in `jobqueue.py` runs Kahn's algorithm over the dependency
graph, with a heap as the "ready" frontier so selection is deterministic.

1. **Materialize and validate.** The input iterable is consumed once into a list.
   Each entry must be a `Job`; each `id` must be a non-empty string and unique.
   Input position is recorded in `position`, priority in `priority`.
2. **Normalize dependencies.** `_normalize_dependencies` copies each
   `depends_on` into a fresh list (never touching the caller's object), rejects
   a bare string (a common `depends_on="a"` mistake), rejects empty/non-string
   dependency names, rejects self-dependencies, and de-duplicates repeated
   entries so a dependency listed twice cannot double-decrement the indegree.
3. **Build edges.** Each dependency must exist in `position`, otherwise
   `ScheduleError: job 'build' depends on unknown job 'ghost'`. Forward edges
   `dependents[dep] -> job` and `indegree[job]` are recorded.
4. **Schedule.** All indegree-0 jobs are pushed as `(-priority, position, id)`
   tuples. The heap yields the highest priority first; equal priorities fall back
   to input position. When a job is emitted, its dependents' indegrees are
   decremented and any job reaching zero is pushed. Dependencies therefore always
   win over priority — a high-priority blocked job never stalls ready work.
5. **Cycle detection.** If the plan is shorter than the job count, the leftover
   jobs are exactly those on or downstream of a cycle. `_describe_cycle` walks
   them with an iterative DFS (no recursion limit risk) starting from the
   lowest input position and returns one concrete cycle, e.g.
   `dependency cycle detected involving jobs: a -> b -> a`.

Complexity: `O(V + E)` plus `O(V log V)` heap operations. Only the standard
library is used (`heapq`, `dataclasses`, `typing`); `Job` itself is unchanged.

## Edge cases covered (29 tests in `test_jobqueue.py`)

- **Ordering:** dependencies beat priority; priority-then-input-order ties;
  negative priorities; blocked high-priority job does not stall ready jobs;
  chains; diamond/shared-edge graphs; a 6-job graph property-checked for
  "each ID once, always after its dependencies"; determinism across repeat
  calls; generators accepted as input; `payload` ignored.
- **Validation:** unknown dependency (message names both jobs); duplicate job
  IDs; empty and non-string job IDs; empty dependency name; bare-string
  `depends_on`; non-`Job` entries; self-dependency.
- **Cycles:** two-job cycle, three-job cycle (all members named), and a cycle
  hanging off an acyclic prefix (only the cycle members appear in the
  diagnostic); an acyclic graph with shared edges is not misreported.
- **Immutability:** input `Job`s deep-compared before/after; input list order
  unchanged; a list-valued `depends_on` is accepted and left untouched.

## Verification

```
cd /tmp/claude-1000/-home-arda-projects-agent-evaluation/8413ce30-b544-4ae4-afd6-5f8333042ec1/scratchpad/agent-eval-hy4-preview-codebuddy/01-feature-building
python3 -m unittest -v test_jobqueue.py
```

Result: `Ran 29 tests in 0.002s` — `OK` (all 29 pass; the same suite also passes
via `python3 -m unittest discover -s . -p 'test_*.py'`). Python 3, standard
library only, no network access used.
