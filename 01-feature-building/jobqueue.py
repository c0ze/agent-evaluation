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


def _validate(jobs: list[Job]) -> dict[str, int]:
    """Validate jobs and return a mapping of job ID -> input index."""
    index: dict[str, int] = {}
    for position, job in enumerate(jobs):
        if not isinstance(job, Job):
            raise ScheduleError(
                f"item at position {position} is not a Job: {job!r}"
            )
        if not isinstance(job.id, str) or not job.id:
            raise ScheduleError(
                f"job at position {position} has an invalid id {job.id!r}; "
                "ids must be non-empty strings"
            )
        if job.id in index:
            raise ScheduleError(
                f"duplicate job id {job.id!r} at positions "
                f"{index[job.id]} and {position}"
            )
        if isinstance(job.priority, bool) or not isinstance(job.priority, int):
            raise ScheduleError(
                f"job {job.id!r} has a non-integer priority {job.priority!r}"
            )
        if isinstance(job.depends_on, (str, bytes)):
            raise ScheduleError(
                f"job {job.id!r} depends_on must be a sequence of job ids, "
                f"not a single string {job.depends_on!r}"
            )
        try:
            deps = tuple(job.depends_on)
        except TypeError:
            raise ScheduleError(
                f"job {job.id!r} depends_on is not iterable: {job.depends_on!r}"
            ) from None
        for dep in deps:
            if not isinstance(dep, str) or not dep:
                raise ScheduleError(
                    f"job {job.id!r} has an invalid dependency {dep!r}; "
                    "dependencies must be non-empty strings"
                )
        index[job.id] = position

    for job in jobs:
        missing = sorted({dep for dep in job.depends_on if dep not in index})
        if missing:
            raise ScheduleError(
                f"job {job.id!r} depends on unknown job(s): "
                + ", ".join(repr(m) for m in missing)
            )
    return index


def _find_cycle(blocked: list[str], deps: dict[str, set[str]]) -> list[str]:
    """Return one dependency cycle among ``blocked`` as [a, b, ..., a].

    Every blocked job has at least one blocked dependency, so walking
    dependency edges from any blocked job must eventually revisit a job.
    """
    blocked_set = set(blocked)
    path: list[str] = []
    seen_at: dict[str, int] = {}
    node = blocked[0]
    while node not in seen_at:
        seen_at[node] = len(path)
        path.append(node)
        # Deterministic choice: smallest blocked dependency ID.
        node = min(d for d in deps[node] if d in blocked_set)
    cycle = path[seen_at[node]:]
    # Present as "X depends on Y depends on ... depends on X".
    return cycle + [node]


def plan_jobs(jobs: Iterable[Job]) -> list[str]:
    """Return job IDs in a valid deterministic execution order.

    Every job appears exactly once and after all of its dependencies. Among
    jobs that are ready at the same time, higher ``priority`` runs first and
    ties are broken by original input order.

    Raises ``ScheduleError`` for non-string/empty/duplicate IDs, unknown
    dependencies, or dependency cycles. The input jobs are never mutated.
    """
    job_list = list(jobs)
    if not job_list:
        return []

    index = _validate(job_list)

    # deps[x]: distinct jobs x waits on; dependents[y]: jobs waiting on y.
    deps: dict[str, set[str]] = {job.id: set(job.depends_on) for job in job_list}
    dependents: dict[str, list[str]] = {job.id: [] for job in job_list}
    for job in job_list:
        for dep in deps[job.id]:
            dependents[dep].append(job.id)
    remaining = {job_id: len(d) for job_id, d in deps.items()}

    # Heap key: (-priority, input position) => higher priority, then earlier.
    ready = [
        (-job.priority, index[job.id], job.id)
        for job in job_list
        if remaining[job.id] == 0
    ]
    heapq.heapify(ready)

    by_id = {job.id: job for job in job_list}
    order: list[str] = []
    while ready:
        _, _, job_id = heapq.heappop(ready)
        order.append(job_id)
        for child in dependents[job_id]:
            remaining[child] -= 1
            if remaining[child] == 0:
                child_job = by_id[child]
                heapq.heappush(
                    ready, (-child_job.priority, index[child], child)
                )

    if len(order) != len(job_list):
        blocked = [job.id for job in job_list if remaining[job.id] > 0]
        cycle = _find_cycle(blocked, deps)
        raise ScheduleError(
            "dependency cycle detected ('->' means 'depends on'): "
            + " -> ".join(cycle)
            + "; blocked jobs: "
            + ", ".join(blocked)
        )
    return order
