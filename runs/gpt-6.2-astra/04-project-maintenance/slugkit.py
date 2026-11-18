import re


def slugify(value: str) -> str:
    value = value.strip().lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def normalize_version(value: str) -> str:
    """Preserve the original spelling of a version string, including its suffix."""
    return value
