# Changelog

All notable changes to this project are documented in this file.

## 0.4.0

### Changed (user-visible)

- `slugify` now handles repeated punctuation consistently.
- Replaced the deprecated `distutils`-based version parsing internals.
  `normalize_version` retains its previous output for ordinary versions (for
  example `"1.2.0"` and `"2.0rc1"` are unchanged) and no longer depends on a
  module that was removed from the standard library in Python 3.12.
- Removed support for Python 3.9. The supported Python range is now 3.10
  through 3.13, and this release is validated on Python 3.13.

### Internal maintenance

- CI now tests Python 3.10 through 3.13 and uses least-privilege workflow
  permissions (`contents: read`).
- GitHub Actions remain pinned to `actions/checkout@v4` and
  `actions/setup-python@v5`.

### Known limitations

- Unicode letters are still transliterated poorly. This is **not** fixed in
  0.4.0.
