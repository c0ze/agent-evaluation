# Task 04 — slugkit 0.4.0 release preparation

The library is prepared for 0.4.0 and the test suite passes on the two
interpreters available here, Python 3.12.15 and 3.14.9. Four things in the
release were **not** verified locally, because the tools are not installed and
the network is off: `ruff check`, a package build, the tests on Python 3.10,
3.11 and 3.13, and a comparison against the real `distutils`.

## Changed files

| File | Change |
| --- | --- |
| `slugkit.py` | Removed the `distutils.version.LooseVersion` import. `normalize_version` returns the string unchanged, raises `ValueError` for an empty string and `TypeError` for a non-string. `slugify` is untouched. |
| `test_slugkit.py` | From 2 tests to 10. The two original tests are kept verbatim. |
| `pyproject.toml` | Version `0.4.0`, `requires-python = ">=3.10"`, classifiers for 3.10–3.13, ruff `target-version = "py310"`, explicit `py-modules = ["slugkit"]`. |
| `ci.yml` | Matrix 3.10–3.13, `permissions: contents: read`, lint split into its own job, `persist-credentials: false`, `fail-fast: false`, job timeouts. Actions stay `actions/checkout@v4` and `actions/setup-python@v5`. |
| `CHANGELOG.md` (new) | 0.4.0 entry built from `RELEASE_NOTES.txt`: user-visible changes, known limitations, internal maintenance. |
| `MAINTENANCE.md` (new) | Release checklist, compatibility policy, next three maintenance items. |
| `RESPONSE.md` (new) | This file. |

`RELEASE_NOTES.txt` and `TASK.md` are unchanged.

## Decisions worth checking

- **`normalize_version` is now a validated pass-through.**
  `str(LooseVersion(value))` returned the original string, because
  `LooseVersion` stores the input and returns it from `__str__`. So the
  faithful replacement returns the input. I did not switch to
  `packaging.version`: it would add a runtime dependency and rewrite inputs
  such as `"1.02"` → `"1.2"` and `"1.0-beta"` → `"1.0b0"`.
- **Error types changed for invalid input.** An empty string now raises
  `ValueError` and any non-string raises `TypeError`. Under `distutils`, an
  empty string and `None` raised an incidental `AttributeError`. This is in the
  changelog as a user-visible change.
- **No upper cap in `requires-python`.** The range 3.10–3.13 is expressed by the
  classifiers and the CI matrix; `requires-python` is `>=3.10` only. Adding
  `,<3.14` would make installs fail on 3.14, where the tests pass today. If you
  want the hard cap, it is a one-line change.
- **Explicit `py-modules`.** With `slugkit.py` and `test_slugkit.py` side by
  side, I expect setuptools' automatic discovery to refuse the build ("multiple
  top-level modules"), which would break `pip install -e .` in CI. Naming the
  module also keeps the tests out of the wheel. I could not reproduce the
  failure here because setuptools is not installed.
- **A test still imports `distutils` on purpose.**
  `test_matches_distutils_where_it_still_exists` compares the new function
  with the old implementation on Python 3.10/3.11 and skips on 3.12+. It is the
  only real check of "behavior unchanged" and it will first run in CI.
- **Changelog has no release date.** The heading says "not yet released"; the
  checklist sets the date at tagging.
- **`ci.yml` stays at the directory root**, where the fixture had it. It needs
  to live in `.github/workflows/` to run on GitHub.

## Remaining risks

1. **Lint is unverified.** Ruff is not installed. I checked by script only that
   both Python files compile and no line exceeds 100 characters. Ruff is also
   unpinned in CI, so a new ruff release can fail the lint job with no code
   change.
2. **3.10, 3.11 and 3.13 are untested locally.** The code uses nothing
   version-specific, but the first real run on those versions is CI.
3. **The `distutils` comparison has not run against the real module.** I
   exercised that test only against a stand-in I transcribed from CPython's
   `LooseVersion`: it passes when the stand-in agrees and fails when a
   deliberately wrong stand-in disagrees. The claim about the old
   `AttributeError` for empty input also rests on reading that source, not on
   running it.
4. **No build was run.** `pip install -e .`, the sdist and the wheel are
   untested, including the `py-modules` setting.
5. **The workflow was only parsed as YAML.** No `actionlint` and no run on
   GitHub. `on: [push, pull_request]` is unchanged, so a pull request from a
   branch in the same repository runs CI twice; I left it because narrowing
   `push` needs the default branch name, which the fixture does not give.
6. **`slugify` Unicode handling is still poor** (`"Café au lait"` →
   `"caf-au-lait"`, `"日本語"` → `""`). It is recorded as a known limitation and
   as the top maintenance item, not fixed.

## Verification results

Interpreters: `/usr/bin/python3` (3.14.9) and a uv-managed CPython 3.12.15.
Both commands were run from this directory.

| Check | Command | Result |
| --- | --- | --- |
| Fixture before changes, 3.12.15 | `python3.12 -m unittest` | `Ran 1 test` — `FAILED (errors=1)`: the test module cannot be imported because `distutils` is missing |
| Fixture before changes, 3.14.9 | `python3 -m unittest` | `Ran 1 test` — `FAILED (errors=1)`, same cause |
| Original 2 tests against new `slugkit.py`, 3.12.15 | `python3.12 -W error::DeprecationWarning -m unittest` | `Ran 2 tests` — `OK` |
| Full suite, 3.12.15 | `python3.12 -W error::DeprecationWarning -m unittest` | `Ran 10 tests in 0.001s` — `OK (skipped=1)` |
| Full suite, 3.14.9 | `python3 -W error::DeprecationWarning -m unittest` | `Ran 10 tests in 0.001s` — `OK (skipped=1)` |
| Full suite, 3.14.3 (mise) | same command | `Ran 10 tests in 0.001s` — `OK (skipped=1)` |
| `distutils` comparison test with an agreeing stand-in, 3.12.15 | suite with the stand-in on `PYTHONPATH` | `Ran 10 tests` — `OK`, nothing skipped |
| Same test with a deliberately wrong stand-in | as above | `FAILED (failures=2)` on `1.0-beta` and `1.0-beta.1`, as intended |
| Source sanity, 3.12.15 and 3.14.9 | script: `compile()` both `.py` files, line length ≤ 100 | passed |
| `pyproject.toml` | `tomllib` parse | version `0.4.0`, `requires-python` `>=3.10`, ruff `py310`, `py-modules` `['slugkit']` |
| `requires-python` behavior | `packaging.specifiers.SpecifierSet` | 3.9 rejected; 3.10, 3.13, 3.14 accepted |
| `ci.yml` | PyYAML parse | matrix `['3.10', '3.11', '3.12', '3.13']`, all strings, equal to the classifier list; `permissions` `{'contents': 'read'}`; actions `actions/checkout@v4`, `actions/setup-python@v5` |

The one skipped test in every full run is the `distutils` comparison, which
skips because neither interpreter has `distutils`.

Not run: `ruff check .`, `pip install -e .`, any build, `actionlint`, and the
suite on Python 3.10, 3.11 and 3.13.
