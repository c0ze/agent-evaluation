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
    if jobs is None:
        raise ScheduleError("jobs must be an iterable of Job, got None")
    try:
        job_list = list(jobs)
    except TypeError as exc:
        raise ScheduleError(f"jobs must be an iterable of Job: {exc}") from exc
    if not job_list:
        return []

    id_to_job: dict[str, Job] = {}
    id_to_index: dict[str, int] = {}
    id_to_priority: dict[str, int] = {}
    for index, job in enumerate(job_list):
        if not isinstance(job, Job):
            raise ScheduleError(f"item at index {index} is not a Job: {job!r}")
        jid = job.id
        if not isinstance(jid, str) or not jid:
            raise ScheduleError(
                f"job at index {index} has invalid id {jid!r}: must be a non-empty string"
            )
        if jid in id_to_job:
            raise ScheduleError(
                f"duplicate job id {jid!r} at index {index} "
                f"(first seen at index {id_to_index[jid]})"
            )
        id_to_job[jid] = job
        id_to_index[jid] = index
        id_to_priority[jid] = job.priority

    indegree: dict[str, int] = {jid: 0 for jid in id_to_job}
    dependents: dict[str, list[str]] = {jid: [] for jid in id_to_job}
    for job in job_list:
        raw = job.depends_on
        if raw is None:
            raise ScheduleError(
                f"job {job.id!r} has invalid depends_on None: must be an iterable of job IDs"
            )
        if isinstance(raw, (str, bytes)):
            raise ScheduleError(
                f"job {job.id!r} has invalid depends_on {raw!r}: "
                "must be an iterable of job IDs, not a string"
            )
        try:
            dep_list = list(raw)
        except TypeError as exc:
            raise ScheduleError(
                f"job {job.id!r} has invalid depends_on {raw!r}: must be an iterable of job IDs"
            ) from exc
        seen: set[str] = set()
        for dep in dep_list:
            if not isinstance(dep, str) or not dep:
                raise ScheduleError(
                    f"job {job.id!r} has invalid dependency {dep!r}: must be a non-empty string"
                )
            if dep not in id_to_job:
                raise ScheduleError(f"job {job.id!r} depends on unknown job {dep!r}")
            if dep in seen:
                continue
            seen.add(dep)
            indegree[job.id] += 1
            dependents[dep].append(job.id)

    ready = [jid for jid, deg in indegree.items() if deg == 0]
    result: list[str] = []
    while ready:
        best = max(ready, key=lambda jid: (id_to_priority[jid], -id_to_index[jid]))
        ready.remove(best)
        result.append(best)
        for child in dependents[best]:
            indegree[child] -= 1
            if indegree[child] == 0:
                ready.append(child)

    if len(result) != len(job_list):
        remaining = sorted(
            (jid for jid, deg in indegree.items() if deg > 0),
            key=lambda jid: id_to_index[jid],
        )
        detail = ", ".join(repr(j) for j in remaining)
        raise ScheduleError(f"dependency cycle detected involving: {detail}")

    return result
