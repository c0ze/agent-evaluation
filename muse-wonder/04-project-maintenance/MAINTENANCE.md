# Maintenance

## Release checklist

1. Update `version` in `pyproject.toml` and add the matching
   `CHANGELOG.md` entry, keeping user-visible changes separate from
   internal maintenance.
2. Confirm `requires-python`, the Python classifiers, the Ruff
   `target-version`, and the CI matrix all describe the same supported
   range.
3. From a fresh project environment, run the checks:

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   python -m pip install -e ".[dev]"
   python -m unittest discover -v
   ruff check .
   ```

4. Confirm CI is green on every supported Python version before tagging
   the release.

## Compatibility policy

- Supported Python range is 3.10 through 3.13
  (`requires-python = ">=3.10,<3.14"`). The Ruff target `py310` is the
  oldest supported syntax level.
- `normalize_version` preserves output for ordinary dotted versions,
  including pre-release suffixes such as `2.0rc1`. Inputs that are not
  ordinary versions raise `ValueError`.
- Dropping a supported Python version is a user-visible change. It is
  announced in `CHANGELOG.md`, as with the removal of Python 3.9 in
  0.4.0.

## Next maintenance priorities

1. **Fix Unicode transliteration in `slugify` (P1).** This is the only
   known user-visible limitation recorded for 0.4.0, and `slugify`
   currently produces poor output for Unicode letters.
2. **Broaden `normalize_version` edge-case coverage (P2).** The
   `distutils` replacement is new in 0.4.0; more ordinary-version cases
   in the test suite reduce the risk of output drift on the supported
   Python range.
3. **Review CI pins before the next Python release (P3).** Keep
   `actions/checkout` v4 and `actions/setup-python` v5 until a major
   upgrade is reviewed, and validate the next Python version in CI
   before widening `requires-python`.
