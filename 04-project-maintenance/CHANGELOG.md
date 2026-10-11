# Changelog

## [0.4.0]

### User-Visible Changes
- `slugify` now handles repeated punctuation consistently.
- Dropped support for Python 3.9; added support and validation for Python 3.13 (supported range: Python 3.10 through 3.13).

### Internal Maintenance
- Replaced deprecated `distutils` version parsing internals with `packaging.version.Version` while retaining common output for ordinary versions.
- Pinned and maintained GitHub Actions to `actions/checkout@v4` and `actions/setup-python@v5`.
- Made CI workflow coherent and least-privileged (`contents: read`), separating test matrix and lint jobs across supported Python versions (3.10–3.13).

### Known Limitations
- Unicode letters are transliterated poorly; this is not fixed in 0.4.0.
