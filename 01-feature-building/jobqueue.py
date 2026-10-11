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


def plan_jobs(jobs: Iterable[Job]) -> list[str]:
    """Return job IDs in a valid deterministic execution order."""
    job_list = list(jobs)

    index_of: dict[str, int] = {}
    for index, job in enumerate(job_list):
        jid = job.id
        if not isinstance(jid, str) or not jid:
            raise ScheduleError(
                f"job at index {index} has invalid id {jid!r}: "
                "ids must be non-empty strings"
            )
        if jid in index_of:
            raise ScheduleError(
                f"duplicate job id {jid!r} at indexes {index_of[jid]} and {index}"
            )
        index_of[jid] = index

    pending: dict[str, int] = {}
    dependents: dict[str, list[str]] = {jid: [] for jid in index_of}
    for job in job_list:
        unique_deps = list(dict.fromkeys(job.depends_on or ()))
        for dep in unique_deps:
            if not isinstance(dep, str) or dep not in index_of:
                raise ScheduleError(
                    f"job {job.id!r} depends on unknown job {dep!r}"
                )
        pending[job.id] = len(unique_deps)
        for dep in unique_deps:
            dependents[dep].append(job.id)

    ready: list[tuple[int, int, str]] = []
    for job in job_list:
        if pending[job.id] == 0:
            heappush(ready, (-job.priority, index_of[job.id], job.id))

    order: list[str] = []
    while ready:
        _, _, jid = heappop(ready)
        order.append(jid)
        for dependent in dependents[jid]:
            pending[dependent] -= 1
            if pending[dependent] == 0:
                dependent_job = job_list[index_of[dependent]]
                heappush(
                    ready,
                    (-dependent_job.priority, index_of[dependent], dependent),
                )

    if len(order) != len(job_list):
        placed = set(order)
        unresolved = [jid for jid in pending if jid not in placed]
        cycle = _find_cycle(job_list, set(unresolved))
        detail = " -> ".join(cycle) if cycle else ", ".join(unresolved)
        raise ScheduleError(f"dependency cycle detected: {detail}")
    return order


def _find_cycle(job_list: list[Job], unresolved: set[str]) -> list[str]:
    deps: dict[str, list[str]] = {}
    for job in job_list:
        if job.id in unresolved:
            deps[job.id] = [
                dep
                for dep in dict.fromkeys(job.depends_on or ())
                if dep in unresolved
            ]

    WHITE, GRAY, BLACK = 0, 1, 2
    color: dict[str, int] = {jid: WHITE for jid in deps}
    for start in deps:
        if color[start] != WHITE:
            continue
        color[start] = GRAY
        path = [start]
        stack = [iter(deps[start])]
        while stack:
            advanced = False
            for nxt in stack[-1]:
                if color[nxt] == GRAY:
                    return path[path.index(nxt) :] + [nxt]
                if color[nxt] == WHITE:
                    color[nxt] = GRAY
                    path.append(nxt)
                    stack.append(iter(deps[nxt]))
                    advanced = True
                    break
            if not advanced:
                color[path.pop()] = BLACK
                stack.pop()
    return []
