from dataclasses import dataclass, field
from typing import Any, Iterable
import heapq


class ScheduleError(ValueError):
    pass


@dataclass(frozen=True)
class Job:
    id: str
    priority: int = 0
    depends_on: tuple[str, ...] = field(default_factory=tuple)
    payload: Any = None


def _normalize_dependencies(job: Job) -> tuple[str, ...]:
    """Return a job's dependencies as a duplicate-free tuple, never mutating input."""
    raw = job.depends_on
    if raw is None:
        return ()
    if isinstance(raw, str):
        raise ScheduleError(
            f"job {job.id!r} lists a string as depends_on; "
            "pass a sequence of job IDs (e.g. ('other',)), not a bare id"
        )
    try:
        candidates = list(raw)
    except TypeError:
        raise ScheduleError(
            f"job {job.id!r} has a non-iterable depends_on value: {raw!r}"
        ) from None

    seen: set[str] = set()
    unique: list[str] = []
    for dep in candidates:
        if not isinstance(dep, str) or not dep:
            raise ScheduleError(
                f"job {job.id!r} has an invalid dependency {dep!r}: "
                "dependencies must be non-empty strings"
            )
        if dep == job.id:
            raise ScheduleError(f"job {job.id!r} depends on itself")
        if dep not in seen:
            seen.add(dep)
            unique.append(dep)
    return tuple(unique)


def _describe_cycle(
    remaining: set[str],
    deps: dict[str, tuple[str, ...]],
    position: dict[str, int],
) -> list[str]:
    """Return one concrete cycle (as a list of IDs) among the unresolved jobs."""
    by_input_order = sorted(remaining, key=lambda job_id: position[job_id])
    state: dict[str, int] = {}  # 1 = on current path, 2 = fully explored

    for start in by_input_order:
        if start in state:
            continue
        state[start] = 1
        path = [start]
        stack = [(start, iter(deps[start]))]
        while stack:
            node, dep_iter = stack[-1]
            descended = False
            for dep in dep_iter:
                if dep not in remaining:
                    continue
                if state.get(dep) == 1:
                    return path[path.index(dep):]
                if dep not in state:
                    state[dep] = 1
                    path.append(dep)
                    stack.append((dep, iter(deps[dep])))
                    descended = True
                    break
            if not descended:
                state[node] = 2
                path.pop()
                stack.pop()
    return by_input_order


def plan_jobs(jobs: Iterable[Job]) -> list[str]:
    """Return job IDs in a valid deterministic execution order."""
    ordered_jobs = list(jobs)

    position: dict[str, int] = {}
    priority: dict[str, int] = {}
    for pos, job in enumerate(ordered_jobs):
        if not isinstance(job, Job):
            raise ScheduleError(f"jobs[{pos}] is not a Job instance: {job!r}")
        job_id = job.id
        if not isinstance(job_id, str) or not job_id:
            raise ScheduleError(
                f"jobs[{pos}] has an invalid id {job_id!r}: ids must be non-empty strings"
            )
        if job_id in position:
            raise ScheduleError(f"duplicate job id {job_id!r}")
        position[job_id] = pos
        priority[job_id] = job.priority

    deps: dict[str, tuple[str, ...]] = {}
    dependents: dict[str, list[str]] = {job_id: [] for job_id in position}
    indegree: dict[str, int] = {}

    for job in ordered_jobs:
        job_id = job.id
        job_deps = _normalize_dependencies(job)
        for dep in job_deps:
            if dep not in position:
                raise ScheduleError(
                    f"job {job_id!r} depends on unknown job {dep!r}"
                )
            dependents[dep].append(job_id)
        deps[job_id] = job_deps
        indegree[job_id] = len(job_deps)

    # (-priority, input position, id) keeps the highest priority first and
    # breaks ties by original input order.
    ready: list[tuple[int, int, str]] = [
        (-priority[job.id], position[job.id], job.id)
        for job in ordered_jobs
        if indegree[job.id] == 0
    ]
    heapq.heapify(ready)

    plan: list[str] = []
    while ready:
        _, _, job_id = heapq.heappop(ready)
        plan.append(job_id)
        for dependent in dependents[job_id]:
            indegree[dependent] -= 1
            if indegree[dependent] == 0:
                heapq.heappush(
                    ready, (-priority[dependent], position[dependent], dependent)
                )

    if len(plan) != len(position):
        unresolved = {job_id for job_id in position if indegree[job_id] > 0}
        cycle = _describe_cycle(unresolved, deps, position)
        raise ScheduleError(
            "dependency cycle detected involving jobs: "
            + " -> ".join([*cycle, cycle[0]])
        )

    return plan
