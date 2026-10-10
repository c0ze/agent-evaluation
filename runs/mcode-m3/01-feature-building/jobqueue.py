from dataclasses import dataclass, field
from typing import Any, Iterable
import heapq


class ScheduleError(ValueError):
    """Raised when jobs cannot be scheduled due to invalid input or cycles."""


@dataclass(frozen=True)
class Job:
    id: str
    priority: int = 0
    depends_on: tuple[str, ...] = field(default_factory=tuple)
    payload: Any = None


def plan_jobs(jobs: Iterable[Job]) -> list[str]:
    """Return job IDs in a valid deterministic execution order.

    Validation
    ----------
    - Every ``Job.id`` must be a non-empty string and unique across the
      input. Violations raise :class:`ScheduleError` and identify the
      offending value and its position.
    - Every entry in ``depends_on`` must name another job in the input.
      Unknown references raise :class:`ScheduleError` identifying both
      the dependent and the missing job.

    Scheduling
    ----------
    - The result lists every supplied id exactly once.
    - A job is only emitted once every job it depends on has already been
      emitted.
    - Among jobs that are currently ready (no outstanding dependencies),
      the one with the highest ``priority`` is emitted next; ties are
      broken by original input order (earlier in the iterable first).
    - If a dependency cycle is detected, :class:`ScheduleError` is raised
      and the ids of jobs still holding unsatisfied dependencies are
      included in the message.

    The supplied jobs and their ``depends_on`` tuples are never mutated.
    """
    # One pass over the iterable so we can both validate ids and remember
    # the original input position used to break priority ties.
    job_list = list(jobs)

    # --- Validate ids ------------------------------------------------------
    seen: set[str] = set()
    for index, job in enumerate(job_list):
        if not isinstance(job.id, str) or not job.id:
            raise ScheduleError(
                f"Job at position {index} has invalid id {job.id!r}; "
                "ids must be non-empty strings"
            )
        if job.id in seen:
            raise ScheduleError(
                f"Duplicate job id {job.id!r} at position {index}"
            )
        seen.add(job.id)

    if not job_list:
        return []

    id_to_job = {job.id: job for job in job_list}
    order_index = {job.id: index for index, job in enumerate(job_list)}

    # --- Validate dependencies --------------------------------------------
    for job in job_list:
        for dep in job.depends_on:
            if dep not in id_to_job:
                raise ScheduleError(
                    f"Job {job.id!r} depends on unknown job {dep!r}"
                )

    # --- Build the graph --------------------------------------------------
    # dependents[dep_id] is the list of jobs that depend on dep_id.
    # pending[job_id] is the SET of dep_ids for job_id that have not yet
    # been emitted. We copy the depends_on tuple into a fresh set so the
    # caller's tuple is never touched.
    dependents: dict[str, list[str]] = {job.id: [] for job in job_list}
    pending: dict[str, set[str]] = {
        job.id: set(job.depends_on) for job in job_list
    }
    for job in job_list:
        for dep in job.depends_on:
            dependents[dep].append(job.id)

    # --- Schedule --------------------------------------------------------
    # Min-heap keyed on (-priority, input_order, id). heapq gives us the
    # smallest key first, so negating priority puts higher priorities
    # first; ties fall back to the original input position.
    ready: list[tuple[int, int, str]] = []
    for job in job_list:
        if not pending[job.id]:
            heapq.heappush(
                ready,
                (-job.priority, order_index[job.id], job.id),
            )

    result: list[str] = []
    while ready:
        _, _, job_id = heapq.heappop(ready)
        result.append(job_id)
        for dependent_id in dependents[job_id]:
            pending[dependent_id].discard(job_id)
            if not pending[dependent_id]:
                dependent_job = id_to_job[dependent_id]
                heapq.heappush(
                    ready,
                    (
                        -dependent_job.priority,
                        order_index[dependent_id],
                        dependent_id,
                    ),
                )

    if len(result) != len(job_list):
        # Whatever is still in `pending` belongs to one or more cycles.
        cyclic = sorted(job_id for job_id, deps in pending.items() if deps)
        raise ScheduleError(
            f"Dependency cycle detected involving jobs: {cyclic}"
        )

    return result