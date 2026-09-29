# Changelog

Source: `RELEASE_NOTES.txt` (target 0.4.0). No claims beyond that source.

## [0.4.0]

### User-visible changes

- `slugify` now handles repeated punctuation consistently. This behavior was
  already implemented before the release.
- Python 3.9 support is removed. The supported Python range is 3.10 through 3.13.
- Python 3.13 is validated in CI.

### Internal maintenance

- Deprecated version parsing internals were replaced; common version strings
  retain their previous output.
- CI actions remain `actions/checkout` v4 and `actions/setup-python` v5.

### Known limitations

- Unicode letters are transliterated poorly. This is **not** fixed in 0.4.0.
