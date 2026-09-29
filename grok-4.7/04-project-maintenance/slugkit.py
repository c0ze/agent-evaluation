import re

# Component splitter from distutils.version.LooseVersion, removed from the
# stdlib in Python 3.12. str() of that class returns the original spelling.
_COMPONENT_RE = re.compile(r"(\d+ | [a-z]+ | \.)", re.VERBOSE)


def slugify(value: str) -> str:
    value = value.strip().lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


class _LooseVersion:
    """String-form stand-in for ``distutils.version.LooseVersion``.

    Numeric and alphabetic pieces are parsed, and ``str()`` returns the
    caller's spelling. Ordinary versions therefore keep leading zeros and
    pre-release suffixes.
    """

    def __init__(self, vstring: str | None = None) -> None:
        if vstring:
            self.parse(vstring)

    def parse(self, vstring: str) -> None:
        self.vstring = vstring
        components: list[int | str] = [
            part for part in _COMPONENT_RE.split(vstring) if part and part != "."
        ]
        for index, part in enumerate(components):
            try:
                components[index] = int(part)
            except ValueError:
                pass
        self.version = components

    def __str__(self) -> str:
        return self.vstring


def normalize_version(value: str) -> str:
    """Normalize ordinary dotted versions, preserving pre-release suffixes."""
    return str(_LooseVersion(value))
