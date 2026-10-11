# Maintenance

## Compatibility policy

- slugkit 0.4.x supports Python 3.10 through 3.13. `pyproject.toml` declares
  `requires-python = ">=3.10,<3.14"` and CI tests all four minor versions.
- A Python version is dropped only in a minor release, never in a patch
  release; a new Python version is added to CI (and the supported range) once
  it is validated there.

## Release checklist

1. Bump `version` in `pyproject.toml`.
2. Update `CHANGELOG.md`: add a section for the new version, separate
   user-visible changes from internal maintenance, and only claim changes
   that were actually made (known limitations must stay listed as such).
3. Confirm `requires-python`, the ruff `target-version`, and the CI matrix
   still match the supported Python range.
4. Run the local checks: `python -m unittest` and `ruff check .`.
5. Commit, tag the release (e.g. `v0.4.0`), and publish.

## Prioritized maintenance items

1. **Improve Unicode handling in `slugify`.** Non-ASCII letters are currently
   transliterated poorly (known limitation, not fixed in 0.4.0). Needs a
   design decision (e.g. `unicodedata` NFKD normalization + transliteration
   table) before implementation.
2. **Add static typing.** Ship a PEP 561 `py.typed` marker and run a type
   checker (e.g. mypy or pyright) in CI so the public API is type-checked.
3. **Harden `normalize_version` edge cases.** Document and test the
   PEP 440 normalization differences versus the old `LooseVersion` behavior
   (e.g. `"v1.2"`, `"1.02"`, `"1.2.3-rc.1"`) and decide whether a
   compatibility shim is warranted.
