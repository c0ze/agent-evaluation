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


def _find_cycle(deps: dict[str, list[str]]) -> list[str] | None:
    """Return one dependency cycle as [a, b, ..., a], or None if acyclic."""
    WHITE, GRAY, BLACK = 0, 1, 2
    color = {node: WHITE for node in deps}

    for start in deps:
        if color[start] != WHITE:
            continue
        color[start] = GRAY
        path = [start]
        stack = [(start, iter(deps[start]))]
        while stack:
            node, children = stack[-1]
            child = next(children, None)
            if child is None:
                color[node] = BLACK
                stack.pop()
                path.pop()
                continue
            if color[child] == GRAY:
                return path[path.index(child):] + [child]
            if color[child] == WHITE:
                color[child] = GRAY
                path.append(child)
                stack.append((child, iter(deps[child])))
    return None


def plan_jobs(jobs: Iterable[Job]) -> list[str]:
    """Return job IDs in a valid deterministic execution order.

    Validation is performed up front: IDs must be non-empty and unique, and
    every dependency must name a supplied job. Invalid input and cycles raise
    :class:`ScheduleError`.

    Ordering is a topological sort (Kahn's algorithm) where, among the jobs
    that are currently ready, the highest priority is chosen first and equal
    priorities are broken by original input order.
    """
    job_list = list(jobs)
    if not job_list:
        return []

    # Validate IDs and build the index used for input-order tie-breaking.
    index: dict[str, int] = {}
    for position, job in enumerate(job_list):
        job_id = job.id
        if not isinstance(job_id, str) or not job_id.strip():
            raise ScheduleError(
                f"job id must be a non-empty string, got {job_id!r} "
                f"at input position {position}"
            )
        if job_id in index:
            raise ScheduleError(f"duplicate job id: {job_id!r}")
        index[job_id] = position

    id_set = set(index)

    # Build a dependency map with duplicates removed; never touch the jobs.
    deps: dict[str, list[str]] = {}
    for job in job_list:
        unique_deps: list[str] = []
        seen: set[str] = set()
        for dep in job.depends_on:
            if dep not in id_set:
                raise ScheduleError(
                    f"job {job.id!r} depends on unknown job {dep!r}"
                )
            if dep not in seen:
                seen.add(dep)
                unique_deps.append(dep)
        deps[job.id] = unique_deps

    indegree = {job_id: len(unique_deps) for job_id, unique_deps in deps.items()}
    dependents: dict[str, list[str]] = {job_id: [] for job_id in deps}
    for job_id, unique_deps in deps.items():
        for dep in unique_deps:
            dependents[dep].append(job_id)

    ready: list[tuple[int, int, str]] = []
    for job in job_list:
        if indegree[job.id] == 0:
            heappush(ready, (-job.priority, index[job.id], job.id))

    result: list[str] = []
    while ready:
        _, _, job_id = heappop(ready)
        result.append(job_id)
        for dependent in dependents[job_id]:
            indegree[dependent] -= 1
            if indegree[dependent] == 0:
                heappush(
                    ready,
                    (-job_list[index[dependent]].priority, index[dependent], dependent),
                )

    if len(result) != len(job_list):
        cycle = _find_cycle(deps)
        detail = " -> ".join(cycle) if cycle else ", ".join(
            job_id for job_id in job_list if indegree[job_id] > 0
        )
        raise ScheduleError(f"dependency cycle detected: {detail}")

    return result
