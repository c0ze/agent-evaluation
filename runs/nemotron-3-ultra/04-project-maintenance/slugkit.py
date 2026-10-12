import re


def slugify(value: str) -> str:
    value = value.strip().lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def normalize_version(value: str) -> str:
    """Normalize ordinary dotted versions, preserving pre-release suffixes."""
    # Simple normalization for common version patterns:
    # - dotted versions (1.2.3)
    # - pre-release suffixes (rc, alpha, beta, dev, post)
    # This mimics distutils.LooseVersion behavior for ordinary versions.
    pattern = r"^(\d+(?:\.\d+)*)((?:[ab]|rc|dev|post)\d*)?$"
    match = re.match(pattern, value.strip())
    if match:
        return match.group(1) + (match.group(2) or "")
    # Fallback: return as-is for unrecognized patterns
    return value.strip()