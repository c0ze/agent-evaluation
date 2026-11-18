# Changelog

## 0.4.0

### User-visible changes

- `slugify` collapses repeated punctuation into a single hyphen.
- Supported Python versions are 3.10 through 3.13. Support for Python 3.9 has ended.

### Internal maintenance

- Removed deprecated version parsing internals. `normalize_version` preserves the spelling of ordinary version strings, including prerelease suffixes.
- Added Python 3.13 to CI coverage. CI continues to use `actions/checkout@v4` and `actions/setup-python@v5`.

### Known limitation

- `slugify` can drop non-ASCII letters or treat them as separators.
