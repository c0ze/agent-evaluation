# Changelog

## 0.4.0

### User-visible changes

- `slugify` handles repeated punctuation consistently (e.g. `"Hello,  World!!"`
  slugifies to `"hello-world"`); this behavior is now covered by tests.
- Dropped support for Python 3.9. The supported Python range is now 3.10
  through 3.13.
- Added validation on Python 3.13: CI now tests every supported version
  (3.10, 3.11, 3.12, 3.13).

### Internal maintenance

- Replaced the deprecated `distutils.version.LooseVersion` internals in
  `normalize_version` with `packaging.version.Version`. Output for ordinary
  dotted versions and pre-release suffixes (e.g. `"2.0rc1"`) is unchanged;
  `packaging` is now declared as a dependency.
- CI workflow is least-privileged (`permissions: contents: read`), tests the
  full supported Python matrix without `fail-fast`, and keeps the pinned
  major action versions (`actions/checkout@v4`, `actions/setup-python@v5`).

### Known limitations

- Unicode letters are still transliterated poorly by `slugify`. This is a
  known limitation and is **not** fixed in 0.4.0.
