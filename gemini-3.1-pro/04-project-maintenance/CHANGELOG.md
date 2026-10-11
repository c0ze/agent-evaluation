# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0]

### User-Visible Changes
- `slugify`: Handles repeated punctuation consistently.
- Supported Python Range: Dropped support for Python 3.9; added validation and official support for Python 3.13 (supported range is now Python 3.10 through 3.13).

### Internal Maintenance
- Version Parsing: Replaced deprecated `distutils.version.LooseVersion` usage with `packaging.version.Version` while retaining observable behavior for ordinary versions.
- CI Workflow: Updated workflow to be least-privileged (`permissions: contents: read`), pinned GitHub Actions to major versions (`actions/checkout@v4`, `actions/setup-python@v5`), separated test and lint jobs, and updated matrix to Python 3.10 through 3.13.
- Metadata & Tooling: Updated `pyproject.toml` dependencies, package metadata classifiers, and Ruff `target-version` to Python 3.10+.

### Known Limitations
- Unicode letter transliteration in `slugify` remains limited and is not claimed as fixed in this release.
