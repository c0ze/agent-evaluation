import re


def slugify(value: str) -> str:
    value = value.strip().lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def normalize_version(value: str) -> str:
    """Normalize ordinary dotted versions, preserving pre-release suffixes.

    Ordinary version strings are returned unchanged, matching the previous
    ``str(LooseVersion(...))`` output without the deprecated ``distutils``
    dependency.
    """
    return str(value)
