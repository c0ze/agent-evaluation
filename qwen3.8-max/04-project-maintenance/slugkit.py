import re


def slugify(value: str) -> str:
    value = value.strip().lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def normalize_version(value: str) -> str:
    """Normalize ordinary dotted versions, preserving pre-release suffixes.

    Historically implemented as ``str(distutils.version.LooseVersion(value))``.
    ``LooseVersion.__str__`` returned the version string it was given
    unchanged, so for ordinary versions this function returns ``value`` as-is;
    that observable behavior is preserved. ``distutils`` is deprecated since
    Python 3.10 and removed in Python 3.12, so this replacement is
    dependency-free and raises explicit errors for degenerate input.
    """
    if not isinstance(value, str):
        raise TypeError(f"version must be a string, got {type(value).__name__}")
    if not value:
        raise ValueError("version string must not be empty")
    return value
