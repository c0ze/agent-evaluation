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
    """Return job IDs in a valid deterministic execution order."""
    if jobs is None or isinstance(jobs, (str, bytes)):
        raise ScheduleError("jobs must be an iterable of Job objects")
    try:
        job_list = list(jobs)
    except TypeError:
        raise ScheduleError("jobs must be an iterable of Job objects")

    if not job_list:
        return []

    for item in job_list:
        if not isinstance(item, Job):
            raise ScheduleError(f"expected Job instance, got {type(item).__name__}")
        if not isinstance(item.id, str) or not item.id:
            raise ScheduleError(f"job id must be a non-empty string, got {item.id!r}")

    ids = [job.id for job in job_list]
    seen: set[str] = set()
    for job_id in ids:
        if job_id in seen:
            raise ScheduleError(f"duplicate job id: {job_id!r}")
        seen.add(job_id)
    id_set = seen

    # Unique dependencies per job; validate names without mutating inputs.
    unique_deps: list[set[str]] = []
    for job in job_list:
        try:
            raw_deps = tuple(job.depends_on)
        except TypeError:
            raise ScheduleError(f"job {job.id!r} has invalid depends_on: {job.depends_on!r}")
        deps: set[str] = set()
        for dep in raw_deps:
            if not isinstance(dep, str) or not dep:
                raise ScheduleError(
                    f"job {job.id!r} has invalid dependency: {dep!r}"
                )
            if dep not in id_set:
                raise ScheduleError(
                    f"job {job.id!r} depends on unknown job {dep!r}"
                )
            deps.add(dep)
        unique_deps.append(deps)

    indegree = [len(deps) for deps in unique_deps]
    index_of = {job.id: i for i, job in enumerate(job_list)}
    dependents: dict[str, list[int]] = {job.id: [] for job in job_list}
    for i, deps in enumerate(unique_deps):
        for dep in deps:
            dependents[dep].append(i)

    # Ready heap ordered by (-priority, input index).
    heap: list[tuple[int, int, str]] = []
    for i, job in enumerate(job_list):
        if indegree[i] == 0:
            heapq.heappush(heap, (-job.priority, i, job.id))

    order: list[str] = []
    while heap:
        _, i, job_id = heapq.heappop(heap)
        order.append(job_id)
        for dep_idx in dependents[job_id]:
            indegree[dep_idx] -= 1
            if indegree[dep_idx] == 0:
                job = job_list[dep_idx]
                heapq.heappush(heap, (-job.priority, dep_idx, job.id))

    if len(order) != len(job_list):
        remaining = sorted(
            (job.id for i, job in enumerate(job_list) if indegree[i] > 0),
            key=lambda jid: index_of[jid],
        )
        raise ScheduleError(
            "dependency cycle detected involving: " + ", ".join(repr(j) for j in remaining)
        )
    return order
