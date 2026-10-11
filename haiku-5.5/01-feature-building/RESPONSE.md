# Response: dependency-aware scheduler (`plan_jobs`)

## Design

`plan_jobs` in `jobqueue.py` is Kahn's topological sort driven by a min-heap.

1. **Validate in two passes.** The first pass checks each item's type, `id`, uniqueness, and `priority`, and records every job's input position. The second pass validates `depends_on` against the complete set of IDs, so forward references work. Any failure raises `ScheduleError` before anything is scheduled.
2. **Build the graph.** `deps` maps each job to its unique dependency names in declared order. `dependents` is the reverse edge list. `waiting` counts unfinished dependencies per job.
3. **Schedule.** Jobs with `waiting == 0` go onto a heap keyed by `(-priority, input_position, id)`. Each step pops the best ready job, appends it to the plan, and decrements its dependents. A dependent enters the heap when its count reaches zero. The key matches the spec exactly: higher priority first, ties broken by input order. Because the position is unique, the ID is never compared.
4. **Detect cycles.** If the plan is shorter than the input, the leftover jobs are blocked. `_find_cycle` starts at the first blocked job and follows unfinished dependencies until a job repeats. It reports that loop, not the whole downstream blocked set. The error reads `dependency cycle: a -> b -> a; unschedulable jobs: ...`. Arrows point from a job to one of its dependencies.

Complexity is O((V + E) log V). The function never writes to a `Job` or to a caller's `depends_on` container. It only builds new dicts and lists, and `depends_on` is read with `tuple(...)`.

## Choices beyond the spec

- A whitespace-only `id` is rejected as well as `""`, since it is not a useful identifier.
- `priority` must be an `int`. `bool` is rejected even though it subclasses `int`, because `True` as a priority is almost always a mistake. Floats and strings are rejected so that ordering stays total.
- A bare `str` for `depends_on` is rejected with a dedicated message. Otherwise `"fetch"` would be iterated as `"f", "e", ...` and produce a confusing "unknown job 'f'" error.
- Non-`Job` items are rejected. Lists are accepted for `depends_on` (the dataclass does not enforce the tuple annotation). Duplicate dependency names are accepted and counted once.
- A self-dependency (`a` depends on `a`) is reported as a cycle, `dependency cycle: a -> a`.

## Edge cases covered (`test_jobqueue.py`, 26 tests)

The three original tests are unchanged.

Ordering:
- Empty input returns `[]`.
- A generator is accepted and consumed once.
- A job released mid-run with higher priority runs before a lower-priority job that was already ready.
- Equal-priority released jobs keep input order, not alphabetical order.
- A diamond dependency runs the shared parent first and the join last.
- Duplicate dependency names are harmless.
- A list-valued `depends_on` works.
- Randomized check: 25 seeded random DAGs, each compared against a brute-force reference that re-derives the choice at every step. The test also checks that every ID appears once and that every dependency precedes its dependent.

Validation:
- Duplicate IDs are rejected, with the positions named.
- Empty, blank, `None`, int, and list IDs are rejected.
- An unknown dependency is rejected, and the message names both jobs.
- Non-string dependencies are rejected.
- A bare-string `depends_on` is rejected.
- A non-iterable `depends_on` is rejected.
- Non-`Job` items are rejected.
- Non-int priorities (`1.5`, `"high"`, `True`) are rejected.

Cycles:
- Self-dependency.
- A two-job cycle, with the IDs in the message.
- A three-job cycle alongside unrelated acyclic jobs. The message names only the loop.
- A cycle entered from a downstream job still reports the real loop.
- Jobs blocked by a cycle are listed as unschedulable.

Immutability:
- Job objects, their order, and the caller's `depends_on` list are unchanged after a successful call.

Sample messages, from running the code:

```
dependency cycle: a -> b -> a; unschedulable jobs: c, a, b
job 'build' depends on unknown job 'missing'
duplicate job id 'a' at positions 0 and 1
job 'build' depends_on must be a collection of job IDs, not a string
```

## Verification

Command (run from the task directory; `PYTHONDONTWRITEBYTECODE=1` keeps `__pycache__` out of it):

```
cd /tmp/claude-1000/-home-arda-projects-agent-evaluation/8413ce30-b544-4ae4-afd6-5f8333042ec1/scratchpad/agent-eval-haiku-5.5/01-feature-building && PYTHONDONTWRITEBYTECODE=1 python3 -m unittest -v test_jobqueue
```

Environment: Python 3.14.7, standard library only.

Result: `Ran 26 tests in 0.052s` followed by `OK`, exit status 0.
