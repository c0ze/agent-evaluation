# Changelog

## 0.4.0

### User-visible

- `slugify` handles repeated punctuation consistently: every run of
  non-alphanumeric characters collapses into a single `-`
  (e.g. `"Hello,,   World!!"` -> `"hello-world"`).
- Python 3.9 is no longer supported. The supported range is 3.10 through 3.13;
  3.13 is now validated in CI.
- `normalize_version` no longer imports `distutils`, which was removed from the
  standard library in Python 3.12. Ordinary versions keep their previous output
  (`"1.2.0"` -> `"1.2.0"`, `"2.0rc1"` -> `"2.0rc1"`), and values containing no
  digits or letters are now rejected with `ValueError` instead of being echoed
  back (an empty string previously failed with `AttributeError`).

### Internal maintenance

- CI matrix updated to 3.10-3.13 and runs with the least-privilege token
  (`contents: read`) and without persisted checkout credentials.
- `actions/checkout` pinned to `v4` and `actions/setup-python` to `v5`.
- Ruff `target-version` moved to `py310` to match `requires-python`.

### Known limitations (unchanged in 0.4.0)

- Unicode letters are still transliterated poorly by `slugify`. This release
  does not address it.
