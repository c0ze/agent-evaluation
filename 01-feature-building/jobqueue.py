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
    raise NotImplementedError

