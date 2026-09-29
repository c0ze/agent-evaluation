# Changelog

## 0.4.0

### User-visible changes

- `slugify` handles repeated punctuation consistently.
- Support for Python 3.9 is removed. The supported range is Python 3.10 through 3.13.

### Internal maintenance

- Deprecated `distutils` version parsing is replaced. Ordinary version output stays the same, including pre-release suffixes.
- CI drops Python 3.9 and validates Python 3.10 through 3.13. Actions stay on `actions/checkout` v4 and `actions/setup-python` v5.

### Known limitations

- Unicode letters are transliterated poorly in 0.4.0.
