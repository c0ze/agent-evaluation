import re

_VERSION_RE = re.compile(
    r"^[vV]?(?P<release>\d+(?:\.\d+)*)"
    r"(?:[-_.]?(?P<pre>(?:a|alpha|b|beta|c|rc|pre|preview)\d*))?"
    r"(?:[-_.]?(?P<post>(?:post|rev|r)\d*))?"
    r"(?:[-_.]?(?P<dev>dev\d*))?$",
    re.IGNORECASE,
)


def slugify(value: str) -> str:
    value = value.strip().lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def normalize_version(value: str) -> str:
    """Normalize ordinary dotted versions, preserving pre-release suffixes."""
    cleaned = value.strip()
    match = _VERSION_RE.match(cleaned)
    if not match:
        raise ValueError(f"Invalid version: {value!r}")

    release = ".".join(str(int(part)) for part in match.group("release").split("."))
    pre = (match.group("pre") or "").lower()
    post = match.group("post")
    dev = match.group("dev")

    parts = [release, pre]
    if post:
        parts.append(f".{post.lower()}")
    if dev:
        parts.append(f".{dev.lower()}")
    return "".join(parts)
