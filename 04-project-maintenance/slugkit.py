import re


def slugify(value: str) -> str:
    value = value.strip().lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def normalize_version(value: str) -> str:
    """Preserve version text, including zeros and suffixes, without validating it.

    LooseVersion's string conversion returned the original version text;
    no parsing is needed to retain that behavior for ordinary versions.
    """
    return value
