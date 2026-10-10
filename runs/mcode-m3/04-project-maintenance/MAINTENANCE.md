# Maintenance Guide

This document describes how `slugkit` is released, what its compatibility
commitments are, and what the maintainers should focus on next.

## Release Checklist

For every minor or major release, the following steps must pass before
tagging a release:

1. **Decide the version bump.** Patch releases are bug fixes that preserve
   observable behavior; minor releases may change or remove deprecated APIs;
   major releases may break the public surface. This release is `0.4.0`, a
   minor bump that drops Python 3.9 and replaces an internal dependency.
2. **Update `pyproject.toml`.** Bump `version`, confirm `requires-python`
   matches the supported range, and confirm declared dependencies are still
   correct.
3. **Refresh `CHANGELOG.md`.** Move the in-progress entry from "Unreleased"
   to a dated heading and ensure user-visible and internal changes are
   listed separately.
4. **Update `ci.yml`.** Make sure the Python matrix matches the supported
   range, and that `actions/checkout@v4` and `actions/setup-python@v5`
   remain pinned (no floating to `@latest`).
5. **Run local checks.** Install the package in editable mode, run
   `python -m unittest discover -v`, and run `ruff check .`. All must pass.
6. **Tag the release.** Create a git tag of the form `v<version>` and push
   it. No additional network publishing is configured in this repository.
7. **Sanity check the distribution build.** Run
   `python -m pip wheel --no-deps -w dist/` and inspect the produced wheel
   name to confirm metadata is correct.

## Compatibility Policy

`slugkit` follows these compatibility commitments:

- **Python versions.** The currently supported range is
  `>=3.10,<3.14` (3.10, 3.11, 3.12, 3.13). New Python versions are added to
  the matrix and `pyproject.toml` when their first stable release ships; old
  versions are dropped when they reach end-of-life upstream.
- **Public API.** The two public functions `slugify` and `normalize_version`
  are stable within a major version. Behavior changes go through a minor
  release with a changelog entry.
- **Dependencies.** Runtime dependencies are kept to a small set
  (`packaging` is currently the only one) and are pinned with a lower bound
  chosen so that any supported version satisfies it.
- **Internal modules.** Replacing or removing internals (such as the move
  from `distutils.version` to `packaging.version`) does not require a
  major version bump as long as the public API's observable behavior is
  preserved.

## Next Three Prioritized Maintenance Items

1. **Improve Unicode handling in `slugify` (known limitation).** Non-ASCII
   letters are dropped rather than transliterated. The 0.4.0 release
   explicitly does not claim to fix this. The next step is to evaluate
   `unicodedata.normalize("NFKD", ...)` plus an ASCII filter, gated by a
   regression test that pins the chosen transliteration policy.
2. **Move to a `src/` layout with explicit package data.** The repository
   currently ships a flat module. Moving to `src/slugkit/__init__.py` would
   prevent accidental imports from the working directory and make the
   wheel contents easier to audit.
3. **Add a build/distribution verification job to CI.** The release checklist
   calls for a local wheel build, but CI does not yet run `python -m build`
   or upload artifacts. Adding this step would catch metadata regressions
   (wrong `requires-python`, missing files) before tagging a release.