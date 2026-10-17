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


def _find_cycle_info(
    job_list: list[Job],
    deps_by_id: dict[str, tuple[str, ...]],
    unscheduled: set[str],
) -> tuple[list[str], list[str]]:
    """Return (cycle_member_ids_in_input_order, representative_cycle_path)."""
    index_map: dict[str, int] = {}
    lowlink: dict[str, int] = {}
    on_stack: set[str] = set()
    stack: list[str] = []
    counter = 0
    cycle_members: set[str] = set()

    def strongconnect(node: str) -> None:
        nonlocal counter
        index_map[node] = counter
        lowlink[node] = counter
        counter += 1
        stack.append(node)
        on_stack.add(node)

        for dep in deps_by_id[node]:
            if dep not in unscheduled:
                continue
            if dep not in index_map:
                strongconnect(dep)
                lowlink[node] = min(lowlink[node], lowlink[dep])
            elif dep in on_stack:
                lowlink[node] = min(lowlink[node], index_map[dep])

        if lowlink[node] == index_map[node]:
            scc: list[str] = []
            while True:
                member = stack.pop()
                on_stack.remove(member)
                scc.append(member)
                if member == node:
                    break
            if len(scc) > 1 or node in deps_by_id[node]:
                cycle_members.update(scc)

    for job in job_list:
        if job.id in unscheduled and job.id not in index_map:
            strongconnect(job.id)

    ordered_cycle_ids = [job.id for job in job_list if job.id in cycle_members]

    # Build a deterministic cycle trace starting from the first cycle member in input order.
    cycle_path: list[str] = []
    if ordered_cycle_ids:
        start = ordered_cycle_ids[0]
        visited_state: dict[str, int] = {}
        trail: list[str] = []

        def dfs(curr: str) -> bool:
            visited_state[curr] = 1
            trail.append(curr)
            for dep in deps_by_id[curr]:
                if dep not in cycle_members:
                    continue
                state = visited_state.get(dep, 0)
                if state == 1:
                    idx = trail.index(dep)
                    cycle_path.extend(trail[idx:] + [dep])
                    return True
                if state == 0 and dfs(dep):
                    return True
            trail.pop()
            visited_state[curr] = 2
            return False

        dfs(start)

    return ordered_cycle_ids, cycle_path


def plan_jobs(jobs: Iterable[Job]) -> list[str]:
    """Return job IDs in a valid deterministic execution order."""
    if jobs is None or isinstance(jobs, (str, bytes)) or not isinstance(jobs, Iterable):
        raise ScheduleError("jobs must be an iterable of Job instances")

    job_list = list(jobs)
    if not job_list:
        return []

    id_to_index: dict[str, int] = {}
    for index, job in enumerate(job_list):
        if not isinstance(job, Job):
            raise ScheduleError(f"Expected Job instance at index {index}, got {type(job).__name__}")
        if not isinstance(job.id, str) or not job.id.strip():
            raise ScheduleError(f"Job at index {index} must have a non-empty string id")
        if isinstance(job.priority, bool) or not isinstance(job.priority, (int, float)):
            raise ScheduleError(f"Job {job.id!r} must have a numeric priority")
        if job.id in id_to_index:
            raise ScheduleError(f"Duplicate job id: {job.id!r}")
        id_to_index[job.id] = index

    deps_by_id: dict[str, tuple[str, ...]] = {}
    dependents_by_id: dict[str, list[str]] = {job.id: [] for job in job_list}
    in_degree: dict[str, int] = {}

    for job in job_list:
        raw_deps = job.depends_on
        if (
            raw_deps is None
            or isinstance(raw_deps, (str, bytes))
            or not isinstance(raw_deps, Iterable)
        ):
            raise ScheduleError(
                f"Job {job.id!r} depends_on must be an iterable of job IDs"
            )

        unique_deps: list[str] = []
        seen_deps: set[str] = set()
        for dep in raw_deps:
            if not isinstance(dep, str) or not dep.strip():
                raise ScheduleError(
                    f"Job {job.id!r} has an invalid dependency id: {dep!r}"
                )
            if dep not in id_to_index:
                raise ScheduleError(
                    f"Job {job.id!r} depends on unknown job {dep!r}"
                )
            if dep not in seen_deps:
                seen_deps.add(dep)
                unique_deps.append(dep)

        deps_tuple = tuple(unique_deps)
        deps_by_id[job.id] = deps_tuple
        in_degree[job.id] = len(deps_tuple)
        for dep in deps_tuple:
            dependents_by_id[dep].append(job.id)

    ready_heap: list[tuple[int | float, int, str]] = []
    for index, job in enumerate(job_list):
        if in_degree[job.id] == 0:
            heapq.heappush(ready_heap, (-job.priority, index, job.id))

    scheduled: list[str] = []
    while ready_heap:
        _, _, current_id = heapq.heappop(ready_heap)
        scheduled.append(current_id)

        for dependent_id in dependents_by_id[current_id]:
            in_degree[dependent_id] -= 1
            if in_degree[dependent_id] == 0:
                dep_index = id_to_index[dependent_id]
                dep_job = job_list[dep_index]
                heapq.heappush(ready_heap, (-dep_job.priority, dep_index, dependent_id))

    if len(scheduled) != len(job_list):
        unscheduled = {job.id for job in job_list if in_degree[job.id] > 0}
        cycle_ids, cycle_path = _find_cycle_info(job_list, deps_by_id, unscheduled)
        trace = " -> ".join(cycle_path) if cycle_path else ", ".join(cycle_ids)
        raise ScheduleError(
            f"Dependency cycle detected involving {', '.join(cycle_ids)} ({trace})"
        )

    return scheduled
