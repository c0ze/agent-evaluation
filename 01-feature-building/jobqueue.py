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
    jobs_list = list(jobs)
    
    if not jobs_list:
        return []
    
    job_ids = set()
    for job in jobs_list:
        if not isinstance(job.id, str) or not job.id:
            raise ScheduleError(f"Invalid job ID: {job.id!r}")
        if job.id in job_ids:
            raise ScheduleError(f"Duplicate job ID: {job.id!r}")
        job_ids.add(job.id)
    
    for job in jobs_list:
        for dep in job.depends_on:
            if dep not in job_ids:
                raise ScheduleError(f"Job {job.id!r} depends on unknown job {dep!r}")
    
    in_degree = {job.id: len(job.depends_on) for job in jobs_list}
    adjacency = {job.id: [] for job in jobs_list}
    
    for job in jobs_list:
        for dep in job.depends_on:
            adjacency[dep].append(job.id)
    
    job_index = {job.id: idx for idx, job in enumerate(jobs_list)}
    job_priority = {job.id: job.priority for job in jobs_list}
    
    ready = []
    for job_id, deg in in_degree.items():
        if deg == 0:
            heapq.heappush(ready, (-job_priority[job_id], job_index[job_id], job_id))
    
    result = []
    
    while ready:
        _, _, job_id = heapq.heappop(ready)
        result.append(job_id)
        
        for successor in adjacency[job_id]:
            in_degree[successor] -= 1
            if in_degree[successor] == 0:
                heapq.heappush(ready, (-job_priority[successor], job_index[successor], successor))
    
    if len(result) != len(jobs_list):
        remaining = [job_id for job_id in job_ids if job_id not in result]
        raise ScheduleError(f"Dependency cycle detected involving: {', '.join(remaining)}")
    
    return result

