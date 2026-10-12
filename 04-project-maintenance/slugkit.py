"""Small slug and version helpers."""

from __future__ import annotations

import re

__all__ = ["normalize_version", "slugify"]

_NON_SLUG_CHARS_RE = re.compile(r"[^a-z0-9]+")

# Digits, ASCII letters and the dots separating them: the same components
# ``distutils.version.LooseVersion`` used before it was removed from the
# stdlib in Python 3.12.
_VERSION_COMPONENT_RE = re.compile(r"[0-9]+|[a-z]+")


def slugify(value: str) -> str:
    """Lowercase ``value`` and collapse each run of punctuation into one ``-``."""
    return _NON_SLUG_CHARS_RE.sub("-", value.strip().lower()).strip("-")


def _version_components(value: str) -> list[int | str]:
    """Split ``value`` into its numeric and alphabetic version components."""
    components: list[int | str] = []
    for part in _VERSION_COMPONENT_RE.findall(value):
        try:
            components.append(int(part))
        except ValueError:
            components.append(part)
    return components


def normalize_version(value: str) -> str:
    """Normalize ordinary dotted versions, preserving pre-release suffixes.

    ``value`` is validated by parsing it into numeric and alphabetic components
    and is returned unchanged, so ``1.2.0`` stays ``1.2.0`` and ``2.0rc1`` keeps
    its pre-release suffix. Raises ``ValueError`` if the value contains no
    version components.
    """
    if not _version_components(value):
        raise ValueError(f"no version components in {value!r}")
    return value
