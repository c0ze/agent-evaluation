from dataclasses import dataclass, field
from heapq import heapify, heappop, heappush
from typing import Any, Iterable


class ScheduleError(ValueError):
    pass


@dataclass(frozen=True)
class Job:
    id: str
    priority: int = 0
    depends_on: tuple[str, ...] = field(default_factory=tuple)
    payload: Any = None


def _check_job(job: object, position: int, seen: dict[str, int]) -> None:
    if not isinstance(job, Job):
        raise ScheduleError(f"item {position} is {type(job).__name__}, expected Job")
    if not isinstance(job.id, str) or not job.id.strip():
        raise ScheduleError(f"item {position} needs a non-empty string id, got {job.id!r}")
    if job.id in seen:
        raise ScheduleError(f"duplicate job id {job.id!r} at positions {seen[job.id]} and {position}")
    if not isinstance(job.priority, int) or isinstance(job.priority, bool):
        raise ScheduleError(f"job {job.id!r} priority must be an int, got {job.priority!r}")


def _dependencies(job: Job, known: dict[str, int]) -> dict[str, None]:
    """Validate depends_on and return its names in order, without duplicates."""
    if isinstance(job.depends_on, str):
        raise ScheduleError(f"job {job.id!r} depends_on must be a collection of job IDs, not a string")
    try:
        names = tuple(job.depends_on)
    except TypeError:
        raise ScheduleError(f"job {job.id!r} depends_on must be iterable, got {job.depends_on!r}") from None
    for name in names:
        if not isinstance(name, str):
            raise ScheduleError(f"job {job.id!r} has a non-string dependency {name!r}")
        if name not in known:
            raise ScheduleError(f"job {job.id!r} depends on unknown job {name!r}")
    return dict.fromkeys(names)


def _find_cycle(deps: dict[str, dict[str, None]], blocked: list[str]) -> str:
    """Follow unscheduled dependencies from a blocked job until one repeats."""
    blocked_set = set(blocked)
    path = [blocked[0]]
    index = {blocked[0]: 0}
    while True:
        # Every blocked job has at least one blocked dependency, so this always finds one.
        node = next(name for name in deps[path[-1]] if name in blocked_set)
        if node in index:
            return " -> ".join(path[index[node]:] + [node])
        index[node] = len(path)
        path.append(node)


def plan_jobs(jobs: Iterable[Job]) -> list[str]:
    """Return job IDs in a valid deterministic execution order.

    Jobs run after all of their dependencies. Among ready jobs, higher priority
    goes first and equal priorities keep their input order.
    """
    job_list = list(jobs)
    positions: dict[str, int] = {}
    for position, job in enumerate(job_list):
        _check_job(job, position, positions)
        positions[job.id] = position

    deps = {job.id: _dependencies(job, positions) for job in job_list}
    dependents: dict[str, list[str]] = {job.id: [] for job in job_list}
    for job_id, names in deps.items():
        for name in names:
            dependents[name].append(job_id)

    priority = {job.id: job.priority for job in job_list}
    waiting = {job_id: len(names) for job_id, names in deps.items()}
    ready = [
        (-priority[job_id], positions[job_id], job_id)
        for job_id, count in waiting.items()
        if count == 0
    ]
    heapify(ready)

    plan: list[str] = []
    while ready:
        _, _, job_id = heappop(ready)
        plan.append(job_id)
        for child in dependents[job_id]:
            waiting[child] -= 1
            if waiting[child] == 0:
                heappush(ready, (-priority[child], positions[child], child))

    if len(plan) < len(job_list):
        done = set(plan)
        blocked = [job.id for job in job_list if job.id not in done]
        raise ScheduleError(
            f"dependency cycle: {_find_cycle(deps, blocked)}; "
            f"unschedulable jobs: {', '.join(blocked)}"
        )
    return plan
