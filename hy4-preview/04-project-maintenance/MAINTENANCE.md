# Maintenance

## Release checklist (0.4.0)

1. Confirm `pyproject.toml` version is the release version and that
   `requires-python` plus the Python classifiers match the supported range
   (3.10-3.13).
2. Run the full local check set:
   - `python -m unittest discover -v` (repeat on each supported interpreter, or
     rely on the CI matrix when only one interpreter is available locally)
   - `ruff check .`
   - `python -m compileall -q .` as a quick syntax smoke test
3. Verify the library imports on the newest supported interpreter with no
   `distutils` present (Python 3.12+): `python -c "import slugkit"`.
4. Update `CHANGELOG.md` from the release notes: user-visible changes first,
   then internal maintenance, then known limitations. Do not claim fixes that
   were not made.
5. Confirm CI is green on every matrix entry, including 3.13, and that the
   workflow still runs with `permissions: contents: read`.
6. Build the distributions (`python -m build`, if available) and check that the
   sdist/wheel contain only the intended module.
7. Tag the release (`v0.4.0`) and publish; then open the first maintenance
   items below for the next cycle.

## Compatibility policy

- Supported interpreters: the four newest CPython releases that the project
  tests against, currently **3.10, 3.11, 3.12 and 3.13**. `requires-python` is
  set to the lower bound only; the upper bound is expressed through the
  classifiers and the CI matrix, so users on a newer interpreter are not
  blocked from installing, but only the tested range is supported.
- Dropping an interpreter is a minor-version change: announce it in
  `CHANGELOG.md`, update `requires-python`, the classifiers, the CI matrix and
  the ruff `target-version` in the same commit.
- Public behaviour (`slugify`, `normalize_version`) is stable within a minor
  version. Behaviour changes to `normalize_version` are treated as breaking and
  need a documented deprecation or a minor bump.
- Standard-library APIs that are deprecated or removed (such as `distutils`)
  must not be used; replacements must preserve observable output for ordinary
  inputs and be covered by tests.
- Dependencies: runtime dependencies are avoided; tooling (ruff, build) is
  installed in CI only.

## Next three maintenance items (prioritized)

1. **Fix or explicitly document Unicode handling in `slugify`.** This is the
   oldest known limitation: non-ASCII letters are dropped instead of
   transliterated (`Ärger` -> `rger`), which silently mangles real titles.
   Decide between adding a small transliteration dependency (or `unicodedata`
   NFKD folding) and documenting the ASCII-only contract, then pin the chosen
   behaviour with tests.
2. **Give `normalize_version` a defined normalization contract.** The current
   behaviour is inherited from `distutils.version.LooseVersion`: the input
   string is returned unchanged and only empty/component-free input is
   rejected. Decide whether to adopt PEP 440 (for example via
   `packaging.version`) with a documented migration, or to keep the
   pass-through behaviour and rename/document the function so callers are not
   surprised.
3. **Harden packaging and release automation.** Add typing markers
   (`py.typed`) and a coverage gate, verify the built sdist/wheel contents in
   CI, and add a release workflow that publishes from a tag only. The
   flat-layout metadata and the CI permissions were tightened in 0.4.0, but the
   build artifacts are still unverified automatically.
