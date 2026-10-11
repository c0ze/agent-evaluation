# Changelog

All notable changes to this project are documented in this file.

## [0.4.0] - Unreleased

### Removed

- Python 3.9 is no longer supported.

### Changed

- Supported Python versions are 3.10 through 3.13.
- `slugify` handles repeated punctuation consistently: runs of punctuation or other
  non-alphanumeric characters become a single hyphen, and leading and trailing hyphens
  are removed (for example, `slugify("a!!!b???c")` returns `"a-b-c"`).
- `normalize_version` returns its input unchanged. Output for ordinary versions such as
  `1.2.0` and `2.0rc1` is the same as before. An empty string now returns `""` instead of
  raising `AttributeError`.

### Known limitations

- Non-ASCII letters are not transliterated. `slugify` treats them as separators, so
  `slugify("café")` returns `"caf"`. This is not fixed in 0.4.0.

### Internal

- Removed the `distutils` dependency from `normalize_version`. `distutils` was removed
  from the standard library in Python 3.12.
- Test matrix is Python 3.10, 3.11, 3.12, and 3.13. Lint runs as its own job.
- CI workflow token permissions are read-only (`contents: read`), and checkout does not
  persist credentials. Actions remain `actions/checkout@v4` and `actions/setup-python@v5`.
- Added a `dev` extra (`ruff`) so local and CI linting use the same install.
- Added tests for repeated-punctuation handling, additional ordinary version strings, and
  a check that `slugkit` does not import `distutils`.
