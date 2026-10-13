# Changelog

All notable changes to slugkit are documented here.

## [0.4.0]

### User-visible changes

- `slugify` now handles repeated punctuation consistently.
- Python 3.9 support is removed. Python 3.10 through 3.13 is supported,
  including validation on Python 3.13.

### Internal maintenance

- Replaced the deprecated `distutils` version-parsing internals.
  Output for common versions is retained (for example, `1.2.0` and
  `2.0rc1` are unchanged). Inputs that are not ordinary versions now
  raise `ValueError`.
- CI continues to use `actions/checkout` v4 and
  `actions/setup-python` v5.

### Known limitations

- Unicode letters are transliterated poorly by `slugify`. This is not
  fixed in 0.4.0.
