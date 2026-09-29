from dataclasses import dataclass, field
from heapq import heapify, heappop, heappush
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
    """Order jobs by dependencies, then ready priority and original input order.

    Repeated dependencies count as one prerequisite. Cycle diagnostics list
    blocked jobs, which can include downstream dependents of the cycle.
    """
    jobs = list(jobs)
    indices: dict[str, int] = {}
    for index, job in enumerate(jobs):
        if not isinstance(job.id, str) or not job.id:
            raise ScheduleError(
                f"Job at input index {index} must have a non-empty string ID; "
                f"got {job.id!r}"
            )
        if job.id in indices:
            raise ScheduleError(f"Duplicate job ID: {job.id!r}")
        indices[job.id] = index

    remaining = [0] * len(jobs)
    dependents: list[list[int]] = [[] for _ in jobs]
    for index, job in enumerate(jobs):
        seen: set[str] = set()
        for dependency in job.depends_on:
            if not isinstance(dependency, str) or not dependency:
                raise ScheduleError(
                    f"Job {job.id!r} has invalid dependency {dependency!r}; "
                    "expected a non-empty string job ID"
                )
            if dependency not in indices:
                raise ScheduleError(
                    f"Job {job.id!r} has unknown dependency {dependency!r}"
                )
            if dependency not in seen:
                seen.add(dependency)
                remaining[index] += 1
                dependents[indices[dependency]].append(index)

    ready = [
        (-job.priority, index)
        for index, job in enumerate(jobs)
        if remaining[index] == 0
    ]
    heapify(ready)
    ordered: list[str] = []
    while ready:
        _, index = heappop(ready)
        ordered.append(jobs[index].id)
        for dependent in dependents[index]:
            remaining[dependent] -= 1
            if remaining[dependent] == 0:
                heappush(ready, (-jobs[dependent].priority, dependent))

    if len(ordered) != len(jobs):
        blocked = ", ".join(
            repr(jobs[index].id)
            for index, count in enumerate(remaining)
            if count > 0
        )
        raise ScheduleError(f"Dependency cycle detected; blocked job IDs: {blocked}")
    return ordered
