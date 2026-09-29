# slugkit

Small slug and version helpers for Python 3.10 through 3.13.

```python
from slugkit import normalize_version, slugify

slugify("  Hello, World! ")  # "hello-world"
normalize_version("2.0rc1")  # "2.0rc1"
```

`slugify` lowercases text, replaces runs of characters outside ASCII letters
and digits with a hyphen, and removes leading and trailing hyphens. Unicode
transliteration remains a known limitation.

`normalize_version` preserves ordinary version strings verbatim, including
suffixes and leading or trailing zeros; it does not validate version syntax.

For local development:

```sh
python -m pip install -e '.[dev]'
python -W error -m unittest discover -v
python -m ruff check .
```

See `CHANGELOG.md` for release changes and `MAINTENANCE.md` for the release
checklist and compatibility policy.
