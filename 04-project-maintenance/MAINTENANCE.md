# Maintenance

## Release checklist

1. Update `version` in `pyproject.toml`.
2. Update `CHANGELOG.md`: move items under a dated release heading, keeping
   user-visible changes separate from internal maintenance.
3. Run tests (`python -m unittest`) and lint (`ruff check .`) locally.
4. Confirm CI is green across the full supported Python matrix.
5. Tag the release and build/publish the distribution.

## Compatibility policy

- slugkit supports the Python versions listed in `requires-python` in
  `pyproject.toml` (currently 3.10–3.13); the CI matrix must match this
  range.
- Public API is `slugify` and `normalize_version`; their observable behavior
  for ordinary inputs must not change in patch/minor releases.
- `normalize_version` must keep accepting non-PEP 440 strings and echoing
  them back unchanged (legacy behavior retained from the distutils era).
- Known limitation: Unicode transliteration in `slugify` is poor; do not
  claim improvements without actual changes.

## Next maintenance items (prioritized)

1. Improve Unicode transliteration in `slugify` (e.g., fold accented letters
   to ASCII before slugging) — the top known user-visible limitation.
2. Expand test coverage for version-string edge cases (leading `v`, zero
   padding, dev releases) so future parser swaps stay behavior-compatible.
3. Set up automated release publishing from CI (e.g., trusted publishing on
   tags) to make the release checklist step 5 repeatable.
