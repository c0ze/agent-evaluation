# Changelog

## 0.4.0

### User-visible changes

- `slugify` handles repeated punctuation consistently.
- Python 3.9 support has been removed; the supported range is Python 3.10 through 3.13.
- `normalize_version` no longer relies on deprecated `distutils` parsing and preserves the
  spelling of ordinary version strings.

### Internal maintenance

- CI now covers Python 3.10 through 3.13 and uses `actions/checkout@v4` and
  `actions/setup-python@v5`.
