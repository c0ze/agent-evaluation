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
    """Return job IDs in a valid deterministic execution order."""
    import heapq

    try:
        ordered = list(jobs)
    except TypeError:
        raise ScheduleError("jobs must be an iterable of Job")
    if not ordered:
        return []
    for j in ordered:
        if not isinstance(j, Job):
            raise ScheduleError(f"expected Job instance, got {type(j).__name__}")
        if not isinstance(j.id, str) or not j.id:
            raise ScheduleError(f"job id must be a non-empty string, got {j.id!r}")

    ids = [j.id for j in ordered]
    seen: set[str] = set()
    dupes: set[str] = set()
    for i in ids:
        if i in seen:
            dupes.add(i)
        seen.add(i)
    if dupes:
        raise ScheduleError(f"duplicate job ids: {sorted(dupes)}")

    by_id = {j.id: j for j in ordered}
    deps: dict[str, list[str]] = {}
    for j in ordered:
        try:
            ds = list(j.depends_on)
        except TypeError:
            raise ScheduleError(f"job {j.id!r} has invalid depends_on")
        for d in ds:
            if d not in by_id:
                raise ScheduleError(f"job {j.id!r} depends on unknown job {d!r}")
        deps[j.id] = sorted(set(ds))

    dependents: dict[str, list[str]] = {i: [] for i in ids}
    indegree = {i: len(deps[i]) for i in ids}
    for jid, ds in deps.items():
        for d in ds:
            dependents[d].append(jid)

    index = {jid: n for n, jid in enumerate(ids)}
    heap: list[tuple[int, int, str]] = [
        (-by_id[jid].priority, index[jid], jid)
        for jid in ids
        if indegree[jid] == 0
    ]
    heapq.heapify(heap)
    result: list[str] = []
    while heap:
        _, _, jid = heapq.heappop(heap)
        result.append(jid)
        for dep_id in dependents[jid]:
            indegree[dep_id] -= 1
            if indegree[dep_id] == 0:
                heapq.heappush(
                    heap,
                    (-by_id[dep_id].priority, index[dep_id], dep_id),
                )
    if len(result) != len(ids):
        stuck = sorted(j for j in ids if indegree[j] > 0)
        raise ScheduleError(f"dependency cycle detected among: {stuck}")
    return result

