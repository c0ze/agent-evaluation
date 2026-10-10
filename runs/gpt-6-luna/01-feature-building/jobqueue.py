from dataclasses import dataclass, field
import heapq
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
    supplied_jobs = list(jobs)

    # Keep the input order in the index: it is the stable tie breaker among
    # jobs with equal priority.
    jobs_by_id: dict[str, Job] = {}
    for job in supplied_jobs:
        if not isinstance(job, Job):
            raise ScheduleError(f"Expected a Job instance, got {type(job).__name__}")
        if not isinstance(job.id, str) or not job.id:
            raise ScheduleError("Job IDs must be non-empty strings")
        if job.id in jobs_by_id:
            raise ScheduleError(f"Duplicate job ID: {job.id!r}")
        jobs_by_id[job.id] = job

    # Build reverse edges so that completing a prerequisite releases its
    # dependent jobs. Copy dependencies into local structures only.
    dependents: dict[str, list[str]] = {job_id: [] for job_id in jobs_by_id}
    remaining_dependencies: dict[str, int] = {}
    for job in supplied_jobs:
        try:
            dependencies = tuple(job.depends_on)
        except TypeError as exc:
            raise ScheduleError(f"Dependencies for job {job.id!r} must be iterable") from exc

        for dependency in dependencies:
            if not isinstance(dependency, str) or not dependency:
                raise ScheduleError(
                    f"Dependencies for job {job.id!r} must be non-empty job ID strings"
                )
            if dependency not in jobs_by_id:
                raise ScheduleError(
                    f"Job {job.id!r} depends on unknown job {dependency!r}"
                )
            dependents[dependency].append(job.id)
        remaining_dependencies[job.id] = len(dependencies)

    job_indices = {job.id: index for index, job in enumerate(supplied_jobs)}
    ready: list[tuple[int, int, str]] = []
    for job in supplied_jobs:
        if remaining_dependencies[job.id] == 0:
            try:
                heapq.heappush(ready, (-job.priority, job_indices[job.id], job.id))
            except TypeError as exc:
                raise ScheduleError(
                    f"Priority for job {job.id!r} must be an ordered numeric value"
                ) from exc

    order: list[str] = []
    while ready:
        _, _, job_id = heapq.heappop(ready)
        order.append(job_id)

        for dependent_id in dependents[job_id]:
            remaining_dependencies[dependent_id] -= 1
            if remaining_dependencies[dependent_id] == 0:
                dependent = jobs_by_id[dependent_id]
                try:
                    heapq.heappush(
                        ready,
                        (-dependent.priority, job_indices[dependent_id], dependent_id),
                    )
                except TypeError as exc:
                    raise ScheduleError(
                        f"Priority for job {dependent_id!r} must be an ordered numeric value"
                    ) from exc

    if len(order) != len(supplied_jobs):
        unscheduled = [job.id for job in supplied_jobs if remaining_dependencies[job.id] > 0]
        raise ScheduleError(
            "Dependency cycle detected; jobs still blocked: " + ", ".join(unscheduled)
        )

    return order
