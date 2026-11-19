# Changelog

All notable changes to `slugkit` are documented in this file.

## [0.4.0] - Unreleased

### User-Visible Changes

- **Compatibility (Breaking)**: Dropped support for Python 3.9. Supported Python versions are now 3.10 through 3.13 (`requires-python = ">=3.10"`).
- **Changed**: `slugify` handles repeated punctuation consistently (already implemented in the codebase).
- **Changed**: Replaced deprecated `distutils.version.LooseVersion` internals in `normalize_version` with a standard-library PEP 440 parser. Ordinary dotted versions and common pre-release suffixes (for example, `1.2.0` and `2.0rc1`) retain the same output. Inputs that do not match PEP 440 syntax now raise `ValueError` (and non-string inputs raise `TypeError`), whereas `LooseVersion` previously echoed arbitrary strings unchanged.

### Internal Maintenance

- Updated `pyproject.toml` to version `0.4.0`, added Python 3.10–3.13 classifiers, set `[tool.ruff] target-version = "py310"`, and explicitly configured `[tool.setuptools] py-modules = ["slugkit"]`.
- Updated `ci.yml` to separate `lint` and `test` jobs, apply least-privileged `contents: read` permissions, validate Python 3.10 through 3.13 in the test matrix, and keep GitHub Actions pinned to `actions/checkout@v4` and `actions/setup-python@v5`.
- Expanded unit tests in `test_slugkit.py` to cover `normalize_version` compatibility, canonicalization, invalid input handling, absence of `distutils` imports, and `slugify` punctuation handling.

### Known Limitations

- Unicode letters are still handled poorly by `slugify` (non-ASCII characters are stripped rather than transliterated); this is not fixed in `0.4.0`.
