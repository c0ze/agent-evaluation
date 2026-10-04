# Maintaining `slugkit`

## Compatibility policy

- **Supported Python:** 3.10, 3.11, 3.12, 3.13. This is the *complete* tested
  range — it is enforced in three places that must be changed together:
  1. `requires-python = ">=3.10,<3.14"` in `pyproject.toml`
  2. `tool.ruff.target-version` in `pyproject.toml` (tracks the floor, `py310`)
  3. the `matrix.python` list in `ci.yml`
- **Support window:** the current stable CPython plus the three minor releases
  below it. When a new minor (e.g. 3.14) ships, add it, and drop the oldest
  version still inside the window, in the same PR.
- **Standard library only.** `slugkit.py` has no runtime dependencies. Do not
  add one without a documented reason in `CHANGELOG.md`; adding a dependency
  is a user-visible change, not internal maintenance.
- **No `distutils`.** It is removed from the standard library. A test fails if
  any import of it reappears, so if you need real version parsing, use a
  deliberate, tested approach and expect to re-open the behavior contract in
  `CHANGELOG.md`.
- **Compatibility guarantee:** for ordinary version strings,
  `normalize_version` output is part of the public API and must not change
  without a major-version bump. Changes that make previously-accepted input
  raise are allowed only as a documented, user-visible changelog entry — 0.4.0
  did exactly this when `normalize_version` started validating.

## Release checklist

Work top to bottom; each step is verifiable before moving on.

1. **Version bump.** Set `version` in `pyproject.toml` to the new version.
2. **Changelog.** Move the `CHANGELOG.md` entry out of "unreleased" and add a
   real release date. Keep user-visible changes separate from internal ones,
   and do not list a fix as shipped unless it is merged *and* tested.
3. **Compatibility alignment.** Update `requires-python`, the trove
   classifiers, `tool.ruff.target-version`, and the CI matrix together (see the
   policy above). Mismatched entries are the most common release bug here.
4. **Local checks.** From the project root:
   - `python -m unittest discover -v` — must be fully green.
   - `ruff check .` — must be clean.
   - `python -c "import slugkit"` — catches import-time breakage on your
     interpreter.
5. **Multi-interpreter check.** Run the suite on at least the floor (3.10) and
   the newest supported version. Do not skip 3.13: it is the interpreter that
   exposed the `distutils` failure.
6. **CI green on every matrix entry.** Not just the first one — the matrix uses
   `fail-fast: false` precisely so per-version failures stay visible.
7. **Tag and publish.** Tag the release, build with `python -m build`, and
   confirm the artifact imports (`python -c "import slugkit; print(slugkit.__file__)"`)
   outside the source tree before announcing it.

## Next three maintenance items, in priority order

1. **Fix `slugify` Unicode handling (the known 0.4.0 limitation).**
   Non-ASCII letters are dropped or turned into separators, so
   `slugify("café") == "caf"`, `slugify("naïve") == "na-ve"`, and
   `slugify("Grüße") == "gr-e"`. Worst case, an all-non-ASCII input collapses to
   the empty string: `slugify("ÀÉÎÕÜ") == ""`, which is silent data loss rather
   than a cosmetic gap, and is the single most likely source of user complaints.
   Any fix must define ASCII output for the existing test cases and must be a
   deliberate, changelogged behavior change rather than a drive-by patch — decide
   between NFKD + ASCII folding and an opt-in `transliterate=True` before
   writing code.

2. **Make the CI workflow actually run, and pin the lint tool.**
   The supplied `ci.yml` sits at the repository root, not at
   `.github/workflows/ci.yml`, so GitHub Actions will not discover it as-is;
   confirm the real workflow path in the repository and keep this file in sync
   (or move it and update the reference). Separately, `dev = ["ruff"]` is
   unpinned, so lint results can change without a code change — pin a minimum
   version once a baseline of findings is agreed.

3. **Complete the packaging metadata and add type hints.**
   `pyproject.toml` still has no `license`, `authors`, or `project.urls`, and
   `slugkit.py` is untyped. Both are cheap: add the metadata fields, then add
   annotations plus a `ruff`/type-checker pass in CI so the next release cannot
   quietly regress the public signatures.
