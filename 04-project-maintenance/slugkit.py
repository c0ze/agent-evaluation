"""Small slug and version helpers."""

import re


def slugify(value: str) -> str:
    value = value.strip().lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def normalize_version(value: str) -> str:
    """Normalize ordinary dotted versions, preserving pre-release suffixes.

    This previously delegated to ``distutils.version.LooseVersion``, which was
    removed from the standard library in Python 3.12. ``LooseVersion.__str__``
    returned the input string verbatim, so ordinary versions such as ``"1.2.0"``
    and ``"2.0rc1"`` round-trip unchanged; this implementation preserves that
    observable behavior without any dependency on ``distutils``.
    """
    return value
