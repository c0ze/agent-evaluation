from dataclasses import dataclass, field
from heapq import heappop, heappush
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
    """Order jobs by dependencies, then ready-job priority and input position.

    Repeated dependencies count once. Invalid IDs, missing dependencies, and
    dependency cycles raise ScheduleError without modifying the supplied jobs.
    """
    jobs = list(jobs)
    positions = {}
    for index, job in enumerate(jobs):
        if not isinstance(job.id, str) or not job.id:
            raise ScheduleError(
                f"Job at input position {index} has invalid ID {job.id!r}; "
                "IDs must be non-empty strings"
            )
        if job.id in positions:
            raise ScheduleError(f"Duplicate job ID: {job.id!r}")
        positions[job.id] = index

    remaining = [0] * len(jobs)
    dependents = [[] for _ in jobs]
    for index, job in enumerate(jobs):
        seen = set()
        for dependency in job.depends_on:
            if not isinstance(dependency, str) or not dependency:
                raise ScheduleError(
                    f"Job {job.id!r} has invalid dependency {dependency!r}; "
                    "dependencies must name supplied jobs with non-empty string IDs"
                )
            if dependency not in positions:
                raise ScheduleError(
                    f"Job {job.id!r} has unknown dependency {dependency!r}"
                )
            if dependency not in seen:
                seen.add(dependency)
                remaining[index] += 1
                dependents[positions[dependency]].append(index)

    ready = []
    for index, job in enumerate(jobs):
        if remaining[index] == 0:
            heappush(ready, (-job.priority, index))

    order = []
    while ready:
        _, index = heappop(ready)
        order.append(jobs[index].id)
        for dependent in dependents[index]:
            remaining[dependent] -= 1
            if remaining[dependent] == 0:
                heappush(ready, (-jobs[dependent].priority, dependent))

    if len(order) != len(jobs):
        unresolved = ", ".join(
            repr(job.id) for index, job in enumerate(jobs) if remaining[index]
        )
        raise ScheduleError(
            f"Dependency cycle detected; unresolved jobs: {unresolved}"
        )
    return order
