# Maintenance

## Release checklist

1. Update `version` in `pyproject.toml`.
2. Add the `CHANGELOG.md` entry, separating user-visible changes from internal
   maintenance and keeping known limitations listed as unfixed.
3. Run the local checks: `python -m unittest` and `ruff check .`
   (CI runs both across Python 3.10-3.13).
4. Confirm `requires-python` and `tool.ruff.target-version` still match the
   supported Python range, and that the CI matrix covers every supported minor
   version.
5. Tag the release (`vX.Y.Z`) once CI is green on the final commit.

## Compatibility policy

- Supported Python range: 3.10 through 3.13, declared in `pyproject.toml`
  (`requires-python = ">=3.10"`) and exercised by the CI matrix.
- `normalize_version` must keep its observable behavior for ordinary versions
  (dotted versions and pre-release suffixes round-trip unchanged); prefer
  behavior-preserving refactors over output changes, and lock the behavior in
  with characterization tests.
- Runtime code is standard library only; do not add runtime dependencies
  without a CHANGELOG entry explaining the user-visible impact.
- Do not remove support for a Python minor version without updating
  `pyproject.toml`, the ruff `target-version`, the CI matrix, and the
  CHANGELOG together.

## Next maintenance items (prioritized)

1. **Improve Unicode transliteration in `slugify`.** The known limitation
   carried by 0.4.0 is that Unicode letters are transliterated poorly. It is
   the only user-visible defect, so it ranks first: write characterization
   tests for the current behavior, then improve it in a minor release.
2. **Add a packaging check to CI.** Build the sdist and wheel and verify the
   metadata (e.g. `python -m build` plus a wheel check) so release metadata
   regressions are caught before a tag is created.
3. **Broaden `normalize_version` coverage.** Extend the round-trip tests to
   more ordinary shapes (long release segments, additional pre-release tags
   such as `a`/`b`/`rc`) so any future replacement of the parsing internals
   stays behavior-preserving.
