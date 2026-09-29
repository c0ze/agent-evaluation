# Changelog

All notable changes to `slugkit` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Releases before 0.4.0 predate this
file and are not reconstructed.

## [0.4.0] - Unreleased

### Changed

- **Python support.** Python 3.9 is no longer supported; `requires-python` is now `>=3.10`.
  Python 3.13 is now validated in CI, so the supported range is 3.10 through 3.13.
- **`normalize_version` no longer uses `distutils`.** `distutils` is deprecated since
  Python 3.10 and was removed from the standard library in 3.12; the old implementation only
  kept importing where setuptools happened to install its compatibility shim. Output for
  ordinary version strings is unchanged: the input is returned exactly as given, including
  pre-release suffixes (`"1.2.0"` -> `"1.2.0"`, `"2.0rc1"` -> `"2.0rc1"`), and strings that
  PEP 440 would canonicalise (such as `"1.0-rc1"`) are still returned untouched.
- `normalize_version("")` now raises `ValueError` instead of an `AttributeError` escaping from
  `distutils`. Non-string input still raises `TypeError`.

### Fixed

- `slugify` collapses repeated punctuation and whitespace into a single hyphen consistently
  (`"Hello,,, World!!!"` -> `"hello-world"`, `"a--b__c!!d"` -> `"a-b-c-d"`). This was already
  present in the code before this release was prepared and is now covered by tests.

### Known limitations

- `slugify` does not transliterate non-ASCII letters; they are dropped along with surrounding
  punctuation, so `"Crème brûlée"` becomes `"cr-me-br-l-e"`. This is **not** fixed in 0.4.0.

### Internal

- CI: the test matrix covers Python 3.10, 3.11, 3.12 and 3.13; linting runs in its own job
  (`ruff check` plus `ruff format --check`); the workflow token is restricted to
  `contents: read` and checkout no longer persists credentials. Actions remain pinned to
  `actions/checkout@v4` and `actions/setup-python@v5`.
- Packaging: `py-modules = ["slugkit"]` is declared explicitly. Without it, setuptools'
  flat-layout auto-discovery aborted the build with "Multiple top-level modules discovered in
  a flat-layout: ['slugkit', 'test_slugkit']", so `pip install -e .` did not work. The ruff
  `target-version` is now `py310`, and ruff is pinned through a `dev` extra.
- Tests: added coverage for `normalize_version` (identity on ordinary and non-canonical inputs,
  whitespace preservation, error cases, a differential check against `distutils` where it is
  still importable, and a fresh-interpreter check that importing and calling the module
  neither imports `distutils` nor emits warnings) and for `slugify` (repeated punctuation,
  separator-only input, and the non-ASCII limitation above).
