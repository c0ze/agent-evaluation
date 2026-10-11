# Changelog

## 0.4.0

### User-visible changes

- Dropped support for Python 3.9. slugkit now supports Python 3.10 through
  3.13.
- `normalize_version` now validates its input. Strings that are not ordinary
  dotted versions with an optional lowercase pre-release suffix (for example
  `1.2.0` or `2.0rc1`) raise `ValueError`, and non-string input raises
  `TypeError`. For ordinary versions, the returned value is unchanged from
  0.3.2.
- `slugify` handles repeated punctuation consistently: runs of punctuation
  are collapsed into a single separator. This behavior was already present in
  0.3.2; it is now covered by tests.

### Internal maintenance

- Replaced the deprecated `distutils.version.LooseVersion` internals of
  `normalize_version` with a small local parser, since `distutils` is removed
  from the standard library in Python 3.12 and later.
- CI now tests Python 3.10 through 3.13, runs tests and lint as separate
  jobs, and grants the workflow only read access to repository contents.
  CI continues to use `actions/checkout@v4` and `actions/setup-python@v5`.

### Known limitations

- Unicode letters are transliterated poorly by `slugify`. This is a known
  limitation and is not fixed in 0.4.0.
