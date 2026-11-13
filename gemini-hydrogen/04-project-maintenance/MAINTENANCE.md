# Maintenance

## Release Checklist

1. Confirm `CHANGELOG.md` separates user-visible changes, known limitations, and internal maintenance for the target version, and replace `Unreleased` with the release date when cutting the release.
2. Verify `pyproject.toml` metadata (`version`, `requires-python`, `classifiers`, and `[tool.ruff]` `target-version`) matches the target release and supported Python range.
3. Run the local test suite (`python -m unittest discover -v`) and linter (`ruff check .`).
4. Build sdist/wheel artifacts (`python -m build`) and verify only the `slugkit` module is packaged (excluding tests and workflow files).
5. Confirm CI (`ci.yml`) passes across the full Python matrix (`3.10`–`3.13`) and the `lint` job before tagging and publishing.

## Compatibility Policy

- **Supported Python versions**: Python `3.10` through `3.13`. All supported minor versions are listed in `pyproject.toml` classifiers and tested in the CI matrix.
- **`requires-python` policy**: `pyproject.toml` declares `requires-python = ">=3.10"` (dropping 3.9 in `0.4.0`) without an upper cap such as `<3.14`, avoiding unnecessary resolver blocks on newer Python releases while treating versions outside `3.10`–`3.13` as unvalidated until added to CI.
- **Runtime dependencies**: `slugkit` has zero third-party runtime dependencies and relies solely on the Python standard library.
- **API behavior**: `slugify` and `normalize_version` preserve output for ASCII slugs and ordinary dotted versions (including pre-release suffixes) within `0.4.x`. Known limitations (such as non-ASCII Unicode handling in `slugify`) and any future breaking behavior changes will be documented explicitly in `CHANGELOG.md`.

## Next Three Prioritized Maintenance Items

1. **P1 — Improve Unicode handling in `slugify` (High)**
   Address the known limitation where non-ASCII Unicode letters are stripped or replaced instead of transliterated (for example, evaluating `unicodedata.normalize("NFKD", ...)` ASCII folding vs. optional transliteration) and document the chosen behavior with tests.
2. **P2 — Align repository layout, packaging checks, and CI tool pinning (Medium)**
   Move `ci.yml` to `.github/workflows/ci.yml` (and consider a `src/` package layout) in a real repository checkout, add a package build/metadata check (`python -m build` / `twine check`) in CI, and pin or declare dev tooling (such as `ruff`) for reproducible lint runs.
3. **P3 — Expand Python version coverage and clarify version API scope (Low/Medium)**
   Add Python `3.14` to the CI matrix and classifiers once validated across CI runners, and decide whether `normalize_version` should stay purely string-normalization-focused or eventually expose comparison/specifier helpers (potentially via `packaging.version`).
