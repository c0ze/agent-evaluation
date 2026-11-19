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


def _collect_jobs(jobs: Iterable[Job]) -> list[Job]:
    """Materialize the input and validate job IDs.

    The input is consumed exactly once, so generators are supported and the
    caller's container is never mutated.
    """
    ordered = list(jobs)
    seen: set[str] = set()
    for position, job in enumerate(ordered):
        job_id = getattr(job, "id", None)
        if not isinstance(job_id, str) or not job_id:
            raise ScheduleError(
                f"job at position {position} has an invalid id {job_id!r}; "
                "ids must be non-empty strings"
            )
        if job_id in seen:
            raise ScheduleError(f"duplicate job id {job_id!r}")
        seen.add(job_id)
    return ordered


def _unique_dependencies(job: Job, known: set[str]) -> tuple[str, ...]:
    """Validate a job's dependencies and return them without duplicates."""
    raw = getattr(job, "depends_on", ())
    if isinstance(raw, str):
        # A bare string would otherwise be iterated character by character.
        raise ScheduleError(
            f"job {job.id!r} has a string as depends_on; "
            "expected an iterable of job IDs"
        )
    unique: list[str] = []
    seen: set[str] = set()
    for dep in raw:
        if not isinstance(dep, str):
            raise ScheduleError(
                f"job {job.id!r} depends on non-string value {dep!r}"
            )
        if dep not in known:
            raise ScheduleError(
                f"job {job.id!r} depends on unknown job {dep!r}"
            )
        if dep not in seen:
            seen.add(dep)
            unique.append(dep)
    return tuple(unique)


def _find_cycle(
    remaining: list[str], dependencies: dict[str, tuple[str, ...]]
) -> list[str]:
    """Return one concrete cycle among ``remaining``, or ``[]`` if none exists.

    ``remaining`` preserves input order so the diagnostic is deterministic.
    """
    remaining_set = set(remaining)
    # 0 = unvisited, 1 = on the current path, 2 = fully explored.
    state: dict[str, int] = {}
    for start in remaining:
        if state.get(start, 0) != 0:
            continue
        state[start] = 1
        path = [start]
        stack = [iter(dependencies[start])]
        while stack:
            for dep in stack[-1]:
                if dep not in remaining_set:
                    continue
                dep_state = state.get(dep, 0)
                if dep_state == 1:
                    return path[path.index(dep):] + [dep]
                if dep_state == 0:
                    state[dep] = 1
                    path.append(dep)
                    stack.append(iter(dependencies[dep]))
                    break
            else:
                state[path[-1]] = 2
                path.pop()
                stack.pop()
    return []


def plan_jobs(jobs: Iterable[Job]) -> list[str]:
    """Return job IDs in a valid deterministic execution order.

    Ready jobs are scheduled highest priority first; ties keep the original
    input order. Raises ``ScheduleError`` for invalid ids, unknown
    dependencies, or dependency cycles.
    """
    ordered = _collect_jobs(jobs)
    known = {job.id for job in ordered}
    position = {job.id: index for index, job in enumerate(ordered)}
    priority = {job.id: job.priority for job in ordered}

    dependencies: dict[str, tuple[str, ...]] = {}
    dependents: dict[str, list[str]] = {job.id: [] for job in ordered}
    indegree: dict[str, int] = {}
    for job in ordered:
        deps = _unique_dependencies(job, known)
        dependencies[job.id] = deps
        indegree[job.id] = len(deps)
        for dep in deps:
            dependents[dep].append(job.id)

    # (-priority, input index, id): higher priority first, then input order.
    ready: list[tuple[int, int, str]] = [
        (-priority[job.id], position[job.id], job.id)
        for job in ordered
        if indegree[job.id] == 0
    ]
    heapq.heapify(ready)

    order: list[str] = []
    while ready:
        _, _, job_id = heapq.heappop(ready)
        order.append(job_id)
        for child in dependents[job_id]:
            indegree[child] -= 1
            if indegree[child] == 0:
                heapq.heappush(
                    ready, (-priority[child], position[child], child)
                )

    if len(order) != len(ordered):
        scheduled = set(order)
        remaining = [job.id for job in ordered if job.id not in scheduled]
        cycle = _find_cycle(remaining, dependencies)
        if cycle:
            raise ScheduleError(
                "dependency cycle detected: " + " -> ".join(cycle)
            )
        raise ScheduleError(
            "dependency cycle detected among jobs: " + ", ".join(remaining)
        )

    return order
