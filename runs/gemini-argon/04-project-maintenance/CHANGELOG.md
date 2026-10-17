# Changelog

## 0.4.0

### User-Visible Changes

- `slugify` consistently collapses repeated punctuation and surrounding non-alphanumeric runs into single hyphens.
- Updated supported Python versions to 3.10 through 3.13 (removed Python 3.9 support and added Python 3.13 validation).
- `normalize_version` preserves common output for ordinary dotted versions and pre-release suffixes across Python 3.10–3.13 without requiring `distutils`.

### Internal Maintenance

- Replaced deprecated `distutils.version.LooseVersion` internals in `normalize_version` with standard-library regular expression parsing for Python 3.12+ compatibility.
- Updated CI workflow (`ci.yml`) to test and lint across Python 3.10, 3.11, 3.12, and 3.13 with least-privilege `contents: read` permissions while retaining `actions/checkout@v4` and `actions/setup-python@v5`.
- Aligned `pyproject.toml` release metadata (`version = "0.4.0"`, `requires-python = ">=3.10,<3.14"`, and Ruff `target-version = "py310"`) and expanded unit tests in `test_slugkit.py`.

### Known Limitations

- Unicode letters outside ASCII (`a-z`, `0-9`) are not transliterated by `slugify` and are stripped or replaced by hyphens; this is not fixed in `0.4.0`.
