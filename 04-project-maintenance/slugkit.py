import re


def slugify(value: str) -> str:
    value = value.strip().lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def normalize_version(value: str) -> str:
    """Normalize ordinary dotted versions, preserving pre-release suffixes.

    The previous implementation returned ``str(LooseVersion(value))``.
    ``LooseVersion`` parsed the input for comparisons, but its string form
    always returned the original spelling, so this keeps that observable
    behavior (for example, ``"2.0rc1"`` stays ``"2.0rc1"``) without the
    deprecated ``distutils`` dependency.
    """
    return value
