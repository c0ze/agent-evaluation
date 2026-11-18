# Changelog

## 0.4.0

### User-visible changes

- `slugify` collapses a run of punctuation between words to a single hyphen.
- Supported Python versions are now 3.10 through 3.13. Support for Python 3.9 has ended.

### Internal maintenance

- Removed the deprecated `distutils` version parser. Ordinary dotted versions and prerelease suffixes retain their original spelling.
- CI now includes Python 3.13 and continues to use `actions/checkout@v4` and `actions/setup-python@v5`.

### Known limitation

Unicode transliteration remains limited. Letters outside ASCII can be lost when creating a slug.
