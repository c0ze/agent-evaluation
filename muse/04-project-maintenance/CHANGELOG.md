# Changelog

## 0.4.0

### Changed (user-visible)

- `slugify` handles repeated punctuation consistently (e.g. `"Hello,,,   World!!"` → `"hello-world"`).
- Dropped support for Python 3.9; supported range is now Python 3.10 through 3.13.
- `normalize_version` no longer uses deprecated `distutils`; ordinary versions
  (including pre-release suffixes such as `2.0rc1`) keep the same output.

### Internal

- CI validates Python 3.10–3.13 and stays on `actions/checkout@v4` and
  `actions/setup-python@v5`.

### Known limitations

- Unicode letters are transliterated poorly (e.g. non-ASCII input degrades to
  `-`-separated ASCII); not fixed in 0.4.0.
