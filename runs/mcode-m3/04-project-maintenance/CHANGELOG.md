# Changelog

All notable changes to this project are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - Unreleased

### Changed
- `slugify` handles repeated punctuation consistently (collapses adjacent
  separators into a single dash and trims leading/trailing dashes). This
  behavior was already present; it is now covered by regression tests.
- `normalize_version` no longer uses the deprecated `distutils.version`
  module. The function is now backed by `packaging.version.Version`, which is
  maintained upstream and available on the supported Python versions. The
  observable behavior for ordinary dotted versions (for example
  `"1.2.0" -> "1.2.0"`) and common pre-release suffixes
  (for example `"2.0rc1" -> "2.0rc1"`) is preserved.

### Removed
- Support for Python 3.9. The minimum supported version is now 3.10.

### Added
- Explicit support and CI validation for Python 3.10, 3.11, 3.12, and 3.13.
- `packaging>=23` declared as a runtime dependency.

## Known limitations
- Unicode letters in `slugify` are transliterated poorly (non-ASCII letters
  are dropped). This is **not** claimed to be fixed in 0.4.0 and remains an
  open issue tracked in `MAINTENANCE.md`.

## [0.3.2] and earlier
No changelog entries were recorded before 0.4.0. Refer to the git history
for details on prior releases.