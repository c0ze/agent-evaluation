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


def _find_cycle(
    items: list[Job],
    dep_indices: list[list[int]],
    emitted: list[bool],
) -> list[str]:
    """Return the IDs of one dependency cycle among the unscheduled jobs.

    Every unscheduled job still has at least one unscheduled dependency
    (otherwise Kahn's algorithm would have scheduled it), so repeatedly
    following unscheduled dependencies must eventually revisit a job,
    which closes a cycle.
    """
    leftover = [i for i in range(len(items)) if not emitted[i]]
    deps_of = {
        items[i].id: [items[d].id for d in dep_indices[i] if not emitted[d]]
        for i in leftover
    }
    start = items[leftover[0]].id
    seen = {start}
    path = [start]
    current = start
    while True:
        current = deps_of[current][0]
        if current in seen:
            return path[path.index(current):] + [current]
        path.append(current)
        seen.add(current)


def plan_jobs(jobs: Iterable[Job]) -> list[str]:
    """Return job IDs in a valid, deterministic execution order.

    Every job appears exactly once and never before any of its
    dependencies.  Among the jobs that are currently ready, higher
    ``priority`` is scheduled first; equal priorities fall back to
    original input order.

    Raises :class:`ScheduleError` for invalid input: ids that are not
    non-empty strings, duplicate ids, dependencies naming jobs that were
    not supplied, non-string dependencies, and dependency cycles.  The
    supplied iterable, the jobs, and their dependency lists are never
    mutated.  Empty input yields an empty list.
    """
    try:
        items = list(jobs)
    except TypeError:
        raise ScheduleError(
            f"jobs must be an iterable of Job objects, got {type(jobs).__name__}"
        ) from None

    count = len(items)
    if count == 0:
        return []

    index_by_id: dict = {}
    for i, job in enumerate(items):
        job_id = getattr(job, "id", None)
        if not isinstance(job_id, str) or not job_id:
            raise ScheduleError(
                f"job at index {i} has invalid id {job_id!r}: "
                "ids must be non-empty strings"
            )
        if job_id in index_by_id:
            raise ScheduleError(
                f"duplicate job id {job_id!r} at indices "
                f"{index_by_id[job_id]} and {i}"
            )
        index_by_id[job_id] = i

    dep_indices = []
    for job in items:
        raw = getattr(job, "depends_on", ())
        try:
            deps = list(raw)
        except TypeError:
            raise ScheduleError(
                f"job {job.id!r} has non-iterable depends_on {raw!r}"
            ) from None
        resolved = []
        seen = set()
        for dep in deps:
            if not isinstance(dep, str):
                raise ScheduleError(
                    f"job {job.id!r} has non-string dependency {dep!r}"
                )
            if dep in seen:
                continue
            seen.add(dep)
            if dep not in index_by_id:
                raise ScheduleError(
                    f"job {job.id!r} depends on unknown job {dep!r}"
                )
            resolved.append(index_by_id[dep])
        dep_indices.append(resolved)

    indegree = [len(deps) for deps in dep_indices]
    dependents = [[] for _ in range(count)]
    for i, deps in enumerate(dep_indices):
        for dep in deps:
            dependents[dep].append(i)

    ready = [
        (-getattr(job, "priority", 0), i)
        for i, job in enumerate(items)
        if indegree[i] == 0
    ]
    heapq.heapify(ready)

    order = []
    emitted = [False] * count
    while ready:
        _, i = heapq.heappop(ready)
        emitted[i] = True
        order.append(items[i].id)
        for dependent in dependents[i]:
            indegree[dependent] -= 1
            if indegree[dependent] == 0:
                heapq.heappush(
                    ready,
                    (-getattr(items[dependent], "priority", 0), dependent),
                )

    if len(order) != count:
        cycle = _find_cycle(items, dep_indices, emitted)
        unscheduled = count - len(order)
        raise ScheduleError(
            f"dependency cycle detected: {' -> '.join(cycle)} "
            f"({unscheduled} job(s) unschedulable)"
        )

    return order