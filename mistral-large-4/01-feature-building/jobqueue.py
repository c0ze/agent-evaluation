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

    Jobs are scheduled with Kahn's algorithm over a max-heap keyed by
    (-priority, input order), so among currently ready jobs the highest
    priority runs first, with ties broken by original input order.

    Raises ScheduleError for empty/duplicate IDs, unknown dependencies,
    or dependency cycles. The input is never mutated.
    """
    job_list = list(jobs)

    seen: dict[str, int] = {}
    for index, job in enumerate(job_list):
        if not isinstance(job.id, str) or not job.id:
            raise ScheduleError(
                f"job at index {index} has an invalid id: {job.id!r} "
                "(must be a non-empty string)"
            )
        if job.id in seen:
            raise ScheduleError(
                f"duplicate job id {job.id!r} at indices "
                f"{seen[job.id]} and {index}"
            )
        seen[job.id] = index

    for job in job_list:
        for dep in job.depends_on:
            if dep not in seen:
                raise ScheduleError(
                    f"job {job.id!r} depends on unknown job {dep!r}"
                )

    remaining_deps = {job.id: len(job.depends_on) for job in job_list}
    dependents: dict[str, list[str]] = {job.id: [] for job in job_list}
    for job in job_list:
        for dep in job.depends_on:
            dependents[dep].append(job.id)

    ready: list[tuple[int, int, str]] = []
    for job in job_list:
        if remaining_deps[job.id] == 0:
            heapq.heappush(ready, (-job.priority, seen[job.id], job.id))

    order: list[str] = []
    while ready:
        _, _, job_id = heapq.heappop(ready)
        order.append(job_id)
        for dependent in dependents[job_id]:
            remaining_deps[dependent] -= 1
            if remaining_deps[dependent] == 0:
                heapq.heappush(
                    ready, (-job_list[seen[dependent]].priority, seen[dependent], dependent)
                )

    if len(order) != len(job_list):
        cyclic = sorted(job.id for job in job_list if remaining_deps[job.id] > 0)
        raise ScheduleError(
            "dependency cycle detected involving job ids: " + ", ".join(cyclic)
        )

    return order
