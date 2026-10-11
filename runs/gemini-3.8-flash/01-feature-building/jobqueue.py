from collections.abc import Iterable
from dataclasses import dataclass, field
import heapq
import math
from typing import Any


class ScheduleError(ValueError):
    pass


@dataclass(frozen=True)
class Job:
    id: str
    priority: int = 0
    depends_on: tuple[str, ...] = field(default_factory=tuple)
    payload: Any = None


def _find_cycle(remaining_ids: set[str], jobs_by_id: dict[str, Job]) -> list[str] | None:
    """Find a directed dependency cycle among remaining unscheduled jobs."""
    state: dict[str, int] = {job_id: 0 for job_id in remaining_ids}
    path: list[str] = []

    def dfs(node: str) -> list[str] | None:
        state[node] = 1
        path.append(node)
        for dep in jobs_by_id[node].depends_on:
            if dep not in remaining_ids:
                continue
            if state[dep] == 1:
                cycle_start = path.index(dep)
                return path[cycle_start:] + [dep]
            if state[dep] == 0:
                cycle = dfs(dep)
                if cycle is not None:
                    return cycle
        path.pop()
        state[node] = 2
        return None

    for start_node in sorted(remaining_ids):
        if state[start_node] == 0:
            cycle = dfs(start_node)
            if cycle is not None:
                return cycle
    return None


def plan_jobs(jobs: Iterable[Job]) -> list[str]:
    """Return job IDs in a valid deterministic execution order.

    Jobs are executed after all their dependencies have run.
    Among currently ready jobs, higher priority runs first;
    ties are broken by original input order.
    """
    if jobs is None or not isinstance(jobs, Iterable):
        raise ScheduleError(
            f"jobs must be an iterable of Job instances, got {type(jobs).__name__}"
        )

    job_list = list(jobs)
    if not job_list:
        return []

    jobs_by_id: dict[str, Job] = {}
    job_indices: dict[str, int] = {}

    for index, job in enumerate(job_list):
        if not isinstance(job, Job) and not (
            hasattr(job, "id") and hasattr(job, "priority") and hasattr(job, "depends_on")
        ):
            raise ScheduleError(f"Expected Job instance, got {type(job).__name__}")

        if not isinstance(job.id, str) or not job.id:
            raise ScheduleError(
                f"Job id must be a non-empty string, got {job.id!r}"
            )

        if job.id in jobs_by_id:
            raise ScheduleError(f"Duplicate job ID: {job.id!r}")

        if (
            isinstance(job.priority, bool)
            or not isinstance(job.priority, (int, float))
            or (isinstance(job.priority, float) and math.isnan(job.priority))
        ):
            raise ScheduleError(
                f"Job {job.id!r} has invalid priority: {job.priority!r}"
            )

        if (
            job.depends_on is None
            or isinstance(job.depends_on, (str, bytes))
            or not isinstance(job.depends_on, Iterable)
        ):
            raise ScheduleError(
                f"Job {job.id!r} depends_on must be an iterable of job ID strings"
            )

        jobs_by_id[job.id] = job
        job_indices[job.id] = index

    # Validate all dependencies exist and are valid non-empty strings
    dependents: dict[str, list[str]] = {job.id: [] for job in job_list}
    in_degree: dict[str, int] = {job.id: 0 for job in job_list}

    for job in job_list:
        unique_deps: set[str] = set()
        for dep in job.depends_on:
            if not isinstance(dep, str) or not dep:
                raise ScheduleError(
                    f"Job {job.id!r} has invalid dependency ID: {dep!r} (must be a non-empty string)"
                )
            if dep not in jobs_by_id:
                raise ScheduleError(
                    f"Job {job.id!r} depends on unknown job {dep!r}"
                )
            unique_deps.add(dep)

        in_degree[job.id] = len(unique_deps)
        for dep in unique_deps:
            dependents[dep].append(job.id)

    # Kahn's algorithm using priority queue
    # Heap stores: (-priority, original_index, job_id)
    ready_heap: list[tuple[float | int, int, str]] = []
    for index, job in enumerate(job_list):
        if in_degree[job.id] == 0:
            heapq.heappush(ready_heap, (-job.priority, index, job.id))

    scheduled: list[str] = []
    while ready_heap:
        _, _, job_id = heapq.heappop(ready_heap)
        scheduled.append(job_id)

        for succ_id in dependents[job_id]:
            in_degree[succ_id] -= 1
            if in_degree[succ_id] == 0:
                succ_job = jobs_by_id[succ_id]
                heapq.heappush(
                    ready_heap,
                    (-succ_job.priority, job_indices[succ_id], succ_id),
                )

    if len(scheduled) < len(job_list):
        remaining_ids = set(jobs_by_id.keys()) - set(scheduled)
        cycle = _find_cycle(remaining_ids, jobs_by_id)
        if cycle:
            cycle_nodes = sorted(set(cycle))
            cycle_str = " -> ".join(cycle)
            raise ScheduleError(
                f"Dependency cycle detected involving jobs {cycle_nodes}: {cycle_str}"
            )
        else:
            raise ScheduleError(
                f"Dependency cycle detected involving jobs: {sorted(remaining_ids)}"
            )

    return scheduled
