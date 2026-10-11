from dataclasses import dataclass, field
from typing import Any, Iterable
import heapq


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
    job_list = list(jobs)

    seen = set()
    for job in job_list:
        if not isinstance(job.id, str) or job.id == "":
            raise ScheduleError(f"job id must be a non-empty string, got {job.id!r}")
        if job.id in seen:
            raise ScheduleError(f"duplicate job id: {job.id!r}")
        seen.add(job.id)

    id_to_index = {job.id: i for i, job in enumerate(job_list)}

    for job in job_list:
        for dep in job.depends_on:
            if dep not in id_to_index:
                raise ScheduleError(
                    f"job {job.id!r} depends on unknown job {dep!r}"
                )

    dependents = {job.id: [] for job in job_list}
    indegree = {job.id: 0 for job in job_list}
    for job in job_list:
        for dep in job.depends_on:
            dependents[dep].append(job.id)
            indegree[job.id] += 1

    heap = []
    for i, job in enumerate(job_list):
        if indegree[job.id] == 0:
            heapq.heappush(heap, (-job.priority, i, job.id))

    result = []
    while heap:
        _, _, job_id = heapq.heappop(heap)
        result.append(job_id)
        for nxt in dependents[job_id]:
            indegree[nxt] -= 1
            if indegree[nxt] == 0:
                i = id_to_index[nxt]
                heapq.heappush(heap, (-job_list[i].priority, i, nxt))

    if len(result) != len(job_list):
        cycle_ids = sorted(job_id for job_id, d in indegree.items() if d > 0)
        raise ScheduleError(
            f"dependency cycle detected involving: {', '.join(cycle_ids)}"
        )

    return result
