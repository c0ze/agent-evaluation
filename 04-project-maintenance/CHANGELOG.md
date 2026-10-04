# Changelog

All notable changes to `slugkit` are recorded here. This project follows a
"no invented history" rule: only changes actually made are listed, and the
0.4.0 entry is marked unreleased until a release date is chosen.

## [0.4.0] — unreleased

### User-visible

- **Dropped Python 3.9 support.** `requires-python` is now `>=3.10,<3.14`, and
  the CI test matrix covers 3.10, 3.11, 3.12 and 3.13. Upgrade path: 3.9 users
  must stay on 0.3.2.
- **`slugkit` no longer depends on `distutils`.** The deprecated
  `distutils.version.LooseVersion` import has been removed. `distutils` is no
  longer part of the standard library, so this import made the package fail to
  import outright on the interpreters tested here (Python 3.13.13 and 3.14.3
  both raise `ModuleNotFoundError: No module named 'distutils'`), including on
  3.13, which this release adds to the supported range.
- **`normalize_version` output is unchanged for ordinary versions.**
  `normalize_version("1.2.0") == "1.2.0"` and `normalize_version("2.0rc1") ==
  "2.0rc1"`, as before. Valid dotted forms such as `1.0.post1` and `1.0.dev4`
  are also returned unchanged.
- **`normalize_version` now validates its input.** It raises `ValueError` for
  input that is not a plausible version (for example `""`, `"abc"`, or
  `"1 2 3"`) and `TypeError` for non-`str` input, instead of accepting
  anything. It also strips surrounding whitespace and a single leading `v`, so
  VCS tags like `v0.4.0` normalize to `0.4.0`. This is the one intentional
  behavior change for callers: code that previously passed arbitrary strings
  through `normalize_version` will now get an exception.
- **No change to `slugify` output.** Repeated punctuation has always collapsed
  to a single `-` (`"Hello---World!!"` → `"hello-world"`); that behavior is now
  covered by tests rather than left implicit in the regex. 0.4.0 introduces no
  `slugify` output change.

### Internal

- Removed the last `distutils` import; a test now fails if any import of
  `distutils` reappears in the module.
- CI: test matrix extended from 3.9/3.10 to 3.10–3.13 with `fail-fast: false`,
  so one failing interpreter no longer hides the others.
- CI: linting moved to its own single-interpreter job (3.13) instead of running
  redundantly per matrix entry.
- CI: workflow and both jobs declare `permissions: contents: read`, and a
  `concurrency` group cancels superseded runs.
- CI: dependencies installed via the new `dev` extra (`pip install -e ".[dev]"`).
- CI: `actions/checkout` stays pinned to `@v4` and `actions/setup-python` to
  `@v5`, as required by the release notes.
- Packaging: version bumped to 0.4.0, `ruff` `target-version` moved from `py39`
  to `py310`, and trove classifiers added for 3.10–3.13.

### Known limitations (not fixed in 0.4.0)

- `slugify` transliterates Unicode poorly: non-ASCII letters are **dropped**
  rather than converted, so `slugify("café") == "caf"` and
  `slugify("Grüße") == "gr-e"`. An input made only of non-ASCII letters
  collapses to an empty string (`slugify("ÀÉÎÕÜ") == ""`). This is unchanged in
  0.4.0 and is the top queued maintenance item in `MAINTENANCE.md`. Callers who
  need it must transliterate before calling `slugify`.

## Earlier releases

Not recorded here. Version history before 0.4.0 was not supplied with the
release material, and this changelog deliberately does not reconstruct it.
