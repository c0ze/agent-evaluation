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


def plan_jobs(jobs: Iterable[Job]) -> list[str]:
    """Return job IDs in a valid, deterministic execution order.

    Kahn's algorithm drives the ordering.  A heap holds exactly the jobs that
    are *currently* ready (all of their dependencies have already run); its key
    is ``(-priority, input_position)``, so the highest priority runs first and
    ties fall back to the order jobs were supplied in.  Newly-unblocked jobs
    are pushed onto the heap as each job completes, so readiness is always
    re-evaluated at selection time.
    """
    jobs = list(jobs)
    if not jobs:
        return []

    # --- Validate jobs and ids ------------------------------------------------
    ids = []                 # ids in original input order
    index_of = {}            # id -> position in input
    for pos, job in enumerate(jobs):
        if not isinstance(job, Job):
            raise ScheduleError(f"item at position {pos} is not a Job: {job!r}")
        jid = job.id
        if not isinstance(jid, str) or jid.strip() == "":
            raise ScheduleError(
                f"job at position {pos} has invalid id {jid!r}: "
                "id must be a non-empty string"
            )
        if jid in index_of:
            raise ScheduleError(
                f"duplicate job id {jid!r} "
                f"(positions {index_of[jid]} and {pos})"
            )
        index_of[jid] = pos
        ids.append(jid)

    id_set = set(ids)

    # --- Validate dependencies; snapshot them without mutating inputs --------
    # Each dependency list is copied into a de-duplicated tuple.  Duplicated
    # dependency entries are harmless, so they are collapsed to one edge.
    deps = {}                # id -> tuple of dependency ids
    for job in jobs:
        try:
            raw = tuple(job.depends_on)
        except TypeError:
            raise ScheduleError(
                f"job {job.id!r} has a non-iterable depends_on: "
                f"{job.depends_on!r}"
            ) from None
        ordered = []
        seen = set()
        for dep in raw:
            if not isinstance(dep, str):
                raise ScheduleError(
                    f"job {job.id!r} has a non-string dependency {dep!r}"
                )
            if dep not in id_set:
                raise ScheduleError(
                    f"job {job.id!r} depends on unknown job {dep!r}; "
                    "no such job was supplied"
                )
            if dep not in seen:
                seen.add(dep)
                ordered.append(dep)
        deps[job.id] = tuple(ordered)

    # --- Build the dependency graph ------------------------------------------
    in_degree = {jid: len(deps[jid]) for jid in ids}
    dependents = {jid: [] for jid in ids}
    for jid in ids:
        for dep in deps[jid]:
            dependents[dep].append(jid)

    heap = []

    def push_ready(jid):
        pos = index_of[jid]
        heapq.heappush(heap, (-jobs[pos].priority, pos, jid))

    for jid in ids:
        if in_degree[jid] == 0:
            push_ready(jid)

    # --- Emit the order -------------------------------------------------------
    order = []
    while heap:
        _neg_priority, _pos, jid = heapq.heappop(heap)
        order.append(jid)
        for child in dependents[jid]:
            in_degree[child] -= 1
            if in_degree[child] == 0:
                push_ready(child)

    # --- Anything left over is part of, or blocked by, a dependency cycle ----
    if len(order) != len(ids):
        cycle = _find_cycle(ids, deps, set(order))
        raise ScheduleError(
            f"dependency cycle detected; {len(ids) - len(order)} job(s) "
            f"cannot be scheduled. Cycle: {' -> '.join(cycle)}"
        )
    return order


def _find_cycle(ids, deps, scheduled):
    """Return one cycle as an id path that ends where it started.

    Only unscheduled jobs are considered.  Every unscheduled job still has at
    least one unscheduled dependency, so following dependency edges must close
    a loop; an iterative DFS finds one and reports the concrete ids involved.
    """
    remaining = [jid for jid in ids if jid not in scheduled]
    remaining_set = set(remaining)
    adj = {
        jid: [d for d in deps[jid] if d in remaining_set]
        for jid in remaining
    }
    color = {}               # absent/0 = unseen, 1 = on stack, 2 = done
    for start in remaining:
        if color.get(start, 0) != 0:
            continue
        color[start] = 1
        path = [start]
        stack = [(start, iter(adj[start]))]
        while stack:
            node, neighbours = stack[-1]
            nxt = next(neighbours, None)
            if nxt is None:
                color[node] = 2
                stack.pop()
                path.pop()
                continue
            state = color.get(nxt, 0)
            if state == 0:
                color[nxt] = 1
                stack.append((nxt, iter(adj[nxt])))
                path.append(nxt)
            elif state == 1:
                return path[path.index(nxt):] + [nxt]
    return remaining          # defensive fallback; invariant makes it unreachable
