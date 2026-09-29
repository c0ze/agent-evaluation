# Maintenance

## Release checklist

- Confirm `pyproject.toml` is at `0.4.0` with
  `requires-python = ">=3.10,<3.14"`, `packaging` dependency,
  Python 3.10-3.13 classifiers, and `ruff target-version = "py310"`.
- Confirm `CHANGELOG.md` matches the release notes with
  user-visible changes separated from internal maintenance.
- Run `python -m unittest discover -v` and `ruff check .` locally.
- Confirm `ci.yml` validates Python 3.10-3.13, uses
  `actions/checkout@v4` and `actions/setup-python@v5`, and sets
  `permissions: contents: read`.
- Tag and publish `0.4.0` only after CI is green.

## Compatibility policy

- Supported Python is 3.10 through 3.13. `requires-python`,
  classifiers, `ruff target-version`, and the CI matrix must stay
  in sync with that window.
- No `distutils` usage: it was removed in Python 3.12. Version
  handling uses `packaging.version.Version`.
- `normalize_version` preserves output for ordinary dotted
  versions and pre-release suffixes (for example `1.2.0`,
  `2.0rc1`); non-PEP 440 inputs fall back to the input string.

## Next maintenance items

1. Fix poor Unicode transliteration in `slugify` (known
   limitation carried from 0.4.0). Decide the strategy
   explicitly and keep current ASCII punctuation behavior.
2. Document and lock the `normalize_version` fallback contract
   for non-PEP 440 inputs with edge-case tests, so future
   `packaging` upgrades cannot silently change it.
3. Keep the supported-Python window current: track 3.13
   validation, plan 3.14 addition and 3.10 retirement per
   upstream status, and update metadata plus CI together.
