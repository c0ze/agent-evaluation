# Changelog

All notable changes to this project are documented here. This file is derived
from `RELEASE_NOTES.txt`; it adds no claims beyond what those notes state.

## [0.4.0] - Unreleased

### User-visible changes

- Removed the dependency on deprecated `distutils` internals for version
  handling. `normalize_version` no longer imports `distutils`, so the library
  imports on Python 3.12 and 3.13, where `distutils` is no longer part of the
  standard library. Ordinary versions (for example `1.2.0`) and versions with
  pre-release suffixes (for example `2.0rc1`) produce the same output as
  before.
- Removed Python 3.9 support. The supported range is now Python 3.10 through
  3.13, and 3.13 is covered by CI.
- `slugify` handles repeated punctuation consistently: runs of non-alphanumeric
  characters collapse to a single `-`, and leading/trailing separators are
  stripped. This behaviour was already implemented before 0.4.0 and is listed
  here for completeness, not as a new change in this release.

### Internal / maintenance

- CI now uses Python 3.10, 3.11, 3.12 and 3.13 in the test matrix (3.9
  removed).
- CI actions stay pinned to the agreed major versions: `actions/checkout@v4`
  and `actions/setup-python@v5`.
- CI runs with least privilege (`permissions: contents: read`), and lint is a
  separate job from the test matrix.
- Packaging metadata declares the single distribution module explicitly, so
  the flat-layout project installs reliably.

### Known limitations (unchanged in 0.4.0)

- `slugify` transliterates Unicode letters poorly: characters outside `a-z` and
  `0-9` are dropped rather than transliterated (for example `Ärger` becomes
  `rger`). This is **not** fixed in 0.4.0.
- `normalize_version` does not implement full PEP 440 normalization; it
  preserves the input string for any value it can parse.
