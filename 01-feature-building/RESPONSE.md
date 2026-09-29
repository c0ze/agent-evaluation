# Task 01: Dependency-aware scheduler

## Design

`plan_jobs` in `jobqueue.py` is Kahn's topological sort. Its ready set is a min-heap keyed on
`(-priority, input_position, id)`.

1. **Materialize and validate.** The input iterable is copied into a list once, so generators
   work. `_validate` checks every item in one pass and raises `ScheduleError` for these cases:
   - the item is not a `Job`;
   - the `id` is not a `str`, or is empty;
   - the `id` duplicates an earlier one (the message gives both positions);
   - the `priority` is not an `int` (`bool` is rejected too);
   - `depends_on` is a bare `str`/`bytes`, which would otherwise be read as one dependency per
     character, or is not iterable;
   - a dependency entry is not a non-empty `str`.

   A second pass rejects dependencies that name unknown jobs. The message names the job and
   lists all of its missing dependencies.
2. **Build the graph without touching the input.** The function builds new dicts: `deps` (a
   `set` of each job's distinct dependencies, so a repeated dependency is counted once),
   `dependents`, and remaining-dependency counts. It never writes to `Job` objects, their
   `depends_on` sequences or the caller's list.
3. **Schedule.** Jobs with no pending dependencies start in the heap. Each pop is the job with
   the highest priority, and among equal priorities the one listed first in the input. Popping
   a job lowers its dependents' counts, and any dependent that reaches 0 is pushed. So a job
   that becomes ready later can still overtake jobs that have been waiting, if it has a higher
   priority or was listed earlier. This follows the rule "among jobs currently ready, choose
   higher priority first; tie-break by original input order". The run time is
   O((V + E) log V).
4. **Cycle diagnostics.** If fewer than all jobs were emitted, the remaining jobs are blocked.
   Every blocked job has at least one blocked dependency. Starting from the first blocked job
   in input order and always following its smallest blocked dependency eventually repeats a
   job, which gives a real cycle without extra search. An example error:

   `dependency cycle detected ('->' means 'depends on'): x -> z -> y -> x; blocked jobs: x, y, z, after`

   The first part shows the actual cycle. The second part lists every job that cannot run,
   including jobs that sit downstream of the cycle.

Empty input returns `[]`. `ScheduleError` still subclasses `ValueError`. `Job` and
`ScheduleError` are unchanged.

## Edge cases covered by tests (34 tests in `test_jobqueue.py`)

- **Basics:** empty input (as a list and as an empty iterator), a single job, generator
  input, a fresh result list on every call, and the same result on repeated calls.
- **Ordering:**
  - equal priorities keep input order;
  - negative and zero priorities;
  - a newly ready high-priority job jumps ahead of jobs that were already waiting;
  - a newly ready job wins a tie through input order, not through how long a job has waited;
  - a low-priority dependency of a high-priority job is not starved;
  - a diamond graph;
  - a 50-job chain listed in reverse order;
  - separate dependency chains mixed together by priority;
  - duplicate dependency entries;
  - `depends_on` given as a `list`.
- **Randomized check:** 200 random DAGs with a fixed seed and shuffled input. Each result is
  checked for a valid order, and at every step it is compared with a brute-force check that
  the chosen job is the best one currently ready.
- **Validation:**
  - an unknown dependency, with a check that the message names both the job and the missing
    ID;
  - duplicate IDs;
  - an empty ID;
  - non-string IDs (`None`, `int`, `bytes`, `tuple`);
  - items that are not `Job`s;
  - a bare-string `depends_on`;
  - invalid dependency entries (`None`, `int`, `""`);
  - non-integer priorities (`str`, `None`, `float`, `bool`);
  - `ScheduleError` being catchable as a `ValueError`.
- **Cycles:**
  - a self-dependency;
  - a two-job cycle, with a check for the exact `a -> b -> a` text;
  - a three-job cycle, where an unrelated upstream job is left out of the message and a
    downstream job is reported only as blocked;
  - a cycle alongside many jobs that could be scheduled.
- **No mutation:** after a successful plan and after a cycle error, the jobs, the payloads, a
  shared `depends_on` list and the caller's list are all unchanged (compared against a deep
  copy, with identity checks).

## Verification

Command, run from this directory:

```
python3 -m unittest -v test_jobqueue
```

Result (Python 3.11.15):

```
Ran 34 tests in 0.038s

OK
```
