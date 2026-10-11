import re


def slugify(value: str) -> str:
    value = value.strip().lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def normalize_version(value: str) -> str:
    """Return the version string unchanged, including pre-release suffixes such as ``2.0rc1``."""
    return value

