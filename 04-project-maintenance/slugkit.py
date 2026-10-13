import re

_VERSION_RE = re.compile(
    r"^[vV]?\d+(?:\.\d+)*"
    r"(?:[-._]?(?:a|b|c|rc|alpha|beta|pre|preview|post|rev|r|dev)[-._]?\d*){0,2}"
    r"(?:\+[A-Za-z0-9]+(?:[-._][A-Za-z0-9]+)*)?$"
)


def slugify(value: str) -> str:
    value = value.strip().lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def normalize_version(value: str) -> str:
    """Normalize ordinary dotted versions, preserving pre-release suffixes.

    Surrounding whitespace is stripped. Valid ordinary versions are
    returned unchanged, so output matches the previous implementation
    for inputs such as ``1.2.0`` and ``2.0rc1``.

    Raises:
        ValueError: If ``value`` is not an ordinary version string.
    """
    normalized = value.strip()
    if not _VERSION_RE.match(normalized):
        raise ValueError(f"Invalid version: {value!r}")
    return normalized
