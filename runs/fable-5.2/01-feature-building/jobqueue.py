import heapq
import math
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

    Every job appears exactly once, after all of its dependencies. Whenever
    several jobs are ready at the same time, the one with the highest
    ``priority`` runs first; ties go to the job supplied earliest.

    Raises ``ScheduleError`` for malformed jobs, duplicate IDs, unknown
    dependencies and dependency cycles. The supplied jobs are never mutated.
    """
    try:
        supplied = list(jobs)
    except TypeError:
        raise ScheduleError(
            f"jobs must be an iterable of Job, got {type(jobs).__name__}"
        ) from None

    index_of = _index_jobs(supplied)
    dependencies = [_dependencies_of(job, index_of) for job in supplied]

    # Kahn's algorithm, with a heap as the ready set so that the best ready job
    # (highest priority, then earliest input position) is always taken next.
    waiting_on = [len(deps) for deps in dependencies]
    dependents: list[list[int]] = [[] for _ in supplied]
    for index, deps in enumerate(dependencies):
        for dep in deps:
            dependents[dep].append(index)

    ready = [
        (-job.priority, index)
        for index, job in enumerate(supplied)
        if not waiting_on[index]
    ]
    heapq.heapify(ready)

    order: list[str] = []
    while ready:
        _, index = heapq.heappop(ready)
        order.append(supplied[index].id)
        for dependent in dependents[index]:
            waiting_on[dependent] -= 1
            if not waiting_on[dependent]:
                heapq.heappush(ready, (-supplied[dependent].priority, dependent))

    if len(order) != len(supplied):
        blocked = [index for index, count in enumerate(waiting_on) if count]
        raise ScheduleError(_describe_cycle(supplied, dependencies, blocked))
    return order


def _index_jobs(supplied: list[Job]) -> dict[str, int]:
    """Validate each job on its own and map job ID -> input position."""
    index_of: dict[str, int] = {}
    for index, job in enumerate(supplied):
        if not isinstance(job, Job):
            raise ScheduleError(
                f"job at index {index} must be a Job, got {type(job).__name__}"
            )
        if not isinstance(job.id, str):
            raise ScheduleError(
                f"job at index {index} has a non-string id: {job.id!r}"
            )
        if not job.id:
            raise ScheduleError(f"job at index {index} has an empty id")
        if job.id in index_of:
            raise ScheduleError(
                f"duplicate job id {job.id!r} at indexes "
                f"{index_of[job.id]} and {index}"
            )
        # The priority is used as a sort key, so anything unordered (None,
        # strings, NaN) would otherwise fail later or silently misorder jobs.
        priority = job.priority
        if not isinstance(priority, (int, float)) or (
            isinstance(priority, float) and math.isnan(priority)
        ):
            raise ScheduleError(
                f"job {job.id!r} has an invalid priority: {priority!r}"
            )
        index_of[job.id] = index
    return index_of


def _dependencies_of(job: Job, index_of: dict[str, int]) -> list[int]:
    """Return the input positions of ``job``'s distinct dependencies."""
    depends_on = job.depends_on
    if isinstance(depends_on, (str, bytes)):
        # A bare string would be iterated character by character.
        raise ScheduleError(
            f"job {job.id!r}: depends_on must be a collection of job ids, "
            f"not the single string {depends_on!r}"
        )
    try:
        names = list(depends_on)
    except TypeError:
        raise ScheduleError(
            f"job {job.id!r}: depends_on must be a collection of job ids, "
            f"got {type(depends_on).__name__}"
        ) from None

    deps: dict[int, None] = {}  # ordered set: a repeated dependency counts once
    for name in names:
        if not isinstance(name, str):
            raise ScheduleError(
                f"job {job.id!r} has a non-string dependency: {name!r}"
            )
        if name not in index_of:
            raise ScheduleError(
                f"job {job.id!r} depends on unknown job {name!r}"
            )
        deps[index_of[name]] = None
    return list(deps)


def _describe_cycle(
    supplied: list[Job], dependencies: list[list[int]], blocked: list[int]
) -> str:
    """Build the diagnostic for a schedule that cannot complete.

    ``blocked`` holds the jobs Kahn's algorithm never released: the members of
    every cycle plus anything downstream of one. Each blocked job still has at
    least one blocked dependency, so walking those edges must revisit a job,
    and the walk from that job onwards is a concrete cycle.
    """
    blocked_set = set(blocked)
    seen_at: dict[int, int] = {}
    path: list[int] = []
    current = blocked[0]
    while current not in seen_at:
        seen_at[current] = len(path)
        path.append(current)
        current = next(dep for dep in dependencies[current] if dep in blocked_set)
    cycle = path[seen_at[current]:]

    chain = " -> ".join(repr(supplied[index].id) for index in [*cycle, cycle[0]])
    message = f"dependency cycle detected: {chain} (each job depends on the next)"
    in_cycle = set(cycle)
    downstream = [supplied[index].id for index in blocked if index not in in_cycle]
    if downstream:
        listed = ", ".join(repr(job_id) for job_id in downstream)
        message += f"; other jobs that can never become ready: {listed}"
    return message
