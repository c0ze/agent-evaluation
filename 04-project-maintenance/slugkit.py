import re


def slugify(value: str) -> str:
    value = value.strip().lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def normalize_version(value: str) -> str:
    """Normalize ordinary dotted versions, preserving pre-release suffixes.

    The version text is returned exactly as given ("1.2.0" -> "1.2.0",
    "2.0rc1" -> "2.0rc1"), which is what the previous
    ``str(distutils.version.LooseVersion(value))`` implementation produced:
    ``LooseVersion`` kept the original string for ``__str__`` and never
    rewrote it. ``distutils`` was removed from the standard library in
    Python 3.12, so the round-trip is gone and only the input checks remain.

    Raises ``TypeError`` for non-string input and ``ValueError`` for an empty
    string.
    """
    if not isinstance(value, str):
        raise TypeError(f"version must be a str, not {type(value).__name__}")
    if not value:
        raise ValueError("version must be a non-empty string")
    return value
