# Maintenance

## Release checklist

1. Update `version` in `pyproject.toml` and add a `CHANGELOG.md` entry for the
   new release.
2. Run the local checks: `python -m unittest` and `python -m ruff check .`
   (at minimum on the oldest and newest supported Pythons, 3.10 and 3.13).
3. Confirm CI is green on all supported versions (3.10 through 3.13).
4. Build the sdist and wheel (for example with `python -m build`) and check
   that they install and import cleanly.
5. Tag the release (`vX.Y.Z`) and push the tag.

## Compatibility policy

- Supported Python versions: 3.10 through 3.13.
- A Python version is dropped only in a minor release, after it reaches
  end-of-life, and the drop is announced in the changelog.
- `normalize_version` output is stable for ordinary dotted versions with an
  optional lowercase pre-release suffix (for example `1.2.0`, `2.0rc1`).
  Only the handling of invalid input may change between releases.
- `slugify` output is considered stable for ASCII input.
- While the project is 0.x, breaking changes to public behavior require a
  minor version bump.

## Next maintenance items (prioritized)

1. Improve Unicode handling in `slugify`; letters outside ASCII are currently
   transliterated poorly (known limitation, see the changelog).
2. Complete packaging metadata in `pyproject.toml` (license, readme,
   classifiers) and verify `python -m build` produces a valid sdist and wheel.
3. Add a static type-checking job (for example mypy in strict mode) to CI.
