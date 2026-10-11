import re

_VERSION_COMPONENT_RE = re.compile(r"(\d+|[a-z]+|\.)")


def slugify(value: str) -> str:
    value = value.strip().lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def normalize_version(value: str) -> str:
    """Normalize ordinary dotted versions, preserving pre-release suffixes.

    Previously this used ``distutils.version.LooseVersion``, which was removed
    from the standard library in Python 3.12. That parser split the input into
    numeric/alphabetic components and returned the original string unchanged
    whenever parsing succeeded, raising ``ValueError`` when the string held no
    version components at all. This implementation keeps that contract, so
    ordinary versions (``1.2.0``) and pre-release forms (``2.0rc1``) are
    returned verbatim, and empty or component-free input is still rejected.
    """
    if not isinstance(value, str):
        raise TypeError(f"version must be a str, not {type(value).__name__}")
    components = [part for part in _VERSION_COMPONENT_RE.split(value) if part and part != "."]
    if not components:
        raise ValueError("empty version number")
    return value
