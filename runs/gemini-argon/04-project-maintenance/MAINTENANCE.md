# Maintenance Guide

## Release Checklist

1. **Metadata Alignment**: Update `version` in `pyproject.toml` and confirm `requires-python`, Python classifiers, and `[tool.ruff]` `target-version` match the supported Python range.
2. **Lint Check**: Run `ruff check .` locally and resolve any formatting or lint issues.
3. **Unit Tests**: Run `python -m unittest -v` across supported Python interpreters (3.10 through 3.13) and verify all tests pass.
4. **CI Verification**: Confirm `ci.yml` covers the full supported Python matrix, sets least-privilege `permissions: contents: read`, and pins actions to approved major versions (`actions/checkout@v4`, `actions/setup-python@v5`).
5. **Changelog Update**: Update `CHANGELOG.md` from `RELEASE_NOTES.txt`, separating user-visible changes from internal maintenance and documenting known limitations without inventing claims.
6. **Tag and Publish**: Build distribution artifacts in a clean environment and tag the release commit (`v0.4.0`).

## Compatibility Policy

- **Supported Python Versions**: `slugkit` supports Python **3.10 through 3.13** (`>=3.10,<3.14`). Support for end-of-life Python releases (such as 3.9) is dropped in minor version updates, with `pyproject.toml` metadata and CI test matrices updated in lockstep.
- **Public API Guarantees**: `slugify(value: str) -> str` and `normalize_version(value: str) -> str` constitute the public API. Ordinary dotted version strings and standard pre-release suffixes (`a`, `b`, `rc`, `dev`, `post`) maintain stable string output across minor updates.
- **Zero External Runtime Dependencies**: `slugkit` relies exclusively on the Python standard library at runtime so it can be installed and tested in offline environments.

## Next Three Prioritized Maintenance Items

1. **Unicode Transliteration in `slugify` (Priority 1)**: Address the known limitation where non-ASCII Unicode letters are stripped instead of transliterated (for example, normalizing accented characters via `unicodedata.normalize("NFKD", ...)` before ASCII filtering) and add regression tests.
2. **GitHub Actions Workflow Path & Build Check (Priority 2)**: Move or mirror `ci.yml` to `.github/workflows/ci.yml` so GitHub Actions triggers automatically on repository pushes and pull requests, and add a package build verification step.
3. **Broader Version Grammar & Static Type Checking (Priority 3)**: Clarify and test behavior for complex PEP 440 version features (epoch prefixes, local version labels like `+build.1`, and multiple pre/post segments) and add static type checking (`mypy`) to the lint workflow.
