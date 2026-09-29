import re


def slugify(value: str) -> str:
    value = value.strip().lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def normalize_version(value: str) -> str:
    """Return a version string in the form ``slugkit`` has always returned it.

    This replaces ``str(distutils.version.LooseVersion(value))``. ``distutils`` was
    removed from the standard library in Python 3.12, and ``LooseVersion`` only
    ever handed back the string it was given, so the same result is produced here
    without a parser: ordinary versions such as ``"1.2.0"`` and pre-release
    versions such as ``"2.0rc1"`` are returned unchanged. No canonicalisation is
    applied, so ``"1.0-rc1"`` stays ``"1.0-rc1"``.

    ``TypeError`` is raised for non-string input and ``ValueError`` for an empty
    string (the old implementation raised ``AttributeError`` for the latter).
    """
    if not isinstance(value, str):
        raise TypeError(f"version must be a str, not {type(value).__name__}")
    if not value:
        raise ValueError("version must not be empty")
    return value
