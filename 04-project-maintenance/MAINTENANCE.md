# Maintenance Guide

## Release Checklist

- [ ] **Run local checks**: Ensure the test suite passes (`python -m unittest -v`).
- [ ] **Run linting**: Ensure code adheres to standards (`ruff check .`).
- [ ] **Verify CI**: Confirm that all GitHub Actions CI matrix jobs (Python 3.10–3.13) and lint jobs succeed.
- [ ] **Bump version**: Update the project version in `pyproject.toml` according to SemVer.
- [ ] **Update changelog**: Record all user-visible changes, internal maintenance, and known limitations in `CHANGELOG.md`.
- [ ] **Tag release**: Commit the release preparation and create a Git tag (e.g. `git tag -a v0.4.0 -m "Release 0.4.0"`).
- [ ] **Build package**: Build source distribution and wheel (`python -m build`).
- [ ] **Publish package**: Upload distribution artifacts to PyPI (e.g. via `twine upload dist/*` or trusted publishing).

## Compatibility Policy

- **Supported Python Range**: Python 3.10 through 3.13.
- **Python Version Lifecycle**: Follow the official Python release cycle (PEP 602). Python versions are dropped once they reach upstream End of Life (EOL). New Python versions are officially adopted and validated in CI once released.
- **Semantic Versioning (SemVer)**:
  - **Major releases (`X.0.0`)**: Breaking changes to public APIs (`slugify`, `normalize_version`) or observable behavior.
  - **Minor releases (`0.X.0` / `x.Y.0`)**: New backward-compatible features, deprecation notices, or changes in supported Python version ranges.
  - **Patch releases (`x.y.Z`)**: Backward-compatible bug fixes and internal maintenance.
- **Observable Behavior Guarantee**: Version parsing and normalization must preserve standard dotted representation and pre-release identifiers without silent corruption.

## Next Three Prioritized Maintenance Items

1. **Improve Unicode handling and transliteration in `slugify`**:
   Address the known limitation where non-ASCII / Unicode letters are stripped or poorly transliterated. Introduce Unicode normalization (e.g., NFKD normalization via standard library `unicodedata`) or optional transliteration so accented and international characters are converted cleanly into readable ASCII slugs.

2. **Automate build and release distribution in CI**:
   Add a GitHub Actions release workflow that triggers on release tags, builds sdist and wheel artifacts using `build`, runs `twine check`, and securely uploads artifacts to PyPI using GitHub OIDC Trusted Publishing.

3. **Enhance test coverage and static type checking**:
   Introduce static type checking with `mypy` or `pyright` across the codebase, and add property-based or parameterized test cases for corner-case version strings (e.g., complex PEP 440 local versions, epoch tags, and dev/post releases).
