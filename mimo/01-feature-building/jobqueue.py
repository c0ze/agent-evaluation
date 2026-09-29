from __future__ import annotations

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

    Among ready jobs, higher ``priority`` runs first; ties keep input order.
    """
    job_list = list(jobs)
    if not job_list:
        return []

    by_id: dict[str, Job] = {}
    input_index: dict[str, int] = {}
    for index, job in enumerate(job_list):
        job_id = job.id
        if not isinstance(job_id, str) or not job_id:
            raise ScheduleError(f"job id must be a non-empty string, got {job_id!r}")
        if job_id in by_id:
            raise ScheduleError(f"duplicate job id: {job_id!r}")
        by_id[job_id] = job
        input_index[job_id] = index

    # dependents[d] = jobs that list d as a dependency; remaining counts unmet deps.
    dependents: dict[str, list[str]] = {job_id: [] for job_id in by_id}
    remaining: dict[str, int] = {job_id: 0 for job_id in by_id}

    for job in job_list:
        # Copy so a caller-supplied mutable sequence is never touched.
        seen: set[str] = set()
        for dep in tuple(job.depends_on):
            if dep not in by_id:
                raise ScheduleError(f"job {job.id!r} depends on unknown job {dep!r}")
            if dep in seen:
                continue
            seen.add(dep)
            dependents[dep].append(job.id)
            remaining[job.id] += 1

    # Kahn's algorithm; ready set ordered by (-priority, input_index, id).
    ready: list[tuple[int, int, str]] = []
    for job_id, unmet in remaining.items():
        if unmet == 0:
            job = by_id[job_id]
            heapq.heappush(ready, (-job.priority, input_index[job_id], job_id))

    order: list[str] = []
    while ready:
        _, _, job_id = heapq.heappop(ready)
        order.append(job_id)
        for dependent in dependents[job_id]:
            remaining[dependent] -= 1
            if remaining[dependent] == 0:
                job = by_id[dependent]
                heapq.heappush(
                    ready, (-job.priority, input_index[dependent], dependent)
                )

    if len(order) != len(by_id):
        stuck = sorted(job_id for job_id, unmet in remaining.items() if unmet > 0)
        cycle = _find_cycle(stuck, by_id)
        detail = " -> ".join(cycle) if cycle else ", ".join(stuck)
        raise ScheduleError(
            f"dependency cycle detected: {detail}"
            f" (unresolvable jobs: {', '.join(stuck)})"
        )

    return order


def _find_cycle(stuck: list[str], by_id: dict[str, Job]) -> list[str]:
    """Return one dependency cycle as [id, ..., id], or [] if none found."""
    stuck_set = set(stuck)
    color = dict.fromkeys(stuck, 0)  # 0=unvisited, 1=on stack, 2=done

    def dfs(node: str, path: list[str]) -> list[str]:
        color[node] = 1
        path.append(node)
        for dep in dict.fromkeys(by_id[node].depends_on):
            if dep not in stuck_set:
                continue
            if color[dep] == 1:
                start = path.index(dep)
                return path[start:]
            if color[dep] == 0:
                found = dfs(dep, path)
                if found:
                    return found
        path.pop()
        color[node] = 2
        return []

    for job_id in stuck:
        if color[job_id] == 0:
            found = dfs(job_id, [])
            if found:
                return found
    return []
