import re

_VERSION_RE = re.compile(r"^\d+(?:\.\d+)*(?:[a-z]+\d*)?$", re.ASCII)


def slugify(value: str) -> str:
    value = value.strip().lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def normalize_version(value: str) -> str:
    """Normalize ordinary dotted versions, preserving pre-release suffixes.

    Accepts ordinary dotted versions with an optional lowercase pre-release
    suffix (for example ``1.2.0`` or ``2.0rc1``) and returns them unchanged,
    matching the output of the previous distutils-based implementation for
    such versions. Strings that do not follow this form raise ``ValueError``
    and non-string input raises ``TypeError``.
    """
    if not isinstance(value, str):
        raise TypeError(f"version must be str, not {type(value).__name__}")
    if _VERSION_RE.match(value) is None:
        raise ValueError(f"invalid version string: {value!r}")
    return value
