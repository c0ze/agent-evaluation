# Maintenance

## Release checklist

- Confirm the `0.4.0` version, Python requirement, classifiers, Ruff target,
  and CI matrix agree with the compatibility policy below.
- Ensure the supplied `ci.yml` is installed as `.github/workflows/ci.yml` at
  the release repository root; this task keeps it in its supplied location.
- On every supported Python version, install the package and run
  `python -m unittest discover -s . -p 'test_*.py' -v`. Install `.[dev]` and run
  `python -m ruff check .` on Python 3.13. Require all CI jobs to pass.
- With build tooling available, run `python -m build`, validate distribution
  metadata with `python -m twine check dist/*`, and install the wheel and sdist
  into clean environments. Smoke-test imports and both helpers from outside
  the source directory to verify the installed artifacts.
- Review `CHANGELOG.md` against `RELEASE_NOTES.txt`, retain the Unicode
  limitation, and replace “Unreleased” with the actual release date when ready.
- Review `RESPONSE.md` for outstanding verification, then tag `v0.4.0` and
  publish the verified artifacts through the project's release process.

## Compatibility policy

Python 3.10 through 3.13 are supported. Package metadata enforces
`>=3.10,<3.14`, and CI tests every minor version in that interval. Ruff targets
Python 3.10 so source syntax remains compatible with the oldest supported
interpreter. A new minor version is supported only after validation and an
update to metadata, classifiers, CI, and this policy; support changes must be
announced in the changelog.

`normalize_version` preserves the spelling of ordinary string versions,
including leading zeroes and prerelease suffixes. It is not a version validator
or comparator. Behavior for invalid inputs or non-string values is outside this
compatibility promise. Unicode transliteration remains a known `slugify`
limitation; changing it needs an explicit behavior decision and regression tests.

## Next three maintenance priorities

1. Complete release validation: obtain passing results for all four supported
   interpreters and Ruff, then verify the wheel and sdist in clean environments.
   Automate artifact smoke tests in CI to catch packaging regressions.
2. Define the intended Unicode transliteration behavior, including language and
   dependency tradeoffs, then add representative tests before changing `slugify`.
3. Specify behavior for empty, malformed, and non-string version inputs, and
   add tests before extending the version helper's compatibility promise.
