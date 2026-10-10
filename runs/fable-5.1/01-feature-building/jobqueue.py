"""Dependency-aware job scheduling.

`plan_jobs` turns a collection of `Job` records into a deterministic execution
order that respects every dependency, prefers higher-priority work among the
jobs that are ready, and rejects malformed or cyclic input with a
`ScheduleError` whose message says what went wrong.
"""

from __future__ import annotations

import heapq
from dataclasses import dataclass, field
from typing import Any, Iterable


class ScheduleError(ValueError):
    """Raised when a set of jobs cannot be turned into an execution plan."""


@dataclass(frozen=True)
class Job:
    id: str
    priority: int = 0
    depends_on: tuple[str, ...] = field(default_factory=tuple)
    payload: Any = None


def plan_jobs(jobs: Iterable[Job]) -> list[str]:
    """Return job IDs in a valid deterministic execution order.

    Guarantees:

    * Every job ID appears exactly once, and only after all of its
      dependencies.
    * Whenever several jobs are ready (all dependencies already placed), the
      one with the highest ``priority`` goes first; equal priorities are
      broken by the job's position in the input.  Readiness is re-evaluated
      after every placement, so a high-priority job that has just been
      unblocked jumps ahead of lower-priority jobs that were ready earlier.
      There is no priority inheritance: a low-priority dependency is not
      promoted because something important is waiting on it.
    * The input jobs and their ``depends_on`` collections are never modified.
    * Empty input yields ``[]``.

    Raises ``ScheduleError`` when a job ID is not a non-empty string, when
    two jobs share an ID, when a dependency is not a string or does not name
    a supplied job, when ``depends_on`` is not a collection of IDs, or when
    the dependency graph contains a cycle.  Cycle errors spell out one
    concrete cycle, e.g. ``"Dependency cycle detected: a -> b -> a"``.
    """
    job_list = list(jobs)
    if not job_list:
        return []

    index_of = _validate_ids(job_list)
    deps_of = _resolve_dependencies(job_list, index_of)

    count = len(job_list)
    dependents: list[list[int]] = [[] for _ in range(count)]
    unmet: list[int] = [0] * count
    for job_index, dep_indexes in enumerate(deps_of):
        unmet[job_index] = len(dep_indexes)
        for dep_index in dep_indexes:
            dependents[dep_index].append(job_index)

    # Kahn's algorithm with a heap so that, among the ready jobs, the highest
    # priority wins and ties fall back to input order.  The input index is
    # unique, so heap entries never need to compare Job objects.
    ready: list[tuple[int, int]] = [
        (-job_list[i].priority, i) for i in range(count) if unmet[i] == 0
    ]
    heapq.heapify(ready)

    order: list[str] = []
    while ready:
        _, job_index = heapq.heappop(ready)
        order.append(job_list[job_index].id)
        for dependent in dependents[job_index]:
            unmet[dependent] -= 1
            if unmet[dependent] == 0:
                heapq.heappush(ready, (-job_list[dependent].priority, dependent))

    if len(order) != count:
        cycle = _find_cycle(job_list, deps_of, unmet)
        raise ScheduleError("Dependency cycle detected: " + " -> ".join(cycle))

    return order


def _validate_ids(job_list: list[Job]) -> dict[str, int]:
    """Check that every ID is a unique, non-empty string; map ID -> index."""
    index_of: dict[str, int] = {}
    for position, job in enumerate(job_list):
        job_id = job.id
        if not isinstance(job_id, str):
            raise ScheduleError(
                f"Job at position {position} has a non-string id: {job_id!r}"
            )
        if not job_id:
            raise ScheduleError(f"Job at position {position} has an empty id")
        if job_id in index_of:
            raise ScheduleError(
                f"Duplicate job id {job_id!r} at positions "
                f"{index_of[job_id]} and {position}"
            )
        index_of[job_id] = position
    return index_of


def _resolve_dependencies(
    job_list: list[Job], index_of: dict[str, int]
) -> list[tuple[int, ...]]:
    """Translate each job's dependency IDs into de-duplicated job indexes.

    Only reads from the supplied jobs; the returned structure is fresh, so
    the caller's ``depends_on`` collections are never touched.
    """
    deps_of: list[tuple[int, ...]] = []
    for job in job_list:
        raw = job.depends_on
        if isinstance(raw, (str, bytes)):
            raise ScheduleError(
                f"Job {job.id!r}: depends_on must be a collection of job ids, "
                f"not the bare string {raw!r}"
            )
        try:
            dep_ids = list(raw)
        except TypeError:
            raise ScheduleError(
                f"Job {job.id!r}: depends_on must be an iterable of job ids, "
                f"got {raw!r}"
            ) from None

        resolved: list[int] = []
        seen: set[int] = set()
        unknown: list[str] = []
        for dep in dep_ids:
            if not isinstance(dep, str):
                raise ScheduleError(
                    f"Job {job.id!r} has a non-string dependency: {dep!r}"
                )
            dep_index = index_of.get(dep)
            if dep_index is None:
                if dep not in unknown:
                    unknown.append(dep)
                continue
            if dep_index not in seen:
                seen.add(dep_index)
                resolved.append(dep_index)
        if unknown:
            listed = ", ".join(repr(dep) for dep in unknown)
            noun = "job" if len(unknown) == 1 else "jobs"
            raise ScheduleError(f"Job {job.id!r} depends on unknown {noun}: {listed}")
        deps_of.append(tuple(resolved))
    return deps_of


def _find_cycle(
    job_list: list[Job], deps_of: list[tuple[int, ...]], unmet: list[int]
) -> list[str]:
    """Return the IDs of one concrete dependency cycle, closed on itself.

    Called only after Kahn's algorithm stalls.  Every job that was never
    placed still has at least one never-placed dependency, so walking from
    any stuck job along stuck dependencies must eventually revisit a job;
    the walk from that first visit is a cycle.  The walk is iterative, so
    very long cycles do not hit the recursion limit, and it always starts at
    the earliest stuck job and follows the first stuck dependency, which
    keeps the diagnostic deterministic.
    """
    stuck = {i for i, pending in enumerate(unmet) if pending > 0}
    path: list[int] = []
    first_seen_at: dict[int, int] = {}
    current = min(stuck)
    while current not in first_seen_at:
        first_seen_at[current] = len(path)
        path.append(current)
        current = next(dep for dep in deps_of[current] if dep in stuck)
    loop = path[first_seen_at[current]:] + [current]
    return [job_list[i].id for i in loop]
