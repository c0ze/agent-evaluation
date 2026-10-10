# Response: preparing slugkit 0.4.0

All work was done inside `04-project-maintenance/` without network access. Verification was
run on the four interpreters available locally (CPython 3.10.20, 3.11.15, 3.12.3, 3.13.12),
ruff 0.15.8, setuptools 68.1.2 and pip 24.0/25.3.

## Changed files

| File | Change |
| --- | --- |
| `slugkit.py` | Removed `from distutils.version import LooseVersion`. `normalize_version` is now an explicit validated pass-through: non-empty `str` is returned unchanged; non-`str` raises `TypeError` (as before); `""` raises `ValueError` (before: an `AttributeError` escaping from `distutils`). Docstrings added; `slugify` body untouched. |
| `test_slugkit.py` | 2 tests -> 11. `normalize_version`: identity on ordinary versions (`1.2.0`, `2.0rc1`, `1.0a1`, `1.0.post1`, ...), identity on non-canonical strings a PEP 440 normaliser would rewrite (`1.0-rc1`, `01.02`, `v1.0`, ...), whitespace preserved, `""` -> `ValueError`, non-str -> `TypeError`, differential check against `distutils.version.LooseVersion` where it is importable (skips otherwise), and a fresh-interpreter `-W error` check that importing/calling the module never imports `distutils` or warns. `slugify`: repeated punctuation, separator-only input, non-ASCII characterisation (known limitation). |
| `pyproject.toml` | `version = "0.4.0"`; `requires-python = ">=3.10"`; classifiers 3.10-3.13 and `3 :: Only`; `[project.optional-dependencies] dev = ["ruff==0.15.8"]`; `[tool.setuptools] py-modules = ["slugkit"]` (see risks: the fixture did not build at all without it); `[tool.ruff] target-version = "py310"`. |
| `ci.yml` | Top-level `permissions: contents: read`; `persist-credentials: false` on checkout; separate `lint` job (`ruff check .`, `ruff format --check .`, installs `.[dev]`); `test` job matrix `["3.10", "3.11", "3.12", "3.13"]` with `fail-fast: false`; `python -m pip` / `python -m unittest -v`. Actions stay at `actions/checkout@v4` and `actions/setup-python@v5` as the release notes require. Triggers left as `[push, pull_request]`. |
| `CHANGELOG.md` | New. Keep-a-Changelog layout for 0.4.0: Changed / Fixed / Known limitations / Internal. The Unicode limitation is stated as not fixed. Earlier releases are not reconstructed. |
| `MAINTENANCE.md` | New. Five-step release checklist, compatibility policy (interpreter window, lower-bound-only `requires-python`, no runtime deps, behavioural contracts, action pinning), and the next three prioritised items (3.14 in / 3.10 out; decide what `normalize_version` should be; Unicode in `slugify`). |
| `RESPONSE.md` | This file. |

`RELEASE_NOTES.txt` and `TASK.md` are untouched. Build artefacts created during verification
(`build/`, `slugkit.egg-info/`, `__pycache__/`, `.ruff_cache/`) were removed; `git status`
shows only the six files above.

## Why `normalize_version` is a pass-through

The task requires no change in observable behaviour for ordinary versions, so the first step was
to measure what the old code did. `LooseVersion.__str__` is literally `return self.vstring`,
and on Python 3.10 every one of 20 sample strings came back unchanged (`'1.0-rc1' -> '1.0-rc1'`,
`'01.02' -> '01.02'`, `'v1.0' -> 'v1.0'`, `' 1.0 ' -> ' 1.0 '`, `'1.2.3.foo' -> '1.2.3.foo'`).
The obvious replacement, `packaging.version.Version`, was measured too (packaging 24.0):
`'1.0-rc1' -> '1.0rc1'`, `'01.02' -> '1.2'`, `'v1.0' -> '1.0'`, `'1.0.RC1' -> '1.0rc1'`,
`' 1.0 ' -> '1.0'`, and `'1_0'` / `'1.2.3.foo'` raise `InvalidVersion`. That is a behaviour
change plus a new runtime dependency, so it was rejected. Whether the function should do more
is item 2 in `MAINTENANCE.md`.

## Findings about the fixture worth knowing

