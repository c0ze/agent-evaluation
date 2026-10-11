# Maintenance Guide

This guide details the release procedures, compatibility policies, and upcoming maintenance priorities for `slugkit`.

## Release Checklist

Complete the following checklist when preparing and publishing a release:

1. **Run Unit Tests**: Execute all local unit tests to ensure complete pass:
   ```bash
   python -m unittest -v
   ```
2. **Run Linter**: Ensure no linting errors or formatting issues:
   ```bash
   ruff check .
   ```
3. **Bump Version**: Update the version field in `pyproject.toml` per Semantic Versioning rules.
4. **Update Changelog**: Ensure `CHANGELOG.md` accurately documents user-visible changes, internal maintenance, and known limitations.
5. **Verify CI**: Confirm that all GitHub Actions CI matrix builds (Python 3.10 through 3.13) and lint jobs succeed on the release pull request or branch.
6. **Build Distributions**: Build source distribution and wheel packages:
   ```bash
   python -m build
   ```
7. **Publish and Tag**: Create a Git release tag and publish release artifacts to PyPI:
   ```bash
   git tag v<version>
   git push origin v<version>
   twine upload dist/*
   ```

## Compatibility Policy

- **Supported Python Versions**: `slugkit` officially supports active Python releases, currently Python 3.10 through 3.13. Support for Python versions is retired once they reach upstream End-of-Life (EOL). New Python versions are evaluated and added to CI validation as they become available.
- **Semantic Versioning (SemVer)**:
  - **Major releases (`X.0.0`)**: Incompatible API changes or dropping supported Python versions outside standard maintenance.
  - **Minor releases (`0.X.0`)**: Backward-compatible feature additions, deprecation milestones, and scheduled Python compatibility updates.
  - **Patch releases (`0.0.X`)**: Backward-compatible bug fixes and internal maintenance.
- **Version Normalization Guarantees**: `normalize_version` guarantees PEP 440-compliant normalization for ordinary dotted versions and pre-release/post-release identifiers.

## Prioritized Maintenance Items

The following three maintenance items are prioritized for future releases:

1. **Unicode Transliteration and Accents in `slugify`**:
   - *Description*: Implement robust Unicode normalization (e.g., using Python's `unicodedata.normalize('NFKD', ...)` or ASCII transliteration) so non-ASCII alphabetic characters are handled gracefully rather than stripped. This resolves the documented 0.4.0 limitation.
   - *Priority*: High (User-facing feature improvement).

2. **Automated Continuous Delivery (CD)**:
   - *Description*: Establish a GitHub Actions deployment workflow utilizing PyPI Trusted Publishing (OIDC) triggered automatically upon creating a new release tag, avoiding manual build and upload steps.
   - *Priority*: Medium (Release automation & security).

3. **Type Annotations & Static Typing**:
   - *Description*: Add a `py.typed` marker file (PEP 561), enforce full type annotations across `slugkit.py`, and incorporate static type analysis (such as `mypy` or `pyright`) into the CI linting job.
   - *Priority*: Low (Code quality and developer ergonomics).
