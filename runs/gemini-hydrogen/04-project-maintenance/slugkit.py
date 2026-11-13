import re

_PRE_LABELS = {
    "a": "a",
    "alpha": "a",
    "b": "b",
    "beta": "b",
    "c": "rc",
    "pre": "rc",
    "preview": "rc",
    "rc": "rc",
}

_VERSION_RE = re.compile(
    r"""
    \A\s*
    v?
    (?:(?P<epoch>[0-9]+)!)?
    (?P<release>[0-9]+(?:\.[0-9]+)*)
    (?P<pre>
        [-_.]?
        (?P<pre_l>alpha|a|beta|b|preview|pre|rc|c)
        (?:[-_.]?(?P<pre_n>[0-9]+))?
    )?
    (?P<post>
        (?:-(?P<post_n1>[0-9]+))
        |
        (?:
            [-_.]?
            (?P<post_l>post|rev|r)
            (?:[-_.]?(?P<post_n2>[0-9]+))?
        )
    )?
    (?P<dev>
        [-_.]?
        dev
        (?:[-_.]?(?P<dev_n>[0-9]+))?
    )?
    (?:\+(?P<local>[a-z0-9]+(?:[-_.][a-z0-9]+)*))?
    \s*\Z
    """,
    re.VERBOSE | re.IGNORECASE | re.ASCII,
)


def slugify(value: str) -> str:
    value = value.strip().lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def normalize_version(value: str) -> str:
    """Normalize ordinary dotted versions, preserving pre-release suffixes."""
    if not isinstance(value, str):
        raise TypeError(f"Expected str for version, got {type(value).__name__}")

    match = _VERSION_RE.match(value)
    if match is None:
        raise ValueError(f"Invalid version: {value!r}")

    parts: list[str] = []

    epoch = match.group("epoch")
    if epoch and int(epoch) != 0:
        parts.append(f"{int(epoch)}!")

    release = ".".join(str(int(segment)) for segment in match.group("release").split("."))
    parts.append(release)

    pre_label = match.group("pre_l")
    if pre_label is not None:
        pre_num = int(match.group("pre_n") or 0)
        parts.append(f"{_PRE_LABELS[pre_label.lower()]}{pre_num}")

    post_n1 = match.group("post_n1")
    post_label = match.group("post_l")
    if post_n1 is not None:
        parts.append(f".post{int(post_n1)}")
    elif post_label is not None:
        post_num = int(match.group("post_n2") or 0)
        parts.append(f".post{post_num}")

    if match.group("dev") is not None:
        dev_num = int(match.group("dev_n") or 0)
        parts.append(f".dev{dev_num}")

    local = match.group("local")
    if local is not None:
        local_segments = [
            str(int(seg)) if seg.isdigit() else seg.lower()
            for seg in re.split(r"[-_.]", local)
        ]
        parts.append(f"+{'.'.join(local_segments)}")

    return "".join(parts)