- The old module only imported on 3.12/3.13 here because setuptools' `_distutils_hack` shim is
  installed system-wide (`distutils.__file__` resolved to `setuptools/_distutils/`). In a venv
  created with `--without-pip`, the unmodified `slugkit.py` failed on 3.12 and 3.13 with
  `ModuleNotFoundError: No module named 'distutils'`, and calling `normalize_version` under
  `-W error::DeprecationWarning` failed on every interpreter.
- The fixture's `pip install -e .` did not work even before this change: setuptools aborted with
  `error: Multiple top-level modules discovered in a flat-layout: ['slugkit', 'test_slugkit'].`
  Declaring `py-modules` fixes it and keeps `test_slugkit.py` out of the wheel.

## Remaining risks

1. **`ruff==0.15.8` pin not resolved from PyPI.** The pin matches the ruff binary used for all
   checks here, but without network I could not confirm `pip install ".[dev]"` resolves it. If
   the lint job fails at install time, adjust the pin; nothing else depends on it.
2. **Wheel build verified only with a workaround.** Ubuntu's patched setuptools 68.1.2 fails
   any non-editable build under `--no-build-isolation` with `AttributeError: install_layout`
   (a distro packaging defect, reproduced identically with the unmodified fixture's build path
   once metadata succeeds). With `SETUPTOOLS_USE_DISTUTILS=stdlib` the build succeeds and the
   wheel is correct (see below). An isolated build with upstream setuptools, which is what pip
   does by default in CI, was not possible offline.
3. **`ci.yml` location and linting.** The file stays at the project root as supplied; GitHub
   only runs it from `.github/workflows/`. It was validated by parsing with PyYAML and
   structural assertions, not with `actionlint` (not installed).
4. **Exception type for empty input changed** (`AttributeError` -> `ValueError`). Documented in
   the changelog; only code that caught `AttributeError` for this would notice.
5. **No upper bound on `requires-python`.** Deliberate (see policy in `MAINTENANCE.md`): 0.4.0
   will install on 3.14 although 3.14 is not in the tested range.
6. **The `slugify` "Fixed" entry** could not be dated: the repository has a single commit, so
   whether the repeated-punctuation handling landed after 0.3.2 rests on the release notes.
   The entry says it was already present and is now tested.
7. **Release date** is `Unreleased` in `CHANGELOG.md` and must be set when tagging.
8. The 3.14 release (October 2025) and 3.10 end-of-life (October 2026) dates in
   `MAINTENANCE.md` come from the CPython release schedule as I know it and were not checked
   online.

## Verification results (exact)

Commands were run from `04-project-maintenance/` unless noted.

```
$ ruff --version
ruff 0.15.8
$ ruff check .
All checks passed!
$ ruff format --check .
2 files already formatted
```

```
$ python3.10 -m unittest -v      # same output shape on 3.11, 3.12, 3.13
test_import_and_use_do_not_touch_distutils_or_warn (test_slugkit.ImportHygieneTests) ... ok
test_empty_string_raises_value_error (test_slugkit.NormalizeVersionTests) ... ok
test_matches_legacy_distutils_behaviour_when_available (test_slugkit.NormalizeVersionTests) ... ok
test_non_canonical_versions_are_not_rewritten (test_slugkit.NormalizeVersionTests) ... ok
test_non_string_raises_type_error (test_slugkit.NormalizeVersionTests) ... ok
test_ordinary_versions_are_returned_unchanged (test_slugkit.NormalizeVersionTests) ... ok
test_surrounding_whitespace_is_preserved (test_slugkit.NormalizeVersionTests) ... ok
test_basic (test_slugkit.SlugifyTests) ... ok
test_non_ascii_letters_are_dropped_not_transliterated (test_slugkit.SlugifyTests) ... ok
test_only_separators_gives_empty_slug (test_slugkit.SlugifyTests) ... ok
test_repeated_punctuation_collapses_to_single_hyphen (test_slugkit.SlugifyTests) ... ok
----------------------------------------------------------------------
Ran 11 tests in 0.100s
OK
```
Results per interpreter (system Pythons, setuptools shim present, so the differential test runs):
3.10 `Ran 11 tests ... OK`; 3.11 `Ran 11 tests ... OK`; 3.12 `Ran 11 tests ... OK`;
3.13 `Ran 11 tests ... OK`. Exit code 0 in all four.

