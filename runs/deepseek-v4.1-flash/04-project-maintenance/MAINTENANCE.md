# Maintenance

## Release checklist

1. Confirm the working tree is clean and CI is green on Python 3.10–3.13.
2. Set `version` in `pyproject.toml` and replace `Unreleased` in `CHANGELOG.md`
   with the release date.
3. Run the full test suite (`python -m unittest discover -v`) and lint
   (`ruff check .`).
4. Build the distribution (`python -m build`) and inspect the sdist and wheel
   contents.
5. Install the wheel in a clean virtual environment and smoke-test `slugify`
   and `normalize_version`.
6. Commit, tag the release (`v0.4.0`), and push the commit and tag.
7. Publish to the package index and verify installation from the index.
8. Announce the release using the user-visible changes in `CHANGELOG.md`.

## Compatibility policy

- Supported interpreters: CPython 3.10 through 3.13. Every supported version
  runs in CI; versions outside this range are untested.
- Public API: `slugify` and `normalize_version`. Changes to their documented
  behavior are recorded in `CHANGELOG.md`.
- Versioning: while the project is on `0.x`, minor releases may contain
  breaking changes; patch releases should not.
- Adding a Python version requires a green CI run on that version plus
  metadata and classifier updates. Dropping a Python version is a
  user-visible change and requires a changelog entry.
- `normalize_version()` promises unchanged output for ordinary dotted versions
  and pre-release suffixes. Unusual or malformed spellings are not covered by
  that promise.
- The Unicode transliteration limitation remains documented until it is
  actually fixed.

## Next maintenance items (prioritized)

1. **Unicode-aware `slugify()`** — the current `[^a-z0-9]` regex drops
   non-ASCII letters and transliterates poorly. Evaluate
   `unicodedata.normalize` plus a documented transliteration fallback, add
   tests, and record any new dependency.
2. **Python 3.14 support** — verify the suite on 3.14, then add it to the CI
   matrix, classifiers, and `requires-python`, and update this policy. Do not
   advertise support until CI passes.
3. **Release build smoke test** — add a CI job that runs `python -m build`,
   installs the resulting wheel into a clean environment, and imports the
   package. This catches packaging regressions that unit tests miss.
