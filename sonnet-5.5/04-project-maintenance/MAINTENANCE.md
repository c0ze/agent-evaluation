# Maintenance

## Release checklist

1. Confirm `CHANGELOG.md` has an entry for the release; replace "unreleased" with the
   release date and keep user-visible changes separate from internal maintenance.
2. Confirm `version` in `pyproject.toml` matches the changelog heading.
3. Confirm the `requires-python` lower bound, the `Programming Language :: Python ::`
   classifiers, ruff `target-version` and the CI matrix all describe the same range.
4. Run the local checks on every supported interpreter:
   `python -m unittest discover -v` (3.10, 3.11, 3.12, 3.13) and `ruff check .`.
5. Check that `pip install -e .` (or a wheel build) succeeds from a clean environment.
6. Confirm CI is green: the `lint` job and all four `test` matrix jobs.
7. Tag the release commit (for example `v0.4.0`) and publish using your usual process.
8. After publishing, add a fresh "unreleased" section to `CHANGELOG.md`.

## Compatibility policy

- **Supported Python versions:** 3.10 through 3.13. A version is supported only while it
  is in the CI matrix and in the package classifiers.
- **Adding a version:** add it to the CI matrix first; add the classifier once it passes.
- **Dropping a version:** drop a Python version once upstream marks it end-of-life, in a
  minor release, and list the removal under "User-visible changes" in the changelog.
  Update `requires-python`, classifiers, ruff `target-version` and CI together.
- **Upper bound:** `requires-python` has a lower bound only. Untested newer Python
  versions are not blocked from installing, but they are not supported until tested.
- **Public behavior:** `slugify` and `normalize_version` are the public API. Until 1.0,
  minor releases may change behavior, but every change is called out in the changelog.
  `normalize_version` returns ordinary versions unchanged and does not canonicalise;
  changing that is a behavior change.
- **Dependencies:** none at runtime. Avoid adding one for a small helper without a
  recorded reason in this file.
- **CI actions:** stay on the major versions in use (`actions/checkout@v4`,
  `actions/setup-python@v5`) and keep workflow permissions at `contents: read` unless a
  job demonstrably needs more.

## Next maintenance items (priority order)

1. **Revisit the Python support window.** Python 3.10 reaches upstream end-of-life in
   October 2026, and Python 3.14 is not yet tested here. Add 3.14 to the CI matrix, and
   plan the 3.10 drop for the next minor release under the policy above.
2. **Address the Unicode transliteration limitation in `slugify`.** It is the one
   documented user-facing weakness. Decide on scope first (for example, stdlib
   `unicodedata` decomposition versus an optional dependency), add tests for the
   intended behavior, then change the code and announce it in the changelog.
3. **Decide the real contract of `normalize_version`.** It currently returns its input
   unchanged, exactly as the old `LooseVersion` code did, so the name overstates what it
   does. Either document that as the contract or introduce real normalization (for
   example via `packaging`) as a deliberate, changelogged behavior change.
