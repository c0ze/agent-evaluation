# Task 01 — Response: dependency-aware scheduler

## What was implemented

`plan_jobs` in `jobqueue.py` is now a complete, deterministic, dependency-aware
topological scheduler. Standard library only (`collections.abc`, `dataclasses`,
`heapq`, `typing`); no third-party imports. The pre-existing `Job` and
`ScheduleError` declarations are unchanged, and the three original tests still
pass unmodified.

## Design

**Two validation passes, then one scheduling pass.**

1. **Pass 1 — shape of each entry.** The input iterable is materialised once
   (`list(jobs)`), so generators and other one-shot iterables work and are never
   replayed. Each item must be a `Job`; its `id` must be a non-empty,
   non-blank string and unique (the error reports *both* offending positions);
   its `priority` must be numeric. `depends_on` must be a non-string iterable of
   non-empty strings. Duplicate entries within one `depends_on` are collapsed
   while preserving order — without this, a repeated dependency would inflate
   the dependency count and leave the job permanently unschedulable, turning a
   benign input into a bogus "cycle".
2. **Pass 2 — reference resolution.** Every dependency must name a job that was
   actually supplied. This has to run after pass 1 so that a dependency
   pointing *forward* (to a job declared later) is legal, not an error.
3. **Pass 3 — Kahn's algorithm with a priority heap.** Each job starts with an
   indegree equal to its distinct dependency count. The ready set is a heap keyed
   by `(-priority, input_position)`. Popping the minimum yields the
   highest-priority ready job, and because input position is the second key
   (and is unique per job), equal priorities fall back to original input order.
   Emitting a job decrements each dependent's indegree and pushes any dependent
   that reaches zero.

**Key decision — priority is evaluated dynamically over the ready set**, never
precomputed. A high-priority job that is still blocked does not reserve its
slot and does not preempt an already-ready job; it is considered only once its
last dependency has been emitted. This is what makes the output both valid and
greedily optimal at every step.

**Cycle diagnostics.** If the heap empties before every job is scheduled, the
remaining jobs are exactly the ones that can never run. Rather than reporting a
bare "cycle detected", an iterative white/grey/black DFS runs over *only those
blocked jobs* — satisfied dependencies are skipped, since they cannot close a
loop — and reconstructs one concrete cycle as `a -> b -> c -> a`. The message
then separately lists every blocked job, which usefully distinguishes the jobs
genuinely inside a cycle from jobs merely *downstream* of it. Unrelated
schedulable jobs are never implicated.

**Why iterative.** Both the Kahn loop and the cycle-finding DFS are iterative.
A dependency chain (or cycle) of 2000 jobs must not exhaust the interpreter
stack; `test_deep_chain_does_not_exhaust_the_stack` and
`test_deep_cycle_does_not_exhaust_the_stack` pin this down.

**No mutation.** The supplied `Job` objects are frozen dataclasses and are only
ever read. Dependencies are normalised into a new internal `dict`, so a
caller's mutable list is neither written to nor reordered. A fresh result list
is built per call. This holds on the error paths too: a failing call leaves the
input exactly as it was.

`ScheduleError` remains a `ValueError` subclass, and non-iterable input is
normalised from `TypeError` into `ScheduleError` so callers only need one
exception type to catch.

## Edge cases covered

The suite grew from 3 tests to **44**. A shared `assert_valid_order` helper
re-checks the full contract (every id exactly once, no duplicates, every
dependency emitted first) independently of the expected literal.

- **Trivial input** — empty list returns `[]`; single job; no dependencies
  preserves input order; any iterable accepted, including a generator that is
  consumed exactly once and never replayed.
- **Id validation** — duplicate id (message names both positions), empty id,
  whitespace-only id, non-string id, non-`Job` item, non-numeric priority,
  non-iterable input.
- **Dependency validation** — unknown dependency (message names both the
  dependent and the missing id, plus the known jobs); non-string dependency;
  empty-string dependency; `depends_on` given as a bare string (iterable, but
  would silently split into characters — explicitly rejected); `depends_on=None`.
- **Graph semantics** — forward-declared dependencies; declaration order
  irrelevant; duplicate dependency entries do not stall; a list `depends_on`
  works and is left untouched; diamond fan-in where a job waits for *both*
  branches; priority only among ready jobs; equal priorities falling back to
  input order; negative and zero priorities; 50-wide fan-in; a 2000-deep chain;
  repeat-call determinism; every id returned exactly once.
- **Cycles** — self-dependency; two-node cycle; three-node cycle naming every
  member; a 60-node cycle; message identifies the cycle without blaming
  unrelated runnable jobs; jobs merely downstream of a cycle reported
  separately; a cycle aborts the whole plan even when other jobs are
  schedulable; a 2000-deep cycle does not exhaust the stack.
- **Immutability** — jobs deep-equal their pre-call snapshot; caller dependency
  lists unchanged; input unchanged even when the call *raises*; payloads
  untouched; the returned list is fresh per call (mutating it does not affect
  the next call).

### Note on three corrected test expectations

An initial run failed three tests. All three were **errors in my test
expectations, not bugs in the implementation**, and were corrected after
re-deriving the expected order from the contract:

- `test_diamond_dependency` — `top` depends on both `left` and `right`, so
  `right` must precede `top`; I had wrongly omitted it from the expectation.
- `test_depends_on_may_be_a_list_and_is_not_mutated` — all three jobs tie at
  priority 0 and `a` is blocked, so the order is `b, c, a`; my `a, b, c`
  expectation violated the dependency rule it was meant to illustrate.
- `test_priority_only_applies_among_ready_jobs` — `mid_free(50)` is already
  ready at t=0 and so outranks `low_prereq(0)`; my expectation had encoded the
  misconception that a blocked high-priority job reserves its slot.

## Verification

Command (run from this directory):

```
$ python3 -m unittest -v
```

Result:

```
Ran 44 tests in 0.006s

OK
```

Environment: Python 3.14.3 (main, Mar 24 2026, 16:45:24) [Clang 22.1.1],
macOS (darwin 27.0.0 arm64). `python3 -m unittest` discovers and runs the
suite because the test module lives beside the implementation; no network and
no third-party packages are involved.

As an additional confidence check beyond the committed suite, `plan_jobs` was
cross-validated against an independent oracle over randomly generated graphs
(inline, not committed): across **3000 random DAGs** every returned order was a
permutation of the input with every dependency preceding its dependent, and
across **1000 random DAGs** each order was identical on repeat calls *and*
matched a brute-force greedy simulation that selects, at every step, the
highest-priority currently-ready job with input-order tie-break — confirming
the result is not merely a valid topological sort but the intended greedy one.
Sample diagnostics:

```
unknown dep -> job 'build' depends on unknown job 'ghost'; known jobs: build, other
dup id      -> duplicate job id: 'a' appears at positions 0 and 2; job ids must be unique
cycle       -> dependency cycle detected: a -> b -> c -> a; 4 job(s) can never run
               (directly or transitively): a, b, c, downstream
self cycle  -> dependency cycle detected: solo -> solo; 1 job(s) can never run
               (directly or transitively): solo
```

All deliverables are confined to this directory: `jobqueue.py` (implementation),
`test_jobqueue.py` (44 tests), and this `RESPONSE.md`.
