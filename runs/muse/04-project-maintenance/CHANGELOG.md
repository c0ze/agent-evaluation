# Changelog

## [0.4.0]

### User-visible changes

- `slugify` handles repeated punctuation consistently: runs of
  non-alphanumeric characters collapse to a single `-`.
- Dropped support for Python 3.9. Supported range is Python 3.10
  through 3.13, with CI validation added on 3.13.
- Replaced deprecated `distutils` version-parsing internals.
  Ordinary dotted versions and pre-release suffixes keep the same
  output.

### Internal

- CI continues to pin `actions/checkout` to v4 and
  `actions/setup-python` to v5.

### Known limitations

- Unicode letters are still transliterated poorly; this is not
  fixed in 0.4.0.
