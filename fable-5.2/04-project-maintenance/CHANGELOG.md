# Changelog

## 0.4.0 — not yet released

The release date is set when the tag is cut (see `MAINTENANCE.md`).

### User-visible changes

- **Python 3.9 is no longer supported.** `requires-python` is now `>=3.10`.
- **Python 3.13 is now validated.** The supported and CI-tested range is
  Python 3.10 through 3.13.
- **`normalize_version` no longer uses `distutils`.** The deprecated version
  parsing internals were replaced, so the module now imports on Python 3.12
  and later, where `distutils` is gone from the standard library. Output for
  ordinary versions is unchanged (`"1.2.0"` → `"1.2.0"`, `"2.0rc1"` →
  `"2.0rc1"`).
  - Invalid input is reported differently: an empty string now raises
    `ValueError`, and a non-string raises `TypeError`. Both were already
    errors; the exception type was previously an incidental `AttributeError`
    for an empty string and for `None`.
- **`slugify` handles repeated punctuation consistently.** A run of
  punctuation or whitespace becomes a single hyphen (`"a!!!b"` → `"a-b"`).
  The behavior was already in the code; this release adds test coverage for
  it and makes no further change to `slugify`.

### Known limitations

- Unicode letters are still transliterated poorly by `slugify`: anything
  outside ASCII `a-z` and `0-9` is treated as a separator, so `"Café au lait"`
  becomes `"caf-au-lait"`. This is **not** fixed in 0.4.0.

### Internal maintenance

- CI tests Python 3.10, 3.11, 3.12 and 3.13 (3.9 removed), with
  `DeprecationWarning` treated as an error during the test run.
- CI lint runs once in its own job instead of once per Python version.
- The CI workflow token is restricted to `contents: read`, and checkout no
  longer persists credentials.
- CI actions remain `actions/checkout@v4` and `actions/setup-python@v5`.
- Ruff targets `py310`, matching the minimum supported Python.
- Package metadata lists the supported Python versions as classifiers and
  names `slugkit` explicitly as the only shipped module.
- Tests added for the `normalize_version` replacement, including a
  comparison against `distutils` on interpreters that still have it.
