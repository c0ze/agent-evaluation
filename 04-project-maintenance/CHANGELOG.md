# Changelog

All notable changes to slugkit are documented in this file.

## [0.4.0] — Unreleased

### User-visible changes

- `slugify` now handles repeated punctuation consistently (consecutive
  non-alphanumeric characters collapse into a single separator).
- Dropped support for Python 3.9. Supported versions are now Python 3.10
  through 3.13.
- Added CI validation on Python 3.13.

### Internal maintenance

- Replaced the deprecated `distutils` version-parsing internals with
  `packaging`, retaining the previous output for common version strings;
  non-standard strings are still echoed back unchanged.
- Kept CI actions pinned to the existing majors: `actions/checkout@v4` and
  `actions/setup-python@v5`.

### Known limitations

- Unicode letters are still transliterated poorly by `slugify`; this is not
  fixed in 0.4.0.
