# Maintenance

## Release checklist

1. Update `version` in `pyproject.toml` and move the `Unreleased` notes in
   `CHANGELOG.md` into a dated release heading.
2. Confirm `requires-python`, ruff `target-version`, the CI test matrix, and
   classifier metadata all name the same supported Python range.
3. Run `python -m unittest discover -v` and `ruff check .` locally.
4. Confirm CI is green on every supported Python version.
5. Build the distribution (`python -m build`) and verify the wheel metadata
   declares the intended version and Python range.
6. Tag the release and publish the distribution.

## Compatibility policy

- Supported Python versions are 3.10 through 3.13. Python 3.9 and earlier are
  not supported; dropping or adding a Python version requires updating
  `pyproject.toml` metadata and the CI matrix together.
- `normalize_version` preserves the observable string output of the former
  `distutils.version.LooseVersion` implementation for ordinary versions. Inputs
  that `packaging` cannot parse are returned unchanged, keeping the legacy
  permissive behaviour.
- Public function signatures (`slugify`, `normalize_version`) remain stable
  within the 0.x series.

## Next prioritized maintenance items

1. Improve Unicode transliteration in `slugify` (known limitation; explicitly
   not addressed in 0.4.0).
2. Pin CI dependencies (the `ruff` install) to explicit versions and add
   automated dependency updates.
3. Expand version-normalization tests to cover more legacy edge cases and
   document the exact compatibility boundary of `normalize_version`.
