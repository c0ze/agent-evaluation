# Maintenance

## Release checklist

1. Confirm the supported Python matrix in `ci.yml`, `requires-python`
   and the classifiers in `pyproject.toml`, and Ruff's `target-version`
   all agree.
2. Bump `version` in `pyproject.toml` and move release notes into
   `CHANGELOG.md`, separating user-visible changes from internal
   maintenance and listing known limitations honestly.
3. Run `python -m unittest discover -v` and `ruff check .` locally.
4. Confirm CI is green on every supported Python version and the lint
   job before tagging.
5. Build the sdist and wheel and inspect their metadata (name,
   version, `Requires-Python`, dependencies) before publishing.
6. Tag the release with the exact version from `pyproject.toml`
   (for example `v0.4.0`) and publish the artifacts built in step 5.
7. After publishing, smoke-test an install of the published artifact
   in a clean environment on the oldest and newest supported Python.

## Compatibility policy

- Supported and CI-tested Pythons for 0.4.0 are 3.10, 3.11, 3.12, and
  3.13. `requires-python` is `>=3.10` with no upper bound, so a newer
  Python may install the package, but it is not considered supported
  until it is added to the CI matrix and the trove classifiers.
- Dropping a Python version happens only in a minor (or major) release,
  is announced in `CHANGELOG.md` under "Removed", and generally follows
  upstream Python end-of-life.
- `normalize_version` follows PEP 440 (via `packaging`). Output for
  ordinary versions is stable; inputs that are not valid PEP 440 raise
  `packaging.version.InvalidVersion`. Widening or tightening what is
  accepted is a user-visible change and needs a changelog entry and
  tests.
- Runtime dependencies are kept minimal. Adding one, or raising a
  minimum dependency version in a way that narrows supported
  environments, is recorded in `CHANGELOG.md`.
- While the project is 0.x, breaking changes may land in minor
  releases; patch releases contain only backward-compatible fixes.

## Next three maintenance items (prioritized)

1. **Fix Unicode handling in `slugify`.** This is the documented known
   limitation: non-ASCII letters are currently treated as separators.
   Decide on a transliteration/normalization approach (for example
   `unicodedata` normalization), add tests for accented and non-Latin
   input, and record the behavior change in the changelog.
2. **Add a distribution build check to CI.** CI currently tests and
   lints but never builds an sdist/wheel, so a packaging regression
   (such as a missing `py-modules` entry) would only surface at release
   time. Build both artifacts and check their metadata in CI.
3. **Validate the next Python release and plan the 3.10 end-of-life.**
   Add the next Python version to the CI matrix and classifiers once
   available, and schedule dropping 3.10 in a minor release after its
   upstream end-of-life, per the compatibility policy above.
