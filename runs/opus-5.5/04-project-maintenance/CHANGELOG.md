# Changelog

All notable changes to slugkit are recorded here. Versions follow the
`version` field in `pyproject.toml`.

## [0.4.0] - Unreleased

### Removed

- Python 3.9 is no longer supported. `requires-python` is now `>=3.10`.

### Changed

- Supported Python versions are 3.10, 3.11, 3.12 and 3.13.
  Python 3.13 is added to the CI test matrix.
- `normalize_version` no longer uses the deprecated `distutils.version`
  internals. It works on Python 3.12+ without setuptools installed and no
  longer emits a `DeprecationWarning`. Output for ordinary version strings is
  unchanged (for example `"1.2.0"`, `"2.0rc1"`, `"1.02"` are returned as
  given; no PEP 440 rewriting is applied).
- `normalize_version` now raises `ValueError` for an empty string and
  `TypeError` for a non-string argument. Previously these inputs failed with
  an incidental `AttributeError` (empty string, `None`) or `TypeError`.
- `slugify` handles repeated punctuation consistently: runs of punctuation or
  whitespace collapse to a single `-`, and leading/trailing separators are
  stripped. (This behavior is already present in the code; 0.4.0 adds tests
  for it.)

### Known limitations

- Unicode letters are transliterated poorly by `slugify` (non-ASCII letters
  are treated as separators). This is not fixed in 0.4.0.

### Internal maintenance

- CI tests every supported Python version (3.10 to 3.13) and no longer runs on
  3.9.
- CI keeps `actions/checkout@v4` and `actions/setup-python@v5`.
- CI workflow is read-only (`permissions: contents: read`), does not persist
  checkout credentials, and runs lint once in its own job instead of in every
  test job.
- Tests run with `DeprecationWarning` treated as an error, and new tests pin
  `normalize_version` output against the legacy `LooseVersion` behavior where
  `distutils` is still importable.
- Packaging declares the single `slugkit` module explicitly and adds Python
  version classifiers; ruff targets `py310`.
