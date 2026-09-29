# Maintenance

## Release checklist

- Confirm `pyproject.toml` declares version `0.4.0` and Python `>=3.10,<3.14`.
  Review the changelog against `RELEASE_NOTES.txt`; add the release date only
  when releasing.
- Place the supplied `ci.yml` at `.github/workflows/ci.yml` in the release
  repository. Require its tests on Python 3.10–3.13 and its single lint job to
  pass before publishing.
- Install development tools with `python -m pip install -e '.[dev]'`, then run
  `python -W error -m unittest discover -v` and `python -m ruff check .`.
- Build an sdist and wheel with `python -m build` (install `build` separately).
  Install the wheel in a clean supported-Python environment and smoke-test
  both public helpers; confirm artifact metadata and contents.
- After these checks pass, publish the reviewed artifacts and tag `0.4.0`
  through the project's release process. This task does not publish or tag.

## Compatibility policy

- Release 0.4.0 supports Python 3.10, 3.11, 3.12, and 3.13. Metadata excludes
  Python 3.9 and 3.14; CI tests every supported minor version. New Python
  versions require validation and coordinated metadata/CI updates.
- `normalize_version` preserves ordinary string inputs verbatim, including
  dotted components, zeros, and suffixes. It does not validate version syntax
  or promise legacy exception behavior for empty or non-string inputs.
- `slugify` remains an ASCII-based helper. Unicode transliteration is a known
  limitation. Document deliberate public behavior changes in the changelog
  and accompany them with regression tests.

## Next three maintenance items, in priority order

1. Define the desired Unicode behavior and add non-ASCII regression cases
   before changing `slugify`'s transliteration policy.
2. Define `normalize_version`'s contract for empty, malformed, and non-string
   inputs, then test the chosen behavior without silently canonicalizing
   existing ordinary versions.
3. Automate sdist/wheel builds and clean-environment installation checks in
   CI, and record tested build/lint tool versions for reproducible releases.
