# Changelog

All notable changes to slugkit are documented in this file.

## [0.4.0] - Unreleased

### User-visible changes

- Dropped support for Python 3.9. The supported and CI-tested range is now
  Python 3.10 through 3.13.
- `normalize_version()` no longer relies on the deprecated `distutils` module.
  Results are unchanged for ordinary dotted versions, including pre-release
  suffixes such as `1.2.0` and `2.0rc1`.

### Internal and maintenance

- Replaced `distutils.version.LooseVersion` with a dependency-free
  implementation that preserves `normalize_version()`'s output for ordinary
  versions.
- Updated project metadata to require Python 3.10+, added Python 3.10–3.13
  classifiers, and set Ruff's target version to `py310`.
- Kept GitHub Actions pinned to `actions/checkout@v4` and
  `actions/setup-python@v5`; split test and lint into separate jobs, added the
  3.10–3.13 test matrix, restricted workflow permissions to read-only
  contents, and disabled persisted checkout credentials.
- Added regression tests for version normalization and repeated-punctuation
  slug handling.

### Documentation

- Recorded that `slugify()`'s repeated-punctuation handling was already
  implemented before 0.4.0; it is not a new behavior change in this release.

### Known limitations

- `slugify()` still transliterates Unicode letters poorly. This is unchanged
  in 0.4.0 and is not claimed as fixed.
