import re

from packaging.version import InvalidVersion, Version

__all__ = ["InvalidVersion", "normalize_version", "slugify"]


def slugify(value: str) -> str:
    value = value.strip().lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def normalize_version(value: str) -> str:
    """Normalize ordinary dotted versions, preserving pre-release suffixes."""
    return str(Version(value.strip()))

