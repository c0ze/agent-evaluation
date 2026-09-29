import heapq
import numbers
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


def _validate(jobs: Iterable[Job]) -> tuple[list[Job], list[tuple[str, ...]]]:
    """Materialise ``jobs`` once and check every input rule.

    Returns the jobs in input order together with a normalised (tuple) copy of
    each job's dependencies, so ``depends_on`` is read exactly once even if the
    caller supplied a one-shot iterable.
    """
    job_list = list(jobs)
    seen: set[str] = set()
    for position, job in enumerate(job_list):
        if not isinstance(job, Job):
            raise ScheduleError(
                f"item at position {position} is not a Job: {job!r}"
            )
        if not isinstance(job.id, str) or not job.id:
            raise ScheduleError(
                f"job at position {position} must have a non-empty string id, "
                f"got {job.id!r}"
            )
        if job.id in seen:
            raise ScheduleError(f"duplicate job id: {job.id!r}")
        seen.add(job.id)
        if (
            not isinstance(job.priority, numbers.Real)
            or job.priority != job.priority  # NaN has no defined ordering
        ):
            raise ScheduleError(
                f"job {job.id!r} has an invalid priority: {job.priority!r}"
            )

    deps_by_job: list[tuple[str, ...]] = []
    for job in job_list:
        raw = job.depends_on
        if isinstance(raw, (str, bytes)):
            # A bare string would silently be iterated character by character.
            raise ScheduleError(
                f"job {job.id!r}: depends_on must be a collection of job ids, "
                f"not a single string ({raw!r})"
            )
        try:
            deps = tuple(raw)
        except TypeError:
            raise ScheduleError(
                f"job {job.id!r}: depends_on must be iterable, got {raw!r}"
            ) from None
        for dep in deps:
            if not isinstance(dep, str):
                raise ScheduleError(
                    f"job {job.id!r} has a non-string dependency: {dep!r}"
                )
            if dep not in seen:
                raise ScheduleError(
                    f"job {job.id!r} depends on unknown job {dep!r}"
                )
        deps_by_job.append(deps)
    return job_list, deps_by_job


def _find_cycle(
    stuck: set[int],
    deps_by_job: list[tuple[str, ...]],
    index_of: dict[str, int],
) -> list[int]:
    """Return the indices of one dependency cycle among the ``stuck`` jobs.

    Every stuck job still has at least one unfinished dependency, and that
    dependency is itself stuck.  Walking "depends on" edges from any stuck job
    therefore has to revisit a job, which closes a cycle.  The walk starts at
    the earliest stuck job and follows the earliest listed stuck dependency, so
    the reported cycle is deterministic.
    """
    start = min(stuck)
    path: list[int] = []
    position: dict[int, int] = {}
    node = start
    while node not in position:
        position[node] = len(path)
        path.append(node)
        node = next(
            index_of[dep] for dep in deps_by_job[node] if index_of[dep] in stuck
        )
    return path[position[node]:]


def plan_jobs(jobs: Iterable[Job]) -> list[str]:
    """Return job IDs in a valid deterministic execution order.

    Every job appears exactly once, after all of its dependencies.  Whenever
    several jobs are ready at the same time the one with the highest
    ``priority`` runs first, and equal priorities fall back to input order.

    Raises ``ScheduleError`` for malformed input (non-Job items, empty or
    non-string or duplicate ids, unknown dependencies, invalid priorities) and
    for dependency cycles.  The supplied jobs are never modified.
    """
    job_list, deps_by_job = _validate(jobs)
    index_of = {job.id: i for i, job in enumerate(job_list)}

    # Kahn's algorithm.  Duplicate entries in one depends_on collapse, so a job
    # is counted once per distinct dependency.
    unmet = [0] * len(job_list)
    dependents: list[list[int]] = [[] for _ in job_list]
    for i, deps in enumerate(deps_by_job):
        for dep in set(deps):
            unmet[i] += 1
            dependents[index_of[dep]].append(i)

    # heapq is a min-heap: negate priority so the highest priority pops first
    # and use the input index as the tie-breaker.
    ready = [(-job_list[i].priority, i) for i in range(len(job_list)) if not unmet[i]]
    heapq.heapify(ready)

    order: list[str] = []
    while ready:
        _, i = heapq.heappop(ready)
        order.append(job_list[i].id)
        for child in dependents[i]:
            unmet[child] -= 1
            if not unmet[child]:
                heapq.heappush(ready, (-job_list[child].priority, child))

    if len(order) != len(job_list):
        stuck = {i for i, count in enumerate(unmet) if count}
        cycle = _find_cycle(stuck, deps_by_job, index_of)
        ids = [job_list[i].id for i in cycle]
        chain = " -> ".join(repr(x) for x in [*ids, ids[0]])
        blocked = len(stuck) - len(cycle)
        message = f"dependency cycle detected: {chain}"
        if blocked:
            message += f" ({blocked} more job(s) are blocked behind it)"
        raise ScheduleError(message)

    return order

