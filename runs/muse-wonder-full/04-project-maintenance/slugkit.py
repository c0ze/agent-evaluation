import re

from packaging.version import Version


def slugify(value: str) -> str:
    value = value.strip().lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def normalize_version(value: str) -> str:
    """Normalize ordinary dotted versions, preserving pre-release suffixes.

    Uses PEP 440 normalization via ``packaging.version.Version``. For
    ordinary versions this matches the former ``LooseVersion`` string
    output (for example ``"1.2.0"`` and ``"2.0rc1"`` are unchanged).

    Unlike ``LooseVersion``, non-PEP-440 inputs raise
    ``packaging.version.InvalidVersion`` (a ``ValueError``) instead of
    being accepted verbatim, and spellings such as ``"v1.2"`` or
    ``"1.02"`` are normalized to ``"1.2"``.
    """
    return str(Version(value))
