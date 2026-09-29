# Maintenance

## Release checklist

1. Set `version` in `pyproject.toml` to the release you are cutting.
2. Update `CHANGELOG.md`. Keep user-visible changes separate from internal maintenance, and leave open limitations listed as open.
3. Check that `requires-python`, the Python classifiers, Ruff's `target-version`, and the CI matrix all name the same supported range. Keep `actions/checkout` at v4, `actions/setup-python` at v5, and workflow permissions at `contents: read`.
4. From this directory, run `python -m unittest` and `python -m ruff check .`.
5. Tag the release only after those checks pass.

## Compatibility policy

Slugkit supports CPython 3.10, 3.11, 3.12, and 3.13. A Python version enters or leaves that set only when `requires-python`, the classifiers, and CI change in the same release, and the changelog records the change. Python 3.9 was removed in 0.4.0. Later versions, including 3.14, stay outside the support window until that metadata is updated together.

`normalize_version` keeps the historical spelling of ordinary versions. Dotted numbers such as `1.2.0` and `8.02`, and pre-release suffixes such as `2.0rc1` and `3.10a`, are returned unchanged. Moving to PEP 440 canonical form would be a user-visible changelog entry.

`slugify` collapses repeated punctuation to a single hyphen. That behavior is part of the 0.4.0 contract. Unicode letters remain a known limitation and are outside that contract.

## Next maintenance items

1. Give `slugify` an explicit Unicode policy. Letters outside ASCII are dropped or turned into hyphens (`Café` becomes `caf`, and `東京` becomes an empty string). The 0.4.0 notes leave this unresolved.
2. Decide whether `normalize_version` should reject non-ordinary strings. Any non-empty string is still returned unchanged, which preserves old `LooseVersion` output for ordinary versions such as `1.2.0`, `8.02`, and `2.0rc1`, and also accepts other spellings. Keep those ordinary spellings stable if validation gets stricter.
3. Take a position on Python 3.14. The supported range stops at 3.13. Add 3.14 to metadata and CI after the tests pass on it, or keep recording it as unsupported.