Setuptools-free venvs (`pythonX.Y -m venv --without-pip`):
```
clean 3.10: python -W error -c "import sys, slugkit; ..." -> '2.0rc1' distutils in sys.modules: False (exit 0)
            python -m unittest -> Ran 11 tests ... OK
clean 3.12: -W error import/call -> exit 0;  unittest -> Ran 11 tests ... OK (skipped=1)
clean 3.13: -W error import/call -> exit 0;  unittest -> Ran 11 tests ... OK (skipped=1)
   skipped: test_matches_legacy_distutils_behaviour_when_available ... 'distutils is not available on this interpreter'
```
Before the change, the same `-W error` import in the clean 3.12 and 3.13 venvs failed with
`ModuleNotFoundError: No module named 'distutils'`, and on 3.10 with
`DeprecationWarning: The distutils package is deprecated and slated for removal in Python 3.12`.

Editable install (the CI step), offline, Python 3.13 venv with `--system-site-packages`:
```
$ python -m pip install -e . --no-build-isolation --no-deps --no-index
Successfully built slugkit
Installing collected packages: slugkit
Successfully installed slugkit-0.4.0
$ cd / && python -c "import slugkit; print(slugkit.__file__); ..."
/home/user/agent-eval-fable-5.1/04-project-maintenance/slugkit.py
1.2.0 hello-world
```

Wheel build, offline (workaround for the distro setuptools bug described in risk 2):
```
$ SETUPTOOLS_USE_DISTUTILS=stdlib /usr/bin/python3.11 -m pip wheel . --no-build-isolation --no-deps --no-index -w <scratch>
Created wheel for slugkit: filename=slugkit-0.4.0-py3-none-any.whl size=2097 ...
Successfully built slugkit
wheel contents: slugkit.py, slugkit-0.4.0.dist-info/{METADATA,WHEEL,top_level.txt,RECORD}   (no test_slugkit.py)
METADATA: Name: slugkit / Version: 0.4.0 / Requires-Python: >=3.10 /
          Classifier: Programming Language :: Python :: 3 :: Only, 3.10, 3.11, 3.12, 3.13 /
          Provides-Extra: dev / Requires-Dist: ruff ==0.15.8 ; extra == 'dev'
```
Without the workaround the same command fails with `AttributeError: install_layout. Did you
mean: 'install_platlib'?` inside `setuptools/command/install_lib.py` (the Ubuntu patch);
metadata generation and `build_py` complete before that point. `uv build --offline` could not
run because the isolated build needs to download setuptools.

Built wheel installed into a fresh pip-only 3.13 venv (pip 25.3 is the only package, so no
setuptools shim), imported from `/`:
```
$ python -m pip install --no-index slugkit-0.4.0-py3-none-any.whl
Successfully installed slugkit-0.4.0
$ cd / && python -W error -c "import sys, slugkit; ..."
<venv>/lib/python3.13/site-packages/slugkit.py
'2.0rc1' 'hello-world' distutils loaded: False   (exit 0)
```

Configuration files:
```
$ python3.13 -c "import tomllib; tomllib.load(open('pyproject.toml','rb'))"   # parses
$ python3.13 -c "import yaml; yaml.safe_load(open('ci.yml'))"                  # parses
asserted: permissions == {'contents': 'read'}; test matrix == ['3.10','3.11','3.12','3.13'];
          fail-fast False; action pins == {actions/checkout@v4, actions/setup-python@v5};
          project.version == '0.4.0'; requires-python == '>=3.10'; ruff target-version == 'py310'
-> all structural assertions passed
```

Final state:
```
$ git status --short --untracked-files=all -- 04-project-maintenance
 M 04-project-maintenance/ci.yml
 M 04-project-maintenance/pyproject.toml
 M 04-project-maintenance/slugkit.py
 M 04-project-maintenance/test_slugkit.py
?? 04-project-maintenance/CHANGELOG.md
?? 04-project-maintenance/MAINTENANCE.md
(+ RESPONSE.md, written after this listing)
$ git diff --stat -- 04-project-maintenance
 4 files changed, 174 insertions(+), 19 deletions(-)
```
