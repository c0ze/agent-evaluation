from dataclasses import dataclass, field
from heapq import heappop, heappush
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

    Ready jobs are selected by descending priority, ties broken by original
    input order. Dependencies always precede dependents. Invalid input and
    dependency cycles raise ScheduleError.
    """
    job_list = list(jobs)
    if not job_list:
        return []

    order: dict[str, int] = {}
    by_id: dict[str, Job] = {}
    for index, job in enumerate(job_list):
        jid = job.id
        if not isinstance(jid, str) or not jid:
            raise ScheduleError(f"job id must be a non-empty string, got {jid!r}")
        if jid in by_id:
            raise ScheduleError(f"duplicate job id: {jid!r}")
        by_id[jid] = job
        order[jid] = index

    for job in job_list:
        for dep in job.depends_on:
            if dep not in by_id:
                raise ScheduleError(
                    f"job {job.id!r} depends on unknown job {dep!r}"
                )

    dependents: dict[str, list[str]] = {jid: [] for jid in by_id}
    pending: dict[str, int] = {}
    for job in job_list:
        unique_deps = set(job.depends_on)
        pending[job.id] = len(unique_deps)
        for dep in unique_deps:
            dependents[dep].append(job.id)

    ready: list[tuple[int, int, str]] = []
    for jid, count in pending.items():
        if count == 0:
            heappush(ready, (-by_id[jid].priority, order[jid], jid))

    result: list[str] = []
    while ready:
        _, _, jid = heappop(ready)
        result.append(jid)
        for dependent in dependents[jid]:
            pending[dependent] -= 1
            if pending[dependent] == 0:
                heappush(
                    ready,
                    (-by_id[dependent].priority, order[dependent], dependent),
                )

    if len(result) != len(by_id):
        stuck = [jid for jid in order if pending[jid] > 0]
        cycle = _cycle_members(stuck, by_id)
        raise ScheduleError(
            "dependency cycle detected involving: " + ", ".join(cycle)
        )

    return result


def _cycle_members(stuck: list[str], by_id: dict[str, Job]) -> list[str]:
    """Return stuck IDs that can reach themselves; fall back to all stuck IDs."""
    stuck_set = set(stuck)
    members: list[str] = []
    for start in stuck:
        stack = [d for d in by_id[start].depends_on if d in stuck_set]
        seen: set[str] = set()
        while stack:
            node = stack.pop()
            if node == start:
                members.append(start)
                break
            if node in seen:
                continue
            seen.add(node)
            stack.extend(d for d in by_id[node].depends_on if d in stuck_set)
    return members or stuck
