import collections
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


def _diagnose_cycle(job_list: list[Job], completed: set[str]) -> str:
    """Diagnose dependency cycles among unscheduled jobs using Tarjan's SCC algorithm."""
    unscheduled_jobs = {job.id: job for job in job_list if job.id not in completed}

    indices: dict[str, int] = {}
    lowlink: dict[str, int] = {}
    stack: list[str] = []
    on_stack: set[str] = set()
    sccs: list[list[str]] = []
    index = 0

    def strongconnect(node_id: str) -> None:
        nonlocal index
        indices[node_id] = index
        lowlink[node_id] = index
        index += 1
        stack.append(node_id)
        on_stack.add(node_id)

        node_job = unscheduled_jobs[node_id]
        for dep in set(node_job.depends_on):
            if dep in unscheduled_jobs:
                if dep not in indices:
                    strongconnect(dep)
                    lowlink[node_id] = min(lowlink[node_id], lowlink[dep])
                elif dep in on_stack:
                    lowlink[node_id] = min(lowlink[node_id], indices[dep])

        if lowlink[node_id] == indices[node_id]:
            scc: list[str] = []
            while True:
                w = stack.pop()
                on_stack.remove(w)
                scc.append(w)
                if w == node_id:
                    break
            sccs.append(scc)

    for node_id in unscheduled_jobs:
        if node_id not in indices:
            strongconnect(node_id)

    # An SCC represents a cycle if it has > 1 node or a single node with a self-dependency
    cycle_sccs = [
        scc
        for scc in sccs
        if len(scc) > 1 or (len(scc) == 1 and scc[0] in unscheduled_jobs[scc[0]].depends_on)
    ]

    if not cycle_sccs:
        cycle_ids = sorted(unscheduled_jobs.keys())
        return f"Dependency cycle detected involving jobs: {', '.join(cycle_ids)}"

    all_cycle_ids = sorted({nid for scc in cycle_sccs for nid in scc})

    # Trace a representative simple cycle path from the first cycle SCC
    rep_scc = set(cycle_sccs[0])
    start = next(iter(rep_scc))
    visited_pos: dict[str, int] = {}
    path: list[str] = []
    curr = start
    while curr not in visited_pos:
        visited_pos[curr] = len(path)
        path.append(curr)
        next_dep = None
        for dep in unscheduled_jobs[curr].depends_on:
            if dep in rep_scc:
                next_dep = dep
                break
        if next_dep is None:
            break
        curr = next_dep

    if curr in visited_pos:
        cycle_path = path[visited_pos[curr]:]
        cycle_path_str = " -> ".join(cycle_path + [cycle_path[0]])
        return (
            f"Dependency cycle detected involving jobs: {', '.join(all_cycle_ids)} "
            f"(cycle: {cycle_path_str})"
        )
    return f"Dependency cycle detected involving jobs: {', '.join(all_cycle_ids)}"


def plan_jobs(jobs: Iterable[Job]) -> list[str]:
    """Return job IDs in a valid deterministic execution order."""
    job_list = list(jobs)
    if not job_list:
        return []

    # 1. Validate each job and ensure IDs are unique non-empty strings
    seen_ids: set[str] = set()
    for job in job_list:
        if not hasattr(job, "id") or not isinstance(job.id, str) or not job.id:
            raise ScheduleError(
                f"Job id must be a non-empty string, got {getattr(job, 'id', None)!r}"
            )
        if job.id in seen_ids:
            raise ScheduleError(f"Duplicate job ID detected: {job.id!r}")
        seen_ids.add(job.id)

        if (
            not hasattr(job, "priority")
            or not isinstance(job.priority, (int, float))
            or isinstance(job.priority, bool)
            or math.isnan(job.priority)
        ):
            raise ScheduleError(
                f"Job {job.id!r} has invalid priority: {getattr(job, 'priority', None)!r}"
            )

        if (
            not hasattr(job, "depends_on")
            or not isinstance(job.depends_on, Iterable)
            or isinstance(job.depends_on, (str, bytes))
        ):
            raise ScheduleError(
                f"Job {job.id!r} depends_on must be an iterable of job IDs, got {getattr(job, 'depends_on', None)!r}"
            )

    # 2. Validate dependencies and build dependency graph
    in_degree: dict[str, int] = {}
    dependents: dict[str, list[str]] = collections.defaultdict(list)
    job_map: dict[str, tuple[int, Job]] = {}

    for idx, job in enumerate(job_list):
        job_map[job.id] = (idx, job)
        deps: set[str] = set()
        for dep in job.depends_on:
            if not isinstance(dep, str) or not dep or dep not in seen_ids:
                raise ScheduleError(
                    f"Job {job.id!r} depends on unknown job: {dep!r}"
                )
            deps.add(dep)
        in_degree[job.id] = len(deps)
        for dep in deps:
            dependents[dep].append(job.id)

    # 3. Initialize ready queue
    # Heap entry: (-priority, original_index, job_id)
    # This guarantees higher priority jobs run first, and ties are broken by original input order.
    ready_queue: list[tuple[float, int, str]] = []
    for idx, job in enumerate(job_list):
        if in_degree[job.id] == 0:
            heapq.heappush(ready_queue, (-job.priority, idx, job.id))

    # 4. Kahn's topological sort
    result: list[str] = []
    while ready_queue:
        _, _, job_id = heapq.heappop(ready_queue)
        result.append(job_id)
        for succ_id in dependents[job_id]:
            in_degree[succ_id] -= 1
            if in_degree[succ_id] == 0:
                succ_idx, succ_job = job_map[succ_id]
                heapq.heappush(ready_queue, (-succ_job.priority, succ_idx, succ_id))

    # 5. Check if all jobs were scheduled; detect and diagnose cycles if not
    if len(result) < len(job_list):
        diag = _diagnose_cycle(job_list, set(result))
        raise ScheduleError(diag)

    return result


