# Maintenance Guide

## Release Checklist

1. **Align metadata**: Verify `version`, `requires-python`, Python `classifiers`, and `[tool.ruff] target-version` in `pyproject.toml` match the target release and supported Python range.
2. **Finalize changelog**: Update `CHANGELOG.md` from release notes, separating user-visible changes from internal maintenance, preserving known limitations honestly, and replacing `Unreleased` with the release date once ready to tag.
3. **Run local verification**:
   - Execute the test suite: `python -m unittest discover -v`
   - Run static checks: `ruff check .`
   - Build and smoke-test the package distribution (`python -m build`, then install the built wheel in a clean environment and run the tests).
4. **Confirm CI status**: Ensure both `lint` and `test` (Python 3.10–3.13) jobs pass on the release commit.
5. **Tag and publish**: Create an annotated version tag (`vX.Y.Z`), publish the verified sdist and wheel, and confirm installation from the published release.

## Compatibility Policy

- **Supported Python versions**: Python 3.10 through 3.13 are officially supported, declared in `pyproject.toml` `classifiers`, and validated in CI (`ci.yml`).
- **`requires-python` lower bound**: `requires-python = ">=3.10"` enforces the minimum supported interpreter without an upper cap (following PyPA guidance) so users on newer Python releases are not blocked from installing or testing before formal CI support is added.
- **Version lifecycle**: Python minor versions are dropped only in a minor (`0.x.0`) or major release after upstream end-of-life or deprecation pressure, and new minor versions are added to `classifiers` and CI once validated.
- **API and dependencies**: `slugify` and `normalize_version` preserve backward-compatible behavior for ordinary inputs across patch releases; any breaking or edge-case behavior shifts must be called out in `CHANGELOG.md`. Keep runtime dependencies at zero unless a clear technical requirement justifies adding one.

## Next Three Prioritized Maintenance Items

1. **P1 — Complete distribution metadata and repository workflow path**: Add `README.md`, `LICENSE`, and `[project.urls]` in `pyproject.toml`, and place `ci.yml` at `.github/workflows/ci.yml` in the live repository so package metadata is complete for PyPI and GitHub Actions triggers automatically.
2. **P2 — Improve Unicode transliteration in `slugify`**: Address the documented limitation where non-ASCII letters are dropped rather than transliterated (e.g., via `unicodedata` normalization/transliteration and thorough Unicode test cases), targeting `0.5.0` because it changes `slugify` output for non-ASCII inputs.
3. **P3 — Harden CI and packaging checks**: Add a `[project.optional-dependencies] dev` group (or pinned Ruff version) for reproducible linting, and add a CI build-and-install verification job (`python -m build` + wheel installation test) to catch packaging regressions before release.
