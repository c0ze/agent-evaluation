"""Dependency-aware, deterministic job scheduling (standard library only).

The public surface is :class:`Job`, :class:`ScheduleError` and :func:`plan_jobs`.
"""

from collections.abc import Iterable
from dataclasses import dataclass, field
import heapq
from typing import Any


class ScheduleError(ValueError):
    pass


@dataclass(frozen=True)
class Job:
    id: str
    priority: int = 0
    depends_on: tuple[str, ...] = field(default_factory=tuple)
    payload: Any = None


_WHITE = 0
_GREY = 1
_BLACK = 2


def _describe_cycle(cycle: list[str]) -> str:
    return " -> ".join(cycle)


def _find_cycle(blocked: set[str], depends: dict[str, tuple[str, ...]]) -> list[str] | None:
    """Return one concrete cycle among `blocked`, or ``None``.

    Only dependencies that are themselves still blocked can close a loop, so
    already-scheduled dependencies are skipped. The walk is iterative on
    purpose: a deep dependency chain must not exhaust the interpreter stack.
    """
    color = {job_id: _WHITE for job_id in blocked}
    for root in blocked:
        if color[root] != _WHITE:
            continue
        color[root] = _GREY
        path: list[str] = [root]
        frames = [iter(dep for dep in depends[root] if dep in blocked)]
        while frames:
            advanced = False
            for dep in frames[-1]:
                state = color[dep]
                if state == _GREY:
                    return path[path.index(dep):] + [dep]
                if state == _WHITE:
                    color[dep] = _GREY
                    path.append(dep)
                    frames.append(iter(d for d in depends[dep] if d in blocked))
                    advanced = True
                    break
            if not advanced:
                frames.pop()
                color[path.pop()] = _BLACK
    return None


def plan_jobs(jobs: Iterable[Job]) -> list[str]:
    """Return job IDs in a valid deterministic execution order.

    A job is emitted only after every job it depends on, and among the jobs
    that are ready at any moment the highest ``priority`` goes first, with
    equal priorities resolved by original input order. ``ScheduleError`` is
    raised for malformed input (bad or duplicated ids, unknown dependencies)
    and for dependency cycles. The supplied jobs are never mutated.
    """
    try:
        materialised = list(jobs)
    except TypeError:
        raise ScheduleError(f"jobs must be an iterable of Job instances, got {jobs!r}") from None

    if not materialised:
        return []

    # Pass 1 -- index every job and reject malformed or duplicated entries.
    ids: list[str] = []
    position: dict[str, int] = {}
    priority: dict[str, float] = {}
    depends: dict[str, tuple[str, ...]] = {}

    for index, job in enumerate(materialised):
        if not isinstance(job, Job):
            raise ScheduleError(f"item at position {index} is not a Job: {job!r}")

        job_id = job.id
        if not isinstance(job_id, str):
            raise ScheduleError(
                f"job at position {index} has a non-string id: {job_id!r}"
            )
        if not job_id.strip():
            raise ScheduleError(
                f"job at position {index} has a blank id; job ids must be non-empty strings"
            )
        if job_id in position:
            raise ScheduleError(
                f"duplicate job id: {job_id!r} appears at positions "
                f"{position[job_id]} and {index}; job ids must be unique"
            )
        if not isinstance(job.priority, (int, float)):
            raise ScheduleError(
                f"job {job_id!r} has a non-numeric priority: {job.priority!r}"
            )

        raw_deps = job.depends_on
        if isinstance(raw_deps, str) or not isinstance(raw_deps, Iterable):
            raise ScheduleError(
                f"job {job_id!r} has an invalid depends_on: {raw_deps!r}; "
                "expected an iterable of job id strings"
            )
        # Deduplicate while preserving order so a repeated dependency does not
        # inflate the dependency count and stall the job forever.
        unique_deps: list[str] = []
        seen: set[str] = set()
        for dep in raw_deps:
            if not isinstance(dep, str) or not dep:
                raise ScheduleError(
                    f"job {job_id!r} has an invalid dependency: {dep!r}; "
                    "dependencies must be non-empty job id strings"
                )
            if dep not in seen:
                seen.add(dep)
                unique_deps.append(dep)

        position[job_id] = index
        ids.append(job_id)
        priority[job_id] = job.priority
        depends[job_id] = tuple(unique_deps)

    # Pass 2 -- every dependency must name a job that was actually supplied.
    dependents: dict[str, list[str]] = {job_id: [] for job_id in ids}
    indegree: dict[str, int] = {}
    for job_id in ids:
        pending = 0
        for dep in depends[job_id]:
            if dep not in position:
                raise ScheduleError(
                    f"job {job_id!r} depends on unknown job {dep!r}; "
                    f"known jobs: {', '.join(ids)}"
                )
            dependents[dep].append(job_id)
            pending += 1
        indegree[job_id] = pending

    # Kahn's algorithm: repeatedly release the best currently-ready job.
    # The heap key is (-priority, input position): priority first, then the
    # original input order as a stable tie-break.
    ready: list[tuple[float, int]] = [
        (-priority[job_id], position[job_id]) for job_id in ids if indegree[job_id] == 0
    ]
    heapq.heapify(ready)

    order: list[str] = []
    scheduled: set[str] = set()
    while ready:
        _, index = heapq.heappop(ready)
        job_id = ids[index]
        if job_id in scheduled:  # defensive: heap keys are unique
            continue
        scheduled.add(job_id)
        order.append(job_id)
        for dependent in dependents[job_id]:
            indegree[dependent] -= 1
            if indegree[dependent] == 0:
                heapq.heappush(
                    ready, (-priority[dependent], position[dependent])
                )

    if len(order) != len(ids):
        blocked = {job_id for job_id in ids if job_id not in scheduled}
        cycle = _find_cycle(blocked, depends)
        headline = (
            f"dependency cycle detected: {_describe_cycle(cycle)}"
            if cycle
            else "unable to schedule: dependency graph has no complete ordering"
        )
        raise ScheduleError(
            f"{headline}; {len(blocked)} job(s) can never run "
            f"(directly or transitively): {', '.join(sorted(blocked))}"
        )

    return order
