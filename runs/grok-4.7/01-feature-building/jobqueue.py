import heapq
from collections.abc import Iterable
from dataclasses import dataclass, field
from typing import Any


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
    try:
        job_list = list(jobs)
    except TypeError as exc:
        raise ScheduleError("jobs must be an iterable of Job") from exc

    if not job_list:
        return []

    # Snapshot every field we need so later scheduling never touches the
    # caller's Job objects or their dependency collections again.
    parsed: list[tuple[str, Any, tuple[Any, ...]]] = []
    positions: dict[str, int] = {}
    for index, job in enumerate(job_list):
        try:
            job_id = job.id
            priority = job.priority
            depends_on = job.depends_on
        except AttributeError as exc:
            raise ScheduleError(f"invalid job at index {index}: {exc}") from exc
        if not isinstance(job_id, str) or job_id == "":
            raise ScheduleError(
                f"job id must be a non-empty string, got {job_id!r}"
            )
        if job_id in positions:
            raise ScheduleError(f"duplicate job id {job_id!r}")
        positions[job_id] = index
        parsed.append((job_id, priority, _snapshot_dependencies(job_id, depends_on)))

    dependencies: dict[str, list[str]] = {}
    dependents: dict[str, list[str]] = {job_id: [] for job_id, _, _ in parsed}
    indegree: dict[str, int] = {}
    for job_id, _priority, raw_deps in parsed:
        # A repeated prerequisite is one edge. Counting it twice would leave
        # the dependent with a leftover indegree and look like a cycle.
        unique: list[str] = []
        seen: set[str] = set()
        for dep in raw_deps:
            if not isinstance(dep, str) or dep not in positions:
                raise ScheduleError(
                    f"job {job_id!r} depends on unknown job {dep!r}"
                )
            if dep in seen:
                continue
            seen.add(dep)
            unique.append(dep)
        dependencies[job_id] = unique
        indegree[job_id] = len(unique)
        for dep in unique:
            dependents[dep].append(job_id)

    # (-priority, input index, id): min-heap pops the highest priority, and
    # for equal priorities the earliest job in the original input.
    ready: list[tuple[Any, int, str]] = []
    for job_id, priority, _raw_deps in parsed:
        if indegree[job_id] == 0:
            _push_ready(ready, priority, positions[job_id], job_id)

    order: list[str] = []
    while ready:
        _neg_priority, _index, job_id = heapq.heappop(ready)
        order.append(job_id)
        for child_id in dependents[job_id]:
            indegree[child_id] -= 1
            if indegree[child_id] == 0:
                child_priority = parsed[positions[child_id]][1]
                _push_ready(ready, child_priority, positions[child_id], child_id)

    if len(order) == len(parsed):
        return order

    scheduled = set(order)
    remaining = [job_id for job_id, _, _ in parsed if job_id not in scheduled]
    cyclic = _cyclic_ids(remaining, dependencies)
    involved = cyclic or remaining
    rendered = ", ".join(repr(job_id) for job_id in involved)
    raise ScheduleError(f"dependency cycle detected involving {rendered}")


def _snapshot_dependencies(job_id: str, depends_on: Any) -> tuple[Any, ...]:
    """Copy dependency ids without mutating or re-reading the caller's collection."""
    if isinstance(depends_on, (str, bytes, bytearray)):
        raise ScheduleError(
            f"job {job_id!r} depends_on must be a collection of job ids, "
            f"not {type(depends_on).__name__}"
        )
    try:
        return tuple(depends_on)
    except TypeError as exc:
        raise ScheduleError(
            f"job {job_id!r} depends_on must be a collection of job ids"
        ) from exc


def _push_ready(
    ready: list[tuple[Any, int, str]], priority: Any, index: int, job_id: str
) -> None:
    try:
        heapq.heappush(ready, (-priority, index, job_id))
    except TypeError as exc:
        raise ScheduleError(
            f"job {job_id!r} priority must be an ordered number, got {priority!r}"
        ) from exc


def _cyclic_ids(
    nodes: list[str], dependencies: dict[str, list[str]]
) -> list[str]:
    """Return cycle participants in input order.

    Strongly connected components of size greater than one, plus self-loops,
    are the jobs on a cycle. A job that only waits on a cycle is omitted.
    """
    node_set = set(nodes)
    forward: dict[str, list[str]] = {}
    reverse: dict[str, list[str]] = {node: [] for node in nodes}
    self_loops: set[str] = set()
    for node in nodes:
        deps: list[str] = []
        for dep in dependencies.get(node, ()):
            if dep not in node_set:
                continue
            if dep == node:
                self_loops.add(node)
            deps.append(dep)
            reverse[dep].append(node)
        forward[node] = deps

    seen: set[str] = set()
    finish: list[str] = []
    for start in nodes:
        if start in seen:
            continue
        stack = [(start, 0)]
        seen.add(start)
        while stack:
            node, cursor = stack[-1]
            children = forward[node]
            if cursor < len(children):
                child = children[cursor]
                stack[-1] = (node, cursor + 1)
                if child not in seen:
                    seen.add(child)
                    stack.append((child, 0))
            else:
                finish.append(node)
                stack.pop()

    seen.clear()
    cyclic: set[str] = set()
    for start in reversed(finish):
        if start in seen:
            continue
        component: list[str] = []
        stack_nodes = [start]
        seen.add(start)
        while stack_nodes:
            node = stack_nodes.pop()
            component.append(node)
            for parent in reverse[node]:
                if parent not in seen:
                    seen.add(parent)
                    stack_nodes.append(parent)
        if len(component) > 1 or any(node in self_loops for node in component):
            cyclic.update(component)

    return [node for node in nodes if node in cyclic]
