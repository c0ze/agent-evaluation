import re

from packaging.version import InvalidVersion, Version


def slugify(value: str) -> str:
    value = value.strip().lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def normalize_version(value: str) -> str:
    """Normalize ordinary dotted versions, preserving pre-release suffixes."""
    try:
        return str(Version(value))
    except InvalidVersion:
        # Preserve observable behavior for ordinary dotted versions.
        # Anything we cannot parse is surfaced to the caller unchanged.
        return value