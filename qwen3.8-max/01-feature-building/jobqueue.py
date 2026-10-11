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


def _find_cycle(deps_of: dict[str, list[str]], unresolved: list[str]) -> list[str]:
    """Return one closed dependency cycle inside the subgraph induced by
    `unresolved` (e.g. ["a", "b", "a"]), or [] if none is found."""
    unresolved_set = set(unresolved)
    state: dict[str, int] = {}
    for start in unresolved:
        if start in state:
            continue
        path = [start]
        state[start] = 1
        stack = [(start, iter([d for d in deps_of[start] if d in unresolved_set]))]
        while stack:
            node, edges = stack[-1]
            descended = False
            for dep in edges:
                marker = state.get(dep, 0)
                if marker == 1:
                    return path[path.index(dep):] + [dep]
                if marker == 0:
                    state[dep] = 1
                    path.append(dep)
                    stack.append(
                        (dep, iter([d for d in deps_of[dep] if d in unresolved_set]))
                    )
                    descended = True
                    break
            if not descended:
                state[node] = 2
                path.pop()
                stack.pop()
    return []


def plan_jobs(jobs: Iterable[Job]) -> list[str]:
    """Return job IDs in a valid deterministic execution order.

    The plan contains every job ID exactly once and never places a job before
    one of its dependencies. Whenever several jobs are ready at the same step,
    the one with the highest priority is chosen first; equal priorities are
    broken by original input order. Invalid input (non-Job entries, ids that
    are not non-empty unique strings, dependencies that do not name a
    supplied job, non-numeric priorities, dependency cycles) raises
    ScheduleError. The supplied jobs and their dependency sequences are never
    mutated. Empty input returns an empty list.
    """
    try:
        job_list = list(jobs)
    except TypeError as exc:
        raise ScheduleError(
            f"jobs must be an iterable of Job, got {type(jobs).__name__!r}"
        ) from exc

    index_of: dict[str, int] = {}
    neg_priority_of: dict[str, Any] = {}
    deps_of: dict[str, list[str]] = {}

    for position, job in enumerate(job_list):
        if not isinstance(job, Job):
            raise ScheduleError(
                f"expected a Job at position {position}, "
                f"got {type(job).__name__!r}"
            )
        job_id = job.id
        if not isinstance(job_id, str):
            raise ScheduleError(
                f"job at position {position} has a non-string id: {job_id!r}"
            )
        if not job_id:
            raise ScheduleError(f"job at position {position} has an empty id")
        if job_id in index_of:
            raise ScheduleError(
                f"duplicate job id {job_id!r} at positions "
                f"{index_of[job_id]} and {position}"
            )
        try:
            declared = list(job.depends_on)
        except TypeError as exc:
            raise ScheduleError(
                f"job {job_id!r} has a non-iterable depends_on: "
                f"{job.depends_on!r}"
            ) from exc
        try:
            neg_priority_of[job_id] = -job.priority
        except TypeError as exc:
            raise ScheduleError(
                f"job {job_id!r} has a non-numeric priority: {job.priority!r}"
            ) from exc
        index_of[job_id] = position
        deps_of[job_id] = declared

    for job_id, declared in deps_of.items():
        unique: list[str] = []
        seen: set[str] = set()
        for dep in declared:
            if dep not in index_of:
                raise ScheduleError(
                    f"job {job_id!r} depends on unknown job {dep!r}"
                )
            if dep not in seen:
                seen.add(dep)
                unique.append(dep)
        deps_of[job_id] = unique

    remaining = {job_id: len(unique) for job_id, unique in deps_of.items()}
    dependents: dict[str, list[str]] = {job_id: [] for job_id in index_of}
    for job_id, unique in deps_of.items():
        for dep in unique:
            dependents[dep].append(job_id)

    ready = [
        (neg_priority_of[job_id], index_of[job_id], job_id)
        for job_id in index_of
        if remaining[job_id] == 0
    ]
    plan: list[str] = []
    try:
        heapq.heapify(ready)
        while ready:
            _, _, job_id = heapq.heappop(ready)
            plan.append(job_id)
            for dependent in dependents[job_id]:
                remaining[dependent] -= 1
                if remaining[dependent] == 0:
                    heapq.heappush(
                        ready,
                        (
                            neg_priority_of[dependent],
                            index_of[dependent],
                            dependent,
                        ),
                    )
    except TypeError as exc:
        raise ScheduleError("job priorities must be mutually comparable") from exc

    if len(plan) != len(index_of):
        unresolved = [job_id for job_id in index_of if remaining[job_id] > 0]
        cycle = _find_cycle(deps_of, unresolved)
        if cycle:
            raise ScheduleError(
                "dependency cycle detected: " + " -> ".join(cycle)
            )
        raise ScheduleError(
            "dependency cycle detected among jobs: " + ", ".join(unresolved)
        )
    return plan
