from dataclasses import dataclass, field
from graphlib import CycleError, TopologicalSorter
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
    """Return job IDs in a valid deterministic execution order."""
    ordered_jobs = list(jobs)
    positions = {}
    for index, job in enumerate(ordered_jobs):
        if not isinstance(job.id, str) or not job.id:
            raise ScheduleError(
                f"Job ID at position {index} must be a non-empty string, got {job.id!r}"
            )
        if job.id in positions:
            raise ScheduleError(f"Duplicate job ID {job.id!r}")
        positions[job.id] = index

    graph = TopologicalSorter()
    for job in ordered_jobs:
        graph.add(job.id)
        for dependency in job.depends_on:
            if not isinstance(dependency, str) or dependency not in positions:
                raise ScheduleError(f"Job {job.id!r} has unknown dependency {dependency!r}")
            graph.add(job.id, dependency)

    try:
        graph.prepare()
    except CycleError as error:
        cycle = " -> ".join(error.args[1])
        raise ScheduleError(f"Dependency cycle: {cycle}") from error

    ready = []
    result = []
    while graph.is_active():
        for job_id in graph.get_ready():
            index = positions[job_id]
            heappush(ready, (-ordered_jobs[index].priority, index))
        _, index = heappop(ready)
        job_id = ordered_jobs[index].id
        result.append(job_id)
        graph.done(job_id)
    return result

