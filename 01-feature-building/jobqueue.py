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


def _find_cyclic_sccs(
    nodes: list[str], deps_by_id: dict[str, tuple[str, ...]]
) -> list[list[str]]:
    """Return all strongly connected components that contain at least one cycle."""
    remaining = set(nodes)
    index_counter = 0
    indices: dict[str, int] = {}
    lowlink: dict[str, int] = {}
    on_stack: set[str] = set()
    stack: list[str] = []
    neighbors_cache: dict[str, list[str]] = {}
    cyclic_sccs: list[list[str]] = []

    for start in nodes:
        if start in indices:
            continue

        indices[start] = lowlink[start] = index_counter
        index_counter += 1
        stack.append(start)
        on_stack.add(start)
        neighbors_cache[start] = [d for d in deps_by_id[start] if d in remaining]
        call_stack: list[tuple[str, int]] = [(start, 0)]

        while call_stack:
            u, ni = call_stack[-1]
            nbrs = neighbors_cache[u]
            if ni < len(nbrs):
                call_stack[-1] = (u, ni + 1)
                v = nbrs[ni]
                if v not in indices:
                    indices[v] = lowlink[v] = index_counter
                    index_counter += 1
                    stack.append(v)
                    on_stack.add(v)
                    neighbors_cache[v] = [d for d in deps_by_id[v] if d in remaining]
                    call_stack.append((v, 0))
                elif v in on_stack and indices[v] < lowlink[u]:
                    lowlink[u] = indices[v]
            else:
                call_stack.pop()
                if call_stack:
                    parent = call_stack[-1][0]
                    if lowlink[u] < lowlink[parent]:
                        lowlink[parent] = lowlink[u]
                if lowlink[u] == indices[u]:
                    scc: list[str] = []
                    while True:
                        w = stack.pop()
                        on_stack.remove(w)
                        scc.append(w)
                        if w == u:
                            break
                    if len(scc) > 1 or u in neighbors_cache[u]:
                        cyclic_sccs.append(scc)

    return cyclic_sccs


def _extract_cycle(
    start: str, scc_set: set[str], deps_by_id: dict[str, tuple[str, ...]]
) -> list[str]:
    """Trace a directed cycle starting from a node within a cyclic SCC."""
    path: list[str] = []
    pos: dict[str, int] = {}
    curr = start
    while curr not in pos:
        pos[curr] = len(path)
        path.append(curr)
        curr = next(d for d in deps_by_id[curr] if d in scc_set)
    return path[pos[curr] :] + [curr]


def _format_cycle_error(
    remaining_nodes: list[str],
    deps_by_id: dict[str, tuple[str, ...]],
    index_by_id: dict[str, int],
) -> str:
    """Build a deterministic diagnostic listing the job IDs involved in cycles."""
    cyclic_sccs = _find_cyclic_sccs(remaining_nodes, deps_by_id)
    ordered_sccs = sorted(
        (sorted(scc, key=index_by_id.__getitem__) for scc in cyclic_sccs),
        key=lambda scc: index_by_id[scc[0]],
    )
    descriptions: list[str] = []
    for scc in ordered_sccs:
        scc_set = set(scc)
        cycle = _extract_cycle(scc[0], scc_set, deps_by_id)
        cycle_str = " -> ".join(cycle)
        if len(cycle) - 1 == len(scc):
            descriptions.append(cycle_str)
        else:
            descriptions.append(f"{cycle_str} (cycle group: {', '.join(scc)})")
    return f"Dependency cycle detected: {'; '.join(descriptions)}"


def plan_jobs(jobs: Iterable[Job]) -> list[str]:
    """Return job IDs in a valid deterministic execution order."""
    if isinstance(jobs, (str, bytes)):
        raise ScheduleError("jobs must be an iterable of Job instances, not str or bytes")
    try:
        job_list = list(jobs)
    except TypeError as exc:
        raise ScheduleError("jobs must be an iterable of Job instances") from exc

    if not job_list:
        return []

    index_by_id: dict[str, int] = {}
    priority_by_id: dict[str, int | float] = {}
    raw_deps_by_id: dict[str, tuple[str, ...]] = {}

    for idx, job in enumerate(job_list):
        if not isinstance(job, Job):
            raise ScheduleError(
                f"Expected Job instance at index {idx}, got {type(job).__name__}"
            )
        if not isinstance(job.id, str) or not job.id:
            raise ScheduleError(f"Job ID must be a non-empty string, got {job.id!r}")
        if job.id in index_by_id:
            raise ScheduleError(f"Duplicate job ID: {job.id!r}")
        if (
            isinstance(job.priority, bool)
            or not isinstance(job.priority, (int, float))
            or math.isnan(job.priority)
        ):
            raise ScheduleError(
                f"Job {job.id!r} has invalid priority: {job.priority!r}"
            )
        if isinstance(job.depends_on, (str, bytes)):
            raise ScheduleError(
                f"Job {job.id!r} depends_on must be an iterable of job IDs, not str or bytes"
            )
        try:
            deps_tuple = tuple(job.depends_on)
        except TypeError as exc:
            raise ScheduleError(
                f"Job {job.id!r} depends_on must be an iterable of job IDs"
            ) from exc

        index_by_id[job.id] = idx
        priority_by_id[job.id] = job.priority
        raw_deps_by_id[job.id] = deps_tuple

    in_degree: dict[str, int] = {}
    deps_by_id: dict[str, tuple[str, ...]] = {}
    dependents: dict[str, list[str]] = {job.id: [] for job in job_list}

    for job in job_list:
        seen_deps: set[str] = set()
        unique_deps: list[str] = []
        for dep in raw_deps_by_id[job.id]:
            if not isinstance(dep, str) or not dep:
                raise ScheduleError(
                    f"Job {job.id!r} has invalid dependency: {dep!r}"
                )
            if dep not in index_by_id:
                raise ScheduleError(
                    f"Job {job.id!r} depends on unknown job {dep!r}"
                )
            if dep not in seen_deps:
                seen_deps.add(dep)
                unique_deps.append(dep)
                dependents[dep].append(job.id)
        deps_by_id[job.id] = tuple(unique_deps)
        in_degree[job.id] = len(unique_deps)

    ready: list[tuple[int | float, int, str]] = [
        (-priority_by_id[job.id], idx, job.id)
        for idx, job in enumerate(job_list)
        if in_degree[job.id] == 0
    ]
    heapq.heapify(ready)

    order: list[str] = []
    while ready:
        _, _, current_id = heapq.heappop(ready)
        order.append(current_id)
        for dependent_id in dependents[current_id]:
            in_degree[dependent_id] -= 1
            if in_degree[dependent_id] == 0:
                heapq.heappush(
                    ready,
                    (
                        -priority_by_id[dependent_id],
                        index_by_id[dependent_id],
                        dependent_id,
                    ),
                )

    if len(order) != len(job_list):
        remaining_nodes = [job.id for job in job_list if in_degree[job.id] > 0]
        raise ScheduleError(
            _format_cycle_error(remaining_nodes, deps_by_id, index_by_id)
        )

    return order

