from collections import deque
from dataclasses import dataclass, field
import heapq
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

    Jobs are returned after all of their dependencies. Among jobs that are
    currently ready (all dependencies already returned), higher ``priority``
    comes first and equal priorities keep original input order.

    Raises:
        ScheduleError: on a missing, non-string or duplicate job ID, on a
            dependency that names no supplied job, on a malformed job or
            dependency list, or on a dependency cycle.
    """
    if jobs is None:
        raise ScheduleError("jobs must be an iterable of Job, not None")
    try:
        job_list = list(jobs)
    except TypeError as exc:
        raise ScheduleError(f"jobs must be an iterable of Job: {exc}") from exc

    if not job_list:
        return []

    # First pass: validate IDs and priorities and copy dependency lists so
    # the caller's objects are never mutated. Dependencies are checked in a
    # second pass because a job may depend on one defined later in the input.
    index_by_id: dict[str, int] = {}
    neg_priority_by_id: dict[str, Any] = {}
    deps_by_id: dict[str, tuple[str, ...]] = {}
    ordered_ids: list[str] = []

    for index, job in enumerate(job_list):
        try:
            job_id = job.id
            priority = job.priority
            depends_on = job.depends_on
        except AttributeError as exc:
            raise ScheduleError(
                f"job at index {index} is not a Job (missing attribute: {exc})"
            ) from exc

        if not isinstance(job_id, str) or job_id == "":
            raise ScheduleError(
                f"job at index {index} has an invalid id {job_id!r}: "
                "id must be a non-empty string"
            )
        if job_id in index_by_id:
            raise ScheduleError(
                f"duplicate job id {job_id!r} at indices "
                f"{index_by_id[job_id]} and {index}: ids must be unique"
            )

        try:
            neg_priority = -priority
        except TypeError as exc:
            raise ScheduleError(
                f"job {job_id!r} has an invalid priority {priority!r}: "
                "priority must be a number"
            ) from exc

        if depends_on is None or isinstance(depends_on, (str, bytes)):
            raise ScheduleError(
                f"job {job_id!r} has an invalid depends_on {depends_on!r}: "
                "depends_on must be a tuple/list of job IDs, not a single string"
            )
        try:
            deps_copy = list(depends_on)
        except TypeError as exc:
            raise ScheduleError(
                f"job {job_id!r} has an invalid depends_on {depends_on!r}: "
                "depends_on must be an iterable of job IDs"
            ) from exc

        for dep in deps_copy:
            if not isinstance(dep, str) or dep == "":
                raise ScheduleError(
                    f"job {job_id!r} has an invalid dependency {dep!r}: "
                    "dependencies must be non-empty string job IDs"
                )

        index_by_id[job_id] = index
        ordered_ids.append(job_id)
        neg_priority_by_id[job_id] = neg_priority
        # Deduplicate while preserving order so a repeated dependency is
        # counted once, not treated as an unsatisfiable extra prerequisite.
        deps_by_id[job_id] = tuple(dict.fromkeys(deps_copy))

    # Second pass: every dependency must name a supplied job.
    for job_id in ordered_ids:
        for dep in deps_by_id[job_id]:
            if dep not in index_by_id:
                raise ScheduleError(
                    f"job {job_id!r} depends on unknown job {dep!r}"
                )

    # Kahn's algorithm with a heap over the ready set, keyed by
    # (-priority, input_index) for the required deterministic tie-breaking.
    dependents: dict[str, list[str]] = {job_id: [] for job_id in ordered_ids}
    in_degree: dict[str, int] = {}
    for job_id in ordered_ids:
        deps = deps_by_id[job_id]
        in_degree[job_id] = len(deps)
        for dep in deps:
            dependents[dep].append(job_id)

    ready: list[tuple[Any, int, str]] = [
        (neg_priority_by_id[job_id], index_by_id[job_id], job_id)
        for job_id in ordered_ids
        if in_degree[job_id] == 0
    ]
    heapq.heapify(ready)

    result: list[str] = []
    while ready:
        _, _, job_id = heapq.heappop(ready)
        result.append(job_id)
        for dependent in dependents[job_id]:
            in_degree[dependent] -= 1
            if in_degree[dependent] == 0:
                heapq.heappush(
                    ready,
                    (
                        neg_priority_by_id[dependent],
                        index_by_id[dependent],
                        dependent,
                    ),
                )

    if len(result) == len(ordered_ids):
        return result

    # Whatever is left is on, or downstream of, a cycle. Prune downstream
    # sinks (no dependents left in the residual graph) iteratively; nodes
    # on a cycle always keep a residual dependent, so they survive.
    scheduled = set(result)
    remaining = [job_id for job_id in ordered_ids if job_id not in scheduled]
    remaining_set = set(remaining)
    residual_out_degree = {
        job_id: sum(1 for d in dependents[job_id] if d in remaining_set)
        for job_id in remaining
    }
    queue = deque(
        job_id for job_id in remaining if residual_out_degree[job_id] == 0
    )
    pruned: set[str] = set()
    while queue:
        node = queue.popleft()
        if node in pruned:
            continue
        pruned.add(node)
        for dep in deps_by_id[node]:
            if dep in remaining_set and dep not in pruned:
                residual_out_degree[dep] -= 1
                if residual_out_degree[dep] == 0:
                    queue.append(dep)
    cycle_ids = [job_id for job_id in remaining if job_id not in pruned]
    if not cycle_ids:
        cycle_ids = remaining

    message = "dependency cycle detected involving job(s): " + ", ".join(cycle_ids)
    downstream = [job_id for job_id in remaining if job_id not in set(cycle_ids)]
    if downstream:
        message += "; also unscheduled (dependent on the cycle): " + ", ".join(
            downstream
        )
    raise ScheduleError(message)
