import re


def slugify(value: str) -> str:
    value = value.strip().lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def normalize_version(value: str) -> str:
    """Normalize ordinary dotted versions, preserving pre-release suffixes.

    Up to 0.3.x this returned ``str(distutils.version.LooseVersion(value))``.
    ``LooseVersion.__str__`` returns the string it was given, so for any
    non-empty string the result was the input unchanged (``"1.02"`` stays
    ``"1.02"``, ``"2.0rc1"`` stays ``"2.0rc1"``). That contract is kept here
    without ``distutils``, which is deprecated and was removed from the
    standard library in Python 3.12.

    ``packaging.version`` is deliberately not used: it applies PEP 440
    normalization (``"1.02"`` -> ``"1.2"``) and rejects many strings that
    LooseVersion accepted, which would change observable output.

    Degenerate inputs now fail with clear errors instead of the incidental
    ones LooseVersion produced: a non-string raises ``TypeError`` (previously
    ``TypeError`` for truthy values, ``AttributeError`` for ``None``), and an
    empty string raises ``ValueError`` (previously ``AttributeError``).
    """
    if not isinstance(value, str):
        raise TypeError(f"version must be a str, not {type(value).__name__}")
    if not value:
        raise ValueError("version must be a non-empty string")
    return value
