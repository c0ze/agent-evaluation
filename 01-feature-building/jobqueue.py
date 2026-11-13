from dataclasses import dataclass, field
import heapq
import math
from typing import Any, Iterable, Iterator


class ScheduleError(ValueError):
    pass


@dataclass(frozen=True)
class Job:
    id: str
    priority: int = 0
    depends_on: tuple[str, ...] = field(default_factory=tuple)
    payload: Any = None


def _validate_and_index_jobs(
    jobs: Iterable[Job],
) -> tuple[list[Job], dict[str, int], dict[str, list[str]]]:
    """Validate input jobs and build non-mutating index and dependency tables."""
    try:
        job_list = list(jobs)
    except TypeError as exc:
        raise ScheduleError("jobs must be an iterable of Job instances") from exc

    index_by_id: dict[str, int] = {}
    deps_by_id: dict[str, list[str]] = {}

    for idx, job in enumerate(job_list):
        if not isinstance(job, Job):
            raise ScheduleError(
                f"Expected Job instance at index {idx}, got {type(job).__name__}"
            )
        if not isinstance(job.id, str) or not job.id:
            raise ScheduleError(
                f"Job at index {idx} must have a non-empty string id, got {job.id!r}"
            )
        if job.id in index_by_id:
            raise ScheduleError(f"Duplicate job id {job.id!r}")
        if (
            isinstance(job.priority, bool)
            or not isinstance(job.priority, (int, float))
            or math.isnan(job.priority)
        ):
            raise ScheduleError(
                f"Job {job.id!r} has invalid priority {job.priority!r}; expected a real number"
            )
        if isinstance(job.depends_on, (str, bytes)) or not isinstance(
            job.depends_on, Iterable
        ):
            raise ScheduleError(
                f"Job {job.id!r} has invalid depends_on {job.depends_on!r}; "
                "expected an iterable of job IDs"
            )

        # Preserve dependency order while deduplicating without mutating job.depends_on.
        seen_deps: dict[str, None] = {}
        for dep in job.depends_on:
            if not isinstance(dep, str) or not dep:
                raise ScheduleError(
                    f"Job {job.id!r} has invalid dependency {dep!r}; "
                    "dependency IDs must be non-empty strings"
                )
            seen_deps[dep] = None

        index_by_id[job.id] = idx
        deps_by_id[job.id] = list(seen_deps)

    for job in job_list:
        for dep in deps_by_id[job.id]:
            if dep not in index_by_id:
                raise ScheduleError(
                    f"Job {job.id!r} depends on unknown job {dep!r}"
                )

    return job_list, index_by_id, deps_by_id


def _find_cycle(
    remaining: list[str], deps_by_id: dict[str, list[str]]
) -> list[str]:
    """Return a dependency cycle [id_0, ..., id_0] within the unscheduled subgraph."""
    remaining_set = set(remaining)
    state: dict[str, int] = {}  # absent/0 = unvisited, 1 = on current path, 2 = done

    for start in remaining:
        if state.get(start, 0) != 0:
            continue

        # Iterative DFS avoids RecursionError on deep dependency chains.
        state[start] = 1
        path: list[str] = [start]
        path_index: dict[str, int] = {start: 0}
        stack: list[Iterator[str]] = [iter(deps_by_id[start])]

        while stack:
            try:
                nxt = next(stack[-1])
            except StopIteration:
                stack.pop()
                finished = path.pop()
                del path_index[finished]
                state[finished] = 2
                continue

            if nxt not in remaining_set:
                continue

            nxt_state = state.get(nxt, 0)
            if nxt_state == 1:
                return path[path_index[nxt] :] + [nxt]
            if nxt_state == 0:
                state[nxt] = 1
                path_index[nxt] = len(path)
                path.append(nxt)
                stack.append(iter(deps_by_id[nxt]))

    return remaining


def plan_jobs(jobs: Iterable[Job]) -> list[str]:
    """Return job IDs in a valid deterministic execution order."""
    job_list, index_by_id, deps_by_id = _validate_and_index_jobs(jobs)
    if not job_list:
        return []

    in_degree: dict[str, int] = {}
    dependents: dict[str, list[str]] = {job.id: [] for job in job_list}
    for job in job_list:
        deps = deps_by_id[job.id]
        in_degree[job.id] = len(deps)
        for dep in deps:
            dependents[dep].append(job.id)

    # Heap key (-priority, input_index, id) prioritizes higher priority, then input order.
    ready: list[tuple[int | float, int, str]] = [
        (-job.priority, idx, job.id)
        for idx, job in enumerate(job_list)
        if in_degree[job.id] == 0
    ]
    heapq.heapify(ready)

    order: list[str] = []
    while ready:
        _, _, job_id = heapq.heappop(ready)
        order.append(job_id)
        for dependent_id in dependents[job_id]:
            in_degree[dependent_id] -= 1
            if in_degree[dependent_id] == 0:
                dep_idx = index_by_id[dependent_id]
                dep_priority = job_list[dep_idx].priority
                heapq.heappush(ready, (-dep_priority, dep_idx, dependent_id))

    if len(order) != len(job_list):
        scheduled = set(order)
        remaining = [job.id for job in job_list if job.id not in scheduled]
        cycle = _find_cycle(remaining, deps_by_id)
        raise ScheduleError(f"Dependency cycle detected: {' -> '.join(cycle)}")

    return order

