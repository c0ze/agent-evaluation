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
    jobs = list(jobs)
    input_order = {}
    for index, job in enumerate(jobs):
        if not isinstance(job.id, str) or not job.id:
            raise ScheduleError(
                f"Job at input index {index} needs a non-empty string ID, got {job.id!r}"
            )
        if job.id in input_order:
            raise ScheduleError(f"Duplicate job ID {job.id!r}")
        input_order[job.id] = index

    sorter = TopologicalSorter()
    for job in jobs:
        try:
            dependencies = tuple(job.depends_on)
        except TypeError as error:
            raise ScheduleError(f"Dependencies for job {job.id!r} must be iterable") from error
        for dependency in dependencies:
            if not isinstance(dependency, str) or dependency not in input_order:
                raise ScheduleError(f"Job {job.id!r} has unknown dependency {dependency!r}")
        sorter.add(job.id, *dependencies)

    try:
        sorter.prepare()
    except CycleError as error:
        cycle = " -> ".join(repr(job_id) for job_id in error.args[1])
        raise ScheduleError(f"Dependency cycle: {cycle}") from error

    ready = []
    plan = []
    while sorter.is_active():
        for job_id in sorter.get_ready():
            index = input_order[job_id]
            heappush(ready, (-jobs[index].priority, index, job_id))
        _, _, job_id = heappop(ready)
        plan.append(job_id)
        sorter.done(job_id)

    return plan

