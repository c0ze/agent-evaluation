"""Small slug and version helpers."""

import re

from packaging.version import InvalidVersion, Version


def slugify(value: str) -> str:
    value = value.strip().lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def normalize_version(value: str) -> str:
    """Normalize ordinary dotted versions, preserving pre-release suffixes.

    This used to return ``str(distutils.version.LooseVersion(value))``.
    ``distutils`` was removed from the standard library in Python 3.12, and
    ``LooseVersion.__str__`` simply returned the original ``vstring`` verbatim,
    so for any non-empty input the result was always ``value`` itself (including
    suffixes such as ``2.0rc1``).

    We keep that contract. The version is parsed with the maintained
    :class:`packaging.version.Version` (the replacement recommended by the
    distutils deprecation warning), but the original text is returned. Returning
    ``str(Version(value))`` would canonicalize the string and change observable
    behavior for ordinary versions, e.g. ``"1.02" -> "1.2"``, ``"v1.2" ->
    "1.2"``, or ``"1.2.0-beta" -> "1.2.0b0"``.

    Inputs that are not valid PEP 440 versions are passed through unchanged,
    matching the old permissive ``LooseVersion`` behavior.
    """
    try:
        Version(value)
    except InvalidVersion:
        pass  # non-PEP 440 text: keep the old LooseVersion passthrough behavior
    return value
