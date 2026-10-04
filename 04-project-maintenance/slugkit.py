"""Small slug and version helpers.

The version helper intentionally avoids :mod:`distutils`, which is deprecated
and no longer importable on the Python versions this package supports.
"""

import re

__all__ = ["normalize_version", "slugify"]

#: Any run of characters that is not a lowercase ASCII letter or digit.
_NON_SLUG = re.compile(r"[^a-z0-9]+")

#: Characters accepted in a version string. Deliberately permissive: the old
#: implementation accepted anything, and staying permissive keeps inputs that
#: used to be accepted still accepted.
_VERSION_CHARS = re.compile(r"\A[0-9A-Za-z.+_-]+\Z")

#: A leading "v" is conventional in VCS tags (``git tag v0.4.0``).
_TAG_PREFIXES = ("v", "V")


def slugify(value: str) -> str:
    """Return *value* lowercased with runs of non-alphanumerics collapsed to "-".

    Known limitation: non-ASCII letters are dropped rather than transliterated,
    so ``"café"`` becomes ``"caf"``. This is unchanged in 0.4.0.
    """
    value = value.strip().lower()
    return _NON_SLUG.sub("-", value).strip("-")


def normalize_version(value: str) -> str:
    """Normalize an ordinary dotted version, preserving pre-release suffixes.

    ``normalize_version("1.2.0")`` and ``normalize_version("2.0rc1")`` are
    unchanged from the previous implementation: ``distutils.version.LooseVersion``
    tokenized its input for comparison only, and on the Python versions this
    package supports its ``__str__`` returned the original string unchanged.
    Re-deriving the string from those tokens would silently drop separators
    from valid forms such as ``"1.0.post1"`` or ``"1.0.dev4"``, so this
    function instead validates the input and returns it.

    Two conveniences are added, neither of which affects ordinary versions:
    surrounding whitespace is stripped, and a single leading ``"v"`` (as in a
    VCS tag) is removed.

    Raises:
        TypeError: if *value* is not a :class:`str`.
        ValueError: if *value* is empty or is not plausibly a version.
    """
    if not isinstance(value, str):
        raise TypeError(f"version must be a str, not {type(value).__name__}")

    version = value.strip()
    if version[:1] in _TAG_PREFIXES:
        version = version[1:]

    if not _VERSION_CHARS.match(version) or not any(ch.isdigit() for ch in version):
        raise ValueError(f"not a version string: {value!r}")

    return version
