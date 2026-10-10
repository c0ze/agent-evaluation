# Response — dependency-aware scheduler

## Design
`plan_jobs` validates then runs Kahn's topological sort. It copies the input
to a list (supports any iterable, preserves input order), validates every ID
is a unique non-empty string, validates every dependency names a supplied job,
builds `indegree`/`dependents` maps with duplicate dependencies deduplicated,
then repeatedly picks from currently-ready jobs via
`max(ready, key=(priority, -input_index))` so higher priority wins and ties
keep input order. Newly unblocked jobs join `ready`; if output is short, the
remaining IDs (input order) are reported in a `ScheduleError` cycle message.
Only reads inputs (`list()` copies); never mutates jobs or dependency lists.
Empty input returns `[]`. Standard library only.

## Edge cases covered
Added 20 tests to `test_jobqueue.py` (23 total): empty tuple/list, single job,
duplicate IDs, empty/non-string IDs, unknown dependency + message contents,
invalid deps (`""`, non-string, `None`, bare-string `depends_on`), self-cycle,
2-cycle and 4-node cycle ID reporting, duplicate deps tolerated, diamond,
chain overriding priority, newly-ready high priority jumping ahead, equal
priority after unblock, no-mutation of jobs and of list-valued `depends_on`,
generator input, and every-ID-once plus topological validity on a 5-node graph.

## Verification
Command (run in this directory):

`python3 -m unittest test_jobqueue -v`

Result: `Ran 23 tests in 0.001s — OK`.
