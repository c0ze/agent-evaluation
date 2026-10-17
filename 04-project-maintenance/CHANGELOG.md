# Changelog

All notable changes to this project are documented in this file.

The format is based on Keep a Changelog. This project does not record
entries for releases before 0.4.0 in this file.

## [0.4.0]

### Added

- Validation on Python 3.13. Supported Python versions are now 3.10
  through 3.13.

### Changed

- `slugify` handles repeated punctuation consistently, collapsing each
  run of non-alphanumeric characters to a single `-`.
- `normalize_version` retains its output for ordinary versions (for
  example `1.2.0` and `2.0rc1`), but now applies PEP 440 normalization:
  spellings such as `v1.2`, `1.02`, and `2.0RC1` normalize to `1.2`,
  `1.2`, and `2.0rc1`, and non-PEP-440 input raises
  `packaging.version.InvalidVersion` instead of being echoed verbatim.
- slugkit now has a runtime dependency on `packaging>=23`.

### Removed

- Support for Python 3.9.

### Internal maintenance

- Replaced deprecated `distutils.version.LooseVersion` with
  `packaging.version.Version`. `distutils` was removed from the
  standard library in Python 3.12.
- Aligned project metadata and Ruff's target version with Python 3.10.
- CI now tests Python 3.10, 3.11, 3.12, and 3.13, runs lint as a
  separate single job, and uses least-privilege workflow permissions
  (`contents: read`). GitHub Actions remain pinned to
  `actions/checkout@v4` and `actions/setup-python@v5`.

### Known limitations

- Unicode letters are transliterated poorly by `slugify` (non-ASCII
  letters are treated as separators). This is not fixed in 0.4.0.
