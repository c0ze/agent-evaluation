# Changelog

All notable changes to `slugkit` are documented in this file. Entries begin with `0.4.0` based on `RELEASE_NOTES.txt`.

## [0.4.0] - Unreleased

### User-Visible Changes

- **Python support**: Removed Python 3.9 support (`requires-python = ">=3.10"`). The supported Python range is now 3.10 through 3.13, including Python 3.12+ compatibility after removing `distutils`.
- **`slugify`**: Handles repeated punctuation consistently (already implemented in the codebase).
- **`normalize_version`**: Preserves output for ordinary dotted versions (including pre-release suffixes) without depending on `distutils`, normalizes PEP 440 variants (such as leading `v`, leading zero segments, and pre/post/dev aliases), and raises `ValueError` for invalid or empty strings (`TypeError` for non-`str` inputs).

### Known Limitations

- Unicode letters are transliterated poorly by `slugify` (non-ASCII characters are stripped/collapsed rather than transliterated); this is **not** fixed in `0.4.0`.

### Internal Maintenance

- Replaced deprecated `distutils.version.LooseVersion` internals in `slugkit.py` with a zero-dependency standard-library PEP 440 parser.
- Updated `pyproject.toml` for the `0.4.0` release: bumped `version` to `"0.4.0"`, set `requires-python = ">=3.10"`, added Python 3.10–3.13 classifiers, declared `py-modules = ["slugkit"]` under `[tool.setuptools]`, and updated `[tool.ruff]` (`target-version = "py310"`).
- Updated `ci.yml` to validate Python `3.10`, `3.11`, `3.12`, and `3.13` in the `test` matrix, split `ruff check .` into a dedicated `lint` job, enforce least-privileged `permissions: contents: read` with `persist-credentials: false`, and keep GitHub Actions pinned to `actions/checkout@v4` and `actions/setup-python@v5`.
- Expanded `test_slugkit.py` with unit tests covering ordinary dotted versions, pre-release/post/dev suffixes, canonical normalization, invalid version inputs, and repeated punctuation in `slugify`.
