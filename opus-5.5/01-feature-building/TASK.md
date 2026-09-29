# Task 01 — Feature building: dependency-aware scheduler

Implement `plan_jobs` in `jobqueue.py` and expand `test_jobqueue.py` with useful
edge cases. Use only the Python standard library.

Contract:

- Every `Job.id` must be a non-empty string and unique.
- Every dependency must name a supplied job. Reject invalid input with
  `ScheduleError` and a useful message.
- Return every job ID exactly once, always after all of its dependencies.
- Among jobs currently ready, choose higher `priority` first. Break equal
  priorities by original input order.
- Detect dependency cycles and raise `ScheduleError`; include the IDs involved
  in the diagnostic when practical.
- Do not mutate the supplied jobs or their dependency lists.
- Empty input returns an empty list.

Run the tests. Write `RESPONSE.md` summarizing the design, edge cases covered,
and the exact verification command/result. Keep all work inside this directory.

