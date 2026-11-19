import re

from packaging.version import InvalidVersion, Version


def slugify(value: str) -> str:
    value = value.strip().lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def normalize_version(value: str) -> str:
    """Normalize ordinary dotted versions, preserving pre-release suffixes.

    Replaces the deprecated ``distutils.version.LooseVersion``. For ordinary
    versions the canonical form returned by ``packaging.version.Version`` is
    identical to the legacy output. Inputs that ``Version`` cannot parse are
    returned unchanged, matching ``LooseVersion``'s permissive behaviour.
    """
    try:
        return str(Version(value))
    except InvalidVersion:
        return value
