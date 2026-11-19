# Changelog

## 0.4.0

### User-visible changes

- `slugify` now handles repeated punctuation consistently (implemented in an
  earlier release; documented here for the 0.4.0 release).
- Python 3.9 is no longer supported. The supported range is Python 3.10-3.13.

### Internal maintenance

- Replaced deprecated `distutils` version-parsing internals in
  `normalize_version` with `packaging.version`. Observable output for ordinary
  versions is preserved.
- CI now uses `actions/checkout@v4` and `actions/setup-python@v5`, runs lint and
  tests as separate least-privilege jobs, and validates Python 3.10-3.13.

### Known limitations

- Unicode letters are transliterated poorly by `slugify`. This is not fixed in
  0.4.0.
