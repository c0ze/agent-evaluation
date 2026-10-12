# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2024-XX-XX

### Changed
- Drop support for Python 3.9; require Python 3.10 through 3.13.

### Fixed
- `slugify` now handles repeated punctuation consistently.

### Internal
- Replace deprecated `distutils.version.LooseVersion` with a custom version normalizer.
- CI workflow updated to test against Python 3.10–3.13.

### Known Limitations
- Unicode letters are transliterated poorly; this is not fixed in 0.4.0.