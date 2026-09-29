# Changelog

All notable changes to `slugkit` are recorded here. The 0.4.0 entry is derived from
`RELEASE_NOTES.txt`; it is not dated because no release date has been set.

## 0.4.0 - unreleased

### User-visible changes

- **Python support:** Python 3.9 is no longer supported. `slugkit` now supports
  Python 3.10 through 3.13, and `requires-python` is `>=3.10`.
- **Python 3.13:** the test suite now runs on Python 3.13 in CI.
- **`normalize_version`:** no longer uses the deprecated `distutils` version parsing
  internals (`distutils` is not part of the standard library from Python 3.12). Output
  for ordinary versions such as `1.2.0` and `2.0rc1` is unchanged. Edge cases: an empty
  string now raises `ValueError` and non-string input raises `TypeError`; the previous
  implementation raised `AttributeError` for an empty string.
- **`slugify`:** repeated punctuation is handled consistently (for example
  `"Hello,,, World!!!"` becomes `"hello-world"`). This behavior was already implemented
  in the code; it is now covered by tests.

### Internal maintenance

- CI actions remain on `actions/checkout@v4` and `actions/setup-python@v5`.
- CI test matrix now covers Python 3.10, 3.11, 3.12 and 3.13 (3.9 removed); `ruff` runs
  as its own job instead of once per matrix entry.
- CI workflow permissions are limited to `contents: read`.
- Packaging metadata: version bumped to 0.4.0, Python classifiers added, ruff
  `target-version` set to `py310`, and the module list declared explicitly so that
  `pip install -e .` no longer fails setuptools' flat-layout auto-discovery.
- Tests added for `normalize_version` compatibility and for repeated punctuation in
  `slugify`.
- Added `MAINTENANCE.md` (release checklist, compatibility policy, next maintenance items).

### Known limitations

- Unicode letters are transliterated poorly. This is **not** fixed in 0.4.0.
