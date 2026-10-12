# Changelog

All notable changes to this project are documented in this file. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project follows [semantic versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-10-12

### Added

- Official support for Python 3.13; the release is validated against it in CI.

### Changed

- `normalize_version` no longer relies on the deprecated `distutils` module
  (deprecated in Python 3.10, removed in Python 3.12). Output for ordinary
  versions, including pre-release suffixes, is unchanged. Degenerate input now
  raises explicit errors instead of incidental ones: `TypeError` for
  non-strings and `ValueError` for the empty string.
- `slugify` now handles repeated punctuation consistently: runs of
  non-alphanumeric characters collapse to a single `-` separator. (The
  behavior was implemented prior to this release; it is announced here.)

### Removed

- Python 3.9 support. The minimum supported Python version is now 3.10.

### Internal

- CI test matrix aligned with the supported Python range (3.10, 3.11, 3.12,
  3.13); the workflow runs with least privilege (`permissions: contents: read`).
- GitHub Actions remain pinned to major versions `actions/checkout@v4` and
  `actions/setup-python@v5`.
- Project metadata (`requires-python`, classifiers, ruff `target-version`)
  aligned with the supported Python range.

### Known issues

- `slugify` transliterates Unicode letters poorly: non-ASCII characters are
  stripped rather than folded to ASCII equivalents. This is *not* fixed in
  0.4.0.
