# Maintenance

## Release checklist

1. Update `version` in `pyproject.toml`; confirm `requires-python` and Python
   classifiers match the supported range.
2. Update `CHANGELOG.md` from the release notes: separate user-visible changes
   from internal maintenance, and do not claim fixes that were not made.
3. Bump the CI Python matrix (`ci.yml`) to the supported range and confirm the
   pinned action majors (`actions/checkout@v4`, `actions/setup-python@v5`).
4. Run locally: `python -m unittest -v`, `ruff check .`, and a build/install
   check (`python -m pip install -e .` then import).
5. Tag the release as `v0.4.0` and publish.

## Compatibility policy

- Supported Python range: **3.10–3.13**. Python 3.9 and earlier are not
  supported as of 0.4.0; Python 3.13 is validated in CI.
- `normalize_version` is a compatibility-sensitive API. Its observable output
  for ordinary versions must remain unchanged across maintenance releases. The
  `distutils` → `packaging` change is internal only: do not return
  `str(packaging.version.Version(value))`, which would canonicalize ordinary
  versions and break callers. Regression tests cover this contract.
- Deprecated standard-library modules must not be used; `distutils` is removed
  in Python 3.12+ and is absent from this codebase.
- GitHub Actions stay pinned to the major versions named in the release notes
  (`checkout@v4`, `setup-python@v5`). Workflows run with least-privilege
  permissions (`contents: read`); add narrower, per-job permissions only when a
  step genuinely needs them.
- Dependencies are kept minimal and declared explicitly in `pyproject.toml`
  (`packaging>=23`).

## Next three prioritized maintenance items

1. **Unicode transliteration.** `slugify` transliterates non-ASCII letters
   poorly (a known, unfixed limitation). Evaluate a maintained transliteration
   library or a documented, tested approach, with explicit behavior and new
   tests. This is the most impactful user-facing gap.
2. **Define and test `normalize_version` input handling.** Decide on a clear,
   documented policy for non-PEP 440 and empty inputs (currently passed through
   unchanged to preserve legacy behavior), and add contract tests before any
   behavior change.
3. **Strengthen release verification.** Add a packaging build (`python -m
   build`) and an sdist/wheel install-and-import smoke test to CI, run
   `ruff check` as a separate job, and consider `ruff format --check` and
   dependency pinning so metadata and CI drift are caught before a release.
