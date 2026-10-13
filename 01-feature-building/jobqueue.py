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
    """Return job IDs in a valid deterministic execution order."""
    # Materialize without mutating the caller's iterable contents.
    job_list = list(jobs)

    if not job_list:
        return []

    # Validate IDs: non-empty strings and unique.
    index_by_id: dict[str, int] = {}
    for idx, job in enumerate(job_list):
        jid = job.id
        if not isinstance(jid, str) or not jid:
            raise ScheduleError(
                f"job at position {idx} has invalid id {jid!r}: "
                "id must be a non-empty string"
            )
        if jid in index_by_id:
            raise ScheduleError(f"duplicate job id: {jid!r}")
        index_by_id[jid] = idx

    # Validate dependencies and build graph copies (never mutate inputs).
    # dependents[dep] = list of job indices that depend on dep
    # indegree[i] = number of distinct dependencies of job i
    n = len(job_list)
    dependents: list[list[int]] = [[] for _ in range(n)]
    indegree: list[int] = [0] * n
    deps_by_index: list[tuple[str, ...]] = []

    for idx, job in enumerate(job_list):
        # Copy depends_on to a tuple to avoid mutating caller's sequence.
        try:
            raw_deps = tuple(job.depends_on)
        except TypeError:
            raise ScheduleError(
                f"job {job.id!r} has invalid depends_on {job.depends_on!r}: "
                "must be an iterable of job ids"
            ) from None
        deps_by_index.append(raw_deps)
        seen: set[str] = set()
        for dep in raw_deps:
            if not isinstance(dep, str) or not dep:
                raise ScheduleError(
                    f"job {job.id!r} has invalid dependency {dep!r}: "
                    "dependency must be a non-empty string naming a supplied job"
                )
            if dep not in index_by_id:
                raise ScheduleError(
                    f"job {job.id!r} depends on unknown job {dep!r}"
                )
            if dep in seen:
                continue
            seen.add(dep)
            dep_idx = index_by_id[dep]
            dependents[dep_idx].append(idx)
            indegree[idx] += 1

    # Kahn's algorithm with a priority heap over ready jobs.
    # Heap key: (-priority, input_index) so higher priority wins,
    # ties broken by original input order.
    heap: list[tuple[int, int, str]] = []
    for idx, job in enumerate(job_list):
        if indegree[idx] == 0:
            heapq.heappush(heap, (-job.priority, idx, job.id))

    result: list[str] = []
    while heap:
        _, idx, jid = heapq.heappop(heap)
        result.append(jid)
        for dep_idx in dependents[idx]:
            indegree[dep_idx] -= 1
            if indegree[dep_idx] == 0:
                dep_job = job_list[dep_idx]
                heapq.heappush(heap, (-dep_job.priority, dep_idx, dep_job.id))

    if len(result) != n:
        scheduled = set(result)
        remaining = [job.id for job in job_list if job.id not in scheduled]
        # Try to narrow to jobs actually on a cycle via iterative pruning:
        # Remaining set already excludes jobs schedulable before the cycle;
        # jobs that merely depend on a cycle also remain. Report all
        # remaining IDs — that is practical and includes the cycle members.
        raise ScheduleError(
            "dependency cycle detected involving jobs: "
            + ", ".join(repr(jid) for jid in remaining)
        )

    return result
