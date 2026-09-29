"""Small slug and version helpers."""

import re

__all__ = ["normalize_version", "slugify"]


def slugify(value: str) -> str:
    """Return a lowercase ASCII slug for ``value``.

    Surrounding whitespace is removed, the text is lower-cased, and every run of
    characters outside ``[a-z0-9]`` (whitespace, punctuation, underscores and any
    non-ASCII letters) becomes a single hyphen; leading and trailing hyphens are
    stripped.  Non-ASCII letters are dropped, not transliterated (a known
    limitation; see MAINTENANCE.md).
    """
    value = value.strip().lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def normalize_version(value: str) -> str:
    """Normalize ordinary dotted versions, preserving pre-release suffixes.

    Releases before 0.4.0 implemented this as
    ``str(distutils.version.LooseVersion(value))``.  ``LooseVersion.__str__``
    returns the string it was given, so for every non-empty string the result is
    the input itself: ``"1.2.0"`` -> ``"1.2.0"``, ``"2.0rc1"`` -> ``"2.0rc1"``,
    ``"1.0-rc1"`` -> ``"1.0-rc1"``.  ``distutils`` is deprecated since Python 3.10
    and absent from the standard library since Python 3.12, so that contract is
    now kept without it.  No PEP 440 canonicalisation is performed.

    Raises:
        TypeError: if ``value`` is not a ``str`` (unchanged from earlier releases).
        ValueError: if ``value`` is empty (earlier releases let an
            ``AttributeError`` escape from ``distutils``).
    """
    if not isinstance(value, str):
        raise TypeError(f"version must be a str, not {type(value).__name__}")
    if not value:
        raise ValueError("version string must not be empty")
    return value
