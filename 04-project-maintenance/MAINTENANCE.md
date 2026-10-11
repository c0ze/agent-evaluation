# Maintenance guide

## Supported versions

slugkit supports Python **3.10 through 3.13**. Every supported interpreter is
exercised by the CI matrix in `ci.yml`, and `pyproject.toml`
(`requires-python`, trove classifiers, ruff `target-version`) must always agree
with that range. The runtime package intentionally has **no third-party
dependencies**.

## Compatibility policy

- The public API is `slugify` and `normalize_version`. Behavior changes to
  these functions are announced in `CHANGELOG.md` and shipped in minor or
  major releases (the project follows semantic versioning; while version 0.x,
  breaking changes require at least a minor bump and a changelog entry).
- `normalize_version` must keep returning ordinary version strings (including
  pre-release suffixes) unchanged, matching the historical
  `str(distutils.version.LooseVersion(value))` output. Degenerate input raises
  `TypeError` (non-string) or `ValueError` (empty string).
- Dropping a Python version: update `requires-python`, classifiers, ruff
  `target-version`, and the CI matrix in one release, and record the removal in
  the changelog.
- Adding a newly released Python version: extend the CI matrix and classifiers
  as soon as the interpreter is available in `actions/setup-python`; support is
  only claimed after CI passes on it. No upper bound is declared in
  `requires-python`, so newer interpreters can install the package, but support
  is asserted only for versions validated in CI.
- Replacing internals (as done for the deprecated version parsing in 0.4.0)
  must preserve observable output for ordinary inputs; stricter behavior is
  only allowed for inputs that previously failed incidentally, and must be
  documented.

## Release checklist

1. Confirm CI is green on all supported Python versions (3.10–3.13), including
   tests and `ruff check .`.
2. Bump `version` in `pyproject.toml`.
3. Write the release section in `CHANGELOG.md`: separate user-visible changes
   from internal maintenance, list known issues honestly, and do not claim
   fixes that did not land.
4. Run local checks: `python -m unittest discover -v` and `ruff check .`; when
   a network is available, also `python -m build` and `twine check dist/*`.
5. Commit the release, tag `vX.Y.Z`, and push the tag. (There is currently no
   automated publishing job; artifacts are built manually from the tag.)

## Next maintenance items (prioritized)

1. **Unicode handling in `slugify`** (user-visible known issue): non-ASCII
   letters are stripped instead of transliterated. Decide between an optional
   extra dependency or a small built-in fold table, define the documented
   guarantee, and cover it with tests.
2. **Strict version handling for `normalize_version`**: current behavior is
   identity-preserving for compatibility. Evaluate adding PEP 440
   validation/normalization behind a new, clearly named API (or opt-in
   keyword) so existing callers are unaffected, with tests for both modes.
3. **Release automation and CI reproducibility**: add a publishing job for
   tagged releases (pinned actions, `id-token: write` scoped to that job only,
   everything else least-privileged) and pin `ruff` to a version range in CI so
   lint results are reproducible across runs.
