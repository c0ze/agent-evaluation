# Changelog

All notable changes to this project are documented here.

## 0.4.0

### User-visible changes

- `slugify` now handles repeated punctuation consistently.
- Dropped support for Python 3.9. The project now supports Python 3.10, 3.11,
  3.12, and 3.13.

### Internal maintenance

- Replaced the deprecated `distutils.version.LooseVersion` usage in
  `normalize_version` with a dependency-free implementation that preserves the
  existing output.
- CI now runs the test/lint workflow on the full supported Python range and
  continues to use `actions/checkout@v4` and `actions/setup-python@v5`.

### Known limitations

- Unicode letters are still transliterated poorly by `slugify`; this has not
  been addressed in 0.4.0.