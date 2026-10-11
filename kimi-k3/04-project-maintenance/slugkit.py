import re

from packaging.version import InvalidVersion, Version


def slugify(value: str) -> str:
    value = value.strip().lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def normalize_version(value: str) -> str:
    """Normalize ordinary dotted versions, preserving pre-release suffixes.

    Non-PEP 440 strings are returned unchanged, matching the previous
    distutils LooseVersion behavior of echoing the input back.
    """
    try:
        return str(Version(value))
    except InvalidVersion:
        return value
