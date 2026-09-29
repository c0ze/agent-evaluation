# Maintenance guide

## Release checklist

1. Bump `version` in `pyproject.toml` and make sure `CHANGELOG.md` has a section for it:
   user-visible changes first, internal work under "Internal", and known limitations stated
   rather than implied fixed. Replace "Unreleased" with the release date.
2. Run the same checks CI runs, on the oldest and newest supported interpreters at minimum:
   `ruff check .`, `ruff format --check .`, `python -m unittest -v`.
3. Build the distribution (`python -m build`) and inspect the wheel: it must contain
   `slugkit.py` only, never `test_slugkit.py`.
4. Install the wheel into a fresh virtual environment on Python 3.12 or newer created with
   `python -m venv --without-pip` (so no setuptools shim is present) and run
   `python -W error -c "import slugkit; print(slugkit.normalize_version('1.2.0'))"`.
5. Tag the commit `v<version>`, push the tag, publish, and confirm CI is green on the tag.

## Compatibility policy

- **Interpreters.** 0.4.x supports CPython 3.10 through 3.13, which is exactly what CI tests
  and the classifiers list. A new CPython minor version is added to the matrix and classifiers
  once it is final and the suite passes on it. A version is dropped only in a minor release,
  after its upstream end of life, with a `CHANGELOG.md` entry and a matching bump of
  `requires-python` and `[tool.ruff] target-version`.
- **`requires-python` is a lower bound only.** No upper bound is declared: an upper bound
  would block installs on newer interpreters that work, and the tested range is communicated
  through the classifiers and CI instead.
- **Dependencies.** The runtime has none and should stay that way; the standard library is
  enough for what the package does. Development tooling is pinned in the `dev` extra.
- **Behavioural contracts.** `normalize_version` returns any non-empty string unchanged and
  raises `TypeError` / `ValueError` for non-string / empty input. `slugify` output for a given
  input is part of the public contract. Changing either is a user-visible change that needs a
  minor version bump and a changelog entry; do not slip it into a patch release.
- **GitHub Actions.** Actions are pinned to major versions (`actions/checkout@v4`,
  `actions/setup-python@v5`) and the workflow runs with `contents: read` only. Raising a major
  version is a deliberate, reviewed change, not a drive-by edit.

## Next three maintenance items, in priority order

1. **Python 3.14 in, Python 3.10 out.** CPython 3.14 has been final since October 2025 and is
   not yet in the tested range; CPython 3.10 reaches end of life in October 2026. Add 3.14 to
   the CI matrix and classifiers now (it needs no code change in principle, but must be
   verified), then drop 3.10 in 0.5.0 per the policy above.
2. **Decide what `normalize_version` should actually do.** Since 0.4.0 it is an explicit
   pass-through with input validation, which is what the `distutils`-based version always was.
   The name promises more. Either document the pass-through as the intended contract, or add a
   separate canonicalising function (PEP 440 rules, either via `packaging` or a small vendored
   regex) and deprecate the old name over a release cycle. The tests in `test_slugkit.py` show
   exactly which inputs a canonicaliser would change (`1.0-rc1`, `01.02`, `v1.0`, ...).
3. **Non-ASCII handling in `slugify`.** Non-ASCII letters are currently dropped rather than
   transliterated. Evaluate a dependency-free step (`unicodedata.normalize("NFKD")` followed by
   an ASCII fold) before touching the regex. This changes output for existing inputs, so it is a
   0.5.0 change with tests and a changelog entry, not a patch.

Backlog beyond these: add `python -m build` plus a wheel-content check to CI, and enable
automated dependency/actions update PRs so the pinned ruff and action majors do not go stale.

## Repository layout note

`ci.yml` is kept at the project root in this fixture; in the real repository it belongs at
`.github/workflows/ci.yml`, otherwise GitHub will not run it.
