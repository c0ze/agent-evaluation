# Maintenance

## Release checklist (0.4.0)

1. Bump `version` in `pyproject.toml` and update `CHANGELOG.md`.
2. Confirm `requires-python` and CI matrix match the supported range (3.10–3.13).
3. Run `python -m unittest` and `ruff check .`; fix all findings.
4. Verify `normalize_version` parity on ordinary versions (`1.2.0`, `2.0rc1`, …).
5. Tag `v0.4.0` and publish.

## Compatibility policy

- Support the Python range declared in `requires-python` (`>=3.10,<3.14`).
- Drop a Python minor version only in a minor/major release with a changelog entry.
- Keep GitHub Actions pinned to the adopted majors (`checkout@v4`,
  `setup-python@v5`); upgrade majors deliberately, not implicitly.
- Avoid deprecated stdlib (`distutils`); prefer maintained `packaging`.

## Next maintenance items (prioritized)

1. Improve Unicode handling in `slugify` (transliteration, e.g. via `unicodedata`
   normalization) — known user-facing limitation.
2. Tighten `normalize_version` contract: decide whether non-PEP 440 input should
   raise `InvalidVersion` instead of passing through, and document it.
3. Pin dev tooling (`ruff`) minimum version in build/test requirements for
   reproducible lint.
