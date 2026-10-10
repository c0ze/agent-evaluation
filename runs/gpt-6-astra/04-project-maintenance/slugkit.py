import re


def slugify(value: str) -> str:
    value = value.strip().lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def normalize_version(value: str) -> str:
    """Preserve a version string's spelling, including pre-release suffixes.

    The former LooseVersion conversion returned the original spelling rather
    than a canonical form. This helper does not validate or compare versions.
    """
    return value
