from collections.abc import Iterable
from dataclasses import dataclass, field
from heapq import heappop, heappush
from numbers import Real
from typing import Any

__all__ = ["Job", "ScheduleError", "plan_jobs"]


class ScheduleError(ValueError):
    pass


@dataclass(frozen=True)
class Job:
    id: str
    priority: int = 0
    depends_on: tuple[str, ...] = field(default_factory=tuple)
    payload: Any = None


def _check_id(job_id: Any, index: int | None = None) -> str:
    where = f" (job at index {index})" if index is not None else ""
    if not isinstance(job_id, str):
        raise ScheduleError(
            f"job id must be a non-empty string{where}, got {type(job_id).__name__}: {job_id!r}"
        )
    if not job_id:
        raise ScheduleError(f"job id must be a non-empty string{where}, got empty string")
    return job_id


def _check_priority(job_id: str, priority: Any) -> None:
    if isinstance(priority, bool) or not isinstance(priority, Real):
        raise ScheduleError(
            f"job {job_id!r} has a non-numeric priority: {priority!r}"
        )


def _find_cycle(start: str, deps: dict[str, tuple[str, ...]]) -> list[str]:
    """Return one cycle reachable from ``start``, e.g. ``["a", "b", "a"]``."""
    on_path: list[str] = []
    on_path_set: set[str] = set()
    visited: set[str] = set()
    stack: list[tuple[str, int]] = [(start, 0)]

    while stack:
        node, cursor = stack[-1]
        if cursor == 0:
            on_path.append(node)
            on_path_set.add(node)
            visited.add(node)
        neighbors = deps[node]
        if cursor == len(neighbors):
            stack.pop()
            on_path.pop()
            on_path_set.discard(node)
            continue
        stack[-1] = (node, cursor + 1)
        dep = neighbors[cursor]
        if dep in on_path_set:
            return on_path[on_path.index(dep):] + [dep]
        if dep not in visited:
            stack.append((dep, 0))

    return [start]


def plan_jobs(jobs: Iterable[Job]) -> list[str]:
    """Return job IDs in a valid deterministic execution order.

    Jobs are returned exactly once, always after every job they depend on.
    Whenever several jobs are ready at the same time the highest ``priority``
    wins; ties are broken by original input order.

    Raises:
        ScheduleError: if an id is invalid or duplicated, a dependency names an
            unknown or invalid job, a priority is not a number, or the
            dependencies contain a cycle.
    """
    jobs = list(jobs)

    ids: list[str] = []
    seen: set[str] = set()
    deps: dict[str, tuple[str, ...]] = {}
    dependents: dict[str, list[str]] = {}
    priorities: dict[str, Real] = {}

    for index, job in enumerate(jobs):
        try:
            job_id = job.id
            priority = job.priority
            raw_deps = job.depends_on
        except AttributeError as exc:
            raise ScheduleError(
                f"expected a Job instance at index {index}, got {type(job).__name__}"
            ) from exc

        job_id = _check_id(job_id, index)
        _check_priority(job_id, priority)

        if job_id in seen:
            raise ScheduleError(f"duplicate job id: {job_id!r}")
        seen.add(job_id)
        ids.append(job_id)
        priorities[job_id] = priority

        if raw_deps is None:
            cleaned: tuple[str, ...] = ()
        elif isinstance(raw_deps, str) or not isinstance(raw_deps, Iterable):
            raise ScheduleError(
                f"job {job_id!r} has non-iterable depends_on: {raw_deps!r}"
            )
        else:
            unique_deps: list[str] = []
            for dep in raw_deps:
                _check_id(dep)
                if dep not in unique_deps:
                    unique_deps.append(dep)
            cleaned = tuple(unique_deps)

        deps[job_id] = cleaned
        dependents.setdefault(job_id, [])

    for job_id in ids:
        for dep in deps[job_id]:
            if dep not in seen:
                raise ScheduleError(
                    f"job {job_id!r} depends on unknown job {dep!r}"
                )
            dependents[dep].append(job_id)

    input_order = {job_id: order for order, job_id in enumerate(ids)}
    remaining = {job_id: len(deps[job_id]) for job_id in ids}
    ready: list[tuple[float | int, int, str]] = []
    for job_id in ids:
        if remaining[job_id] == 0:
            heappush(ready, (-priorities[job_id], input_order[job_id], job_id))

    scheduled: list[str] = []
    position: dict[str, int] = {}
    while ready:
        _, _, job_id = heappop(ready)
        position[job_id] = len(scheduled)
        scheduled.append(job_id)
        for dependent in dependents[job_id]:
            remaining[dependent] -= 1
            if remaining[dependent] == 0:
                heappush(ready, (-priorities[dependent], input_order[dependent], dependent))

    if len(scheduled) != len(ids):
        stuck = sorted(job_id for job_id in ids if job_id not in position)
        cycle = _find_cycle(stuck[0], deps)
        raise ScheduleError(
            "dependency cycle detected: "
            + " -> ".join(cycle)
            + f" (unschedulable jobs: {', '.join(stuck)})"
        )

    return scheduled
