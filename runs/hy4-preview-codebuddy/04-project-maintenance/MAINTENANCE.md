# Maintenance

## Release checklist

1. Bump `version` in `pyproject.toml` and add the matching `CHANGELOG.md`
   section (user-visible changes separate from internal maintenance).
2. Check that `requires-python`, the ruff `target-version`, the Python
   classifiers, and the CI matrix all name the same supported range.
3. Run `python -m unittest -v` and `ruff check .` locally on the lowest and
   highest supported interpreters (3.10 and 3.13).
4. Push the release branch and let the full CI matrix pass (`fail-fast: false`
   is intentional: one interpreter failing must not hide the others).
5. Build the sdist and wheel, then tag `vX.Y.Z`.

## Compatibility policy

- Supported: CPython 3.10 through 3.13. `requires-python = ">=3.10"` sets the
  floor; the classifiers and the CI matrix are the authoritative statement of
  what is actually tested. Newer, unvalidated versions are unsupported until a
  matrix entry exists for them.
- Dropping a Python version happens in a minor release and is recorded in
  `CHANGELOG.md` under user-visible changes.
- No runtime dependencies. `slugkit` stays stdlib-only (this is why the
  deprecated `distutils` import was replaced with a local parser).
- `slugify` and `normalize_version` keep their output for ordinary inputs;
  any observable change needs a `CHANGELOG.md` entry and a test.

## Next three maintenance items (prioritized)

1. **Unicode transliteration in `slugify`.** Non-ASCII letters are currently
   dropped or collapsed into separators. Decide between a dependency and a
   mapping table, then implement it with tests for accented and non-Latin text.
2. **Reproducible builds.** Declare the module explicitly
   (`[tool.setuptools] py-modules = ["slugkit"]`) instead of relying on
   auto-discovery, and add a build/install check for the sdist and wheel to CI.
3. **Supply-chain hardening for CI.** Pin `actions/checkout` and
   `actions/setup-python` to commit SHAs (they are currently on the `v4` / `v5`
   major tags) and add a scheduled run so a new CPython release surfaces before
   it is shipped to users.
