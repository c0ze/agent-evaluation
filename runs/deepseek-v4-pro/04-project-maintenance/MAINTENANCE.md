# Maintenance

## Release checklist

1. Update the version in `pyproject.toml`.
2. Set the Ruff `target-version` and `requires-python` if the supported Python
   range changes.
3. Update `CHANGELOG.md` from the release notes, separating user-visible
   changes from internal maintenance.
4. Update the CI matrix so it covers the supported Python range.
5. Run `python -m unittest` and `ruff check .` locally.
6. Tag the release and publish the built artifact.

## Compatibility policy

- Supported Python versions: 3.10, 3.11, 3.12, and 3.13.
- A Python version is dropped when it reaches end-of-life, removed from the CI
  matrix and `requires-python` in the same release.
- `normalize_version` must not change its observable output for ordinary dotted
  versions; behavioral changes require a changelog entry.

## Prioritized maintenance items

1. Improve `slugify` so that non-ASCII/Unicode letters are transliterated
   correctly (currently a known limitation).
2. Increase test coverage, including parametrized `slugify`/`normalize_version`
   cases and edge-case inputs (empty strings, punctuation-only input).
3. Add packaging automation: build and publish a source/wheel distribution and
   wire up a release workflow.