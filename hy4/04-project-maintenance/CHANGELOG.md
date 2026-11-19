# Changelog

All notable changes to this project are documented here. This file is derived
from `RELEASE_NOTES.txt` for the 0.4.0 release.

## 0.4.0

### User-visible

- `slugify` now handles repeated punctuation consistently. Repeated and mixed
  punctuation is collapsed into a single `-` separator. (Already implemented in
  the codebase prior to this release.)
- Supported Python versions are now 3.10–3.13. Python 3.9 support is removed;
  validation on Python 3.13 is added.
- `normalize_version` continues to return the same output for ordinary versions,
  including pre-release suffixes (for example `2.0rc1`). No behavior change is
  intended for callers.

### Internal maintenance

- Replaced the deprecated `distutils.version.LooseVersion` internals with the
  maintained `packaging` library. `distutils` was removed from the standard
  library in Python 3.12, so this change is required to support Python 3.12 and
  3.13. The `packaging` dependency is declared in package metadata.
- Aligned packaging metadata (version, `requires-python`, Python classifiers,
  Ruff target) with the 0.4.0 release and the supported Python range.
- Reworked CI to test the full supported Python matrix (3.10–3.13), pin
  `actions/checkout@v4` and `actions/setup-python@v5`, use `python -m pip`,
  and run with least-privilege `contents: read` permissions.
- Expanded the test suite to lock in the `normalize_version` compatibility
  contract, repeated-punctuation slugification, and the absence of any
  `distutils` import.

### Known limitations

- Unicode letters are still transliterated poorly. This is **not** fixed in
  0.4.0.
