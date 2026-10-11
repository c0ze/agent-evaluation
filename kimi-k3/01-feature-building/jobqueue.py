import heapq
from dataclasses import dataclass, field
from typing import Any, Iterable


class ScheduleError(ValueError):
    pass


@dataclass(frozen=True)
class Job:
    id: str
    priority: int = 0
    depends_on: tuple[str, ...] = field(default_factory=tuple)
    payload: Any = None


def plan_jobs(jobs: Iterable[Job]) -> list[str]:
    """Return job IDs in a valid deterministic execution order.

    Every job appears exactly once, after all of its dependencies. Among the
    jobs that are ready at any point, higher ``priority`` wins; ties are
    broken by original input order. Raises :class:`ScheduleError` for
    invalid input (empty/duplicate IDs, unknown dependencies) or cycles.
    The input jobs are never mutated.
    """
    job_list = list(jobs)

    by_id: dict[str, Job] = {}
    for job in job_list:
        if not isinstance(job.id, str) or not job.id:
            raise ScheduleError(f"job id must be a non-empty string, got {job.id!r}")
        if job.id in by_id:
            raise ScheduleError(f"duplicate job id: {job.id!r}")
        by_id[job.id] = job

    # Build indegree counts and dependent lists from copies; never touch input.
    indegree: dict[str, int] = {job.id: 0 for job in job_list}
    dependents: dict[str, list[str]] = {job.id: [] for job in job_list}
    for job in job_list:
        for dep in job.depends_on:
            if dep not in by_id:
                raise ScheduleError(
                    f"job {job.id!r} depends on unknown job {dep!r}"
                )
            indegree[job.id] += 1
            dependents[dep].append(job.id)

    # Kahn's algorithm; heap entries are (-priority, input_index, job_id) so
    # the ready job with the highest priority (then earliest input order) is
    # always chosen next.
    input_index = {job.id: index for index, job in enumerate(job_list)}
    ready: list[tuple[int, int, str]] = [
        (-job.priority, input_index[job.id], job.id)
        for job in job_list
        if indegree[job.id] == 0
    ]
    heapq.heapify(ready)

    order: list[str] = []
    while ready:
        _, _, job_id = heapq.heappop(ready)
        order.append(job_id)
        for dependent in dependents[job_id]:
            indegree[dependent] -= 1
            if indegree[dependent] == 0:
                dep_job = by_id[dependent]
                heapq.heappush(
                    ready, (-dep_job.priority, input_index[dependent], dependent)
                )

    if len(order) != len(job_list):
        remaining = sorted(jid for jid, deg in indegree.items() if deg > 0)
        raise ScheduleError(
            f"dependency cycle detected involving jobs: {', '.join(remaining)}"
        )

    return order

