# Changelog

## 0.4.0 — Unreleased

### User-visible changes

- `slugify` handles repeated punctuation consistently.
- Python 3.9 support is removed. The supported range is Python 3.10–3.13.
- `normalize_version` no longer depends on deprecated `distutils` internals;
  ordinary version strings retain their spelling, including prerelease suffixes.

### Internal maintenance

- CI tests Python 3.10, 3.11, 3.12, and 3.13, with a separate lint job.
- GitHub Actions remain on `actions/checkout@v4` and
  `actions/setup-python@v5`; workflow permissions are limited to reading contents.
- Release metadata, Ruff's Python target, and regression tests are aligned with
  the supported Python range.

### Known limitation

- Unicode letters are still transliterated poorly. This is not fixed in 0.4.0.
