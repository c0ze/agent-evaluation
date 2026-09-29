# Changelog

## 0.4.0 — Unreleased

### User-visible changes

- Repeated punctuation in `slugify` consistently collapses to one separator.
  This behavior was already implemented in the supplied code.
- Supported Python versions are now 3.10 through 3.13; Python 3.9 support ends.
- Version handling no longer depends on deprecated `distutils` internals.
  Ordinary version strings retain their original text, including pre-release
  suffixes and leading or trailing zeros.

### Internal maintenance

- CI covers Python 3.10, 3.11, 3.12, and 3.13, with a separate lint job.
- CI uses read-only repository permissions and disables persisted checkout
  credentials. Actions remain `actions/checkout@v4` and
  `actions/setup-python@v5`.
- Package metadata, Ruff's Python target, and regression tests match the
  supported compatibility range.

### Known limitation

- Unicode letters are still transliterated poorly by `slugify`; this release
  does not fix Unicode handling.
