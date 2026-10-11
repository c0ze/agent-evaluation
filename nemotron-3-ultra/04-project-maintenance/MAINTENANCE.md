# Maintenance Guide

## Release Checklist

1. **Version bump**: Update `version` in `pyproject.toml`.
2. **Changelog**: Add entries to `CHANGELOG.md` under a new version header.
3. **Tests**: Run `python -m unittest` and `ruff check .` locally.
4. **Build**: Run `python -m build` to verify package builds.
5. **Tag**: Create a signed git tag `vX.Y.Z`.
6. **Publish**: Upload to PyPI with `twine upload dist/*`.
7. **GitHub Release**: Create a release from the tag with changelog notes.

## Compatibility Policy

- **Python versions**: Support the latest four minor versions (currently 3.10–3.13).
- **Dropping support**: Announce deprecation one release before removal.
- **Dependencies**: Minimize runtime dependencies; prefer stdlib or single well-maintained packages.
- **Breaking changes**: Require a major version bump; document migration in changelog.

## Next Prioritized Maintenance Items

1. **Improve Unicode handling in `slugify`**: Add optional transliteration support (e.g., via `unidecode`) to better handle non-ASCII input.
2. **Add `packaging` as optional dependency**: Use `packaging.version.Version` for stricter PEP 440 compliance when available, falling back to the built-in normalizer.
3. **Add type hints and `py.typed` marker**: Enable static type checking for consumers and improve IDE support.