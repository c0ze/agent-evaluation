# Release maintenance response

All requested file deliverables are complete for the 0.4.0 release preparation.
All feasible local checks were run without network access. Source tests,
configuration checks, offline artifact builds, sdist tests, and clean-wheel
installation tests passed. Ruff and Python 3.10–3.12 runtime validation remain
unverified locally because the required tools/interpreters are unavailable.

## Changed files

| File | Change |
| --- | --- |
| `pyproject.toml` | Set version 0.4.0, Python `>=3.10,<3.14`, matching classifiers, Ruff target `py310`, a `dev` extra for Ruff, README metadata, and explicit packaging of the `slugkit` module. |
| `slugkit.py` | Removed `distutils`; preserve ordinary version strings directly, matching the old string-conversion result without adding a runtime dependency. |
| `test_slugkit.py` | Added 12 version cases covering dotted components, leading/trailing zeros, pre-release case/suffixes, development/post-release suffixes, and local labels; added three repeated-punctuation cases. |
| `ci.yml` | Test Python 3.10–3.13, run lint once on 3.13, use interpreter-bound pip, read-only repository permissions, and disable persisted credentials. Keep checkout v4 and setup-python v5. |
| `CHANGELOG.md` | Separate user-visible changes, internal maintenance, and the known Unicode limitation, using the supplied release notes without inventing a release date or Unicode fix. |
| `MAINTENANCE.md` | Add the release checklist, compatibility policy, and three ordered follow-up items. |
| `README.md` | Describe the existing helpers and development commands; eliminate the missing-README sdist warning. |
| `MANIFEST.in` | Include tests, CI configuration, and release/maintenance documentation in the sdist. |
| `RESPONSE.md` | Record deliverables, verification, and remaining risks. |

## Exact verification results

The supported local interpreter was Python **3.13.7**. The default `python3`
was **3.14.7**, outside the supported range. Configuration validation used
standard-library `tomllib`/`ast` and the already-installed PyYAML **6.0.3**.

| Check or command | Exit/result |
| --- | --- |
| Baseline `python3 -m unittest -v` on Python 3.14.7 | Exit 1: one failed test-module import, `ModuleNotFoundError: No module named 'distutils'`. |
| Updated `python3.13 -W error -m unittest discover -v` | Exit 0: `Ran 3 tests in 0.000s`, `OK`; 12 version subtests and three punctuation subtests passed. |
| Final `python3.13 -B -W error -m unittest discover -v` after cleanup | Exit 0: `Ran 3 tests in 0.000s`, `OK`. |
| Inline `python3.13 -B -` configuration/syntax assertions | Exit 0: TOML/YAML parsed; verified version, Python bounds/classifiers, README, explicit module packaging, dev extra, Ruff target, CI matrix, permissions, checkout credentials, action majors, test/lint commands, and manifest. Both Python files parsed with each of the 3.10–3.13 grammars: **8 successful syntax parses**. This is not runtime validation of those interpreters. |
| Offline inline `PYTHONPATH=.checks/tools python3.13 -` build/backend assertions | Exit 0: built `slugkit-0.4.0.tar.gz` and `slugkit-0.4.0-py3-none-any.whl` using `setuptools.build_meta.build_sdist` and `build_wheel`. Final builds had no missing-README warning. |
| Artifact assertions in that build script | Exit 0: verified wheel contains only `slugkit.py` plus four dist-info files, metadata version/bounds/classifiers/dev extra/README, and sdist inclusion of the tests and docs. Confirmed build-tool copies and task/report files were excluded. Python-boundary checks accepted 3.10.0, 3.11.0, 3.12.0, 3.13.0, and 3.13.99; rejected 3.9.99 and 3.14.0: **7 passed checks**. |
| Extracted-sdist `python3.13 -W error -m unittest discover -v`, followed by `build_wheel` from the extracted source | Exit 0: **3 tests passed**; rebuilt wheel's `slugkit.py` matched the original wheel's module byte-for-byte. |
| `python3.13 -m venv .checks/venv` | Exit 0: created an isolated Python 3.13 environment. |
| `.checks/venv/bin/python -m pip --isolated --disable-pip-version-check install --no-index --no-cache-dir --no-deps .checks/dist/slugkit-0.4.0-py3-none-any.whl` | Exit 0: `Successfully installed slugkit-0.4.0`. |
| Inline `.checks/venv/bin/python -I -W error -` wheel regression script | Exit 0: confirmed import came from the clean venv and installed version was 0.4.0; ran all **3 regression tests successfully**, using the installed wheel rather than the source module. |
| `python3 -m pip --isolated --disable-pip-version-check install --no-index --no-cache-dir --no-deps --target .checks/unsupported-python .checks/dist/slugkit-0.4.0-py3-none-any.whl` | Expected exit 1: `Package 'slugkit' requires a different Python: 3.14.7 not in '<3.14,>=3.10'`. Confirms installer enforcement of the upper bound. |
| `python3.13 -m ruff check .` | Exit 1: `No module named ruff`; lint was **not verified**. |
| `python3.13 -m build --no-isolation` | Exit 1: `No module named build`; the standard build frontend was **not verified**. Actual sdist/wheel builds and installation succeeded through the backend as described above. |
| Final inline `python3.13 -B -` deliverable audit | Exit 0: exactly **11 expected files** present, all nonempty; temporary build files removed; Python source lines fit the configured 100-character limit. This line-length check is not a substitute for Ruff. |

Offline build tools were copied from an existing external uv cache into
temporary `.checks/tools`: setuptools **84.0.0**, wheel **0.46.3**, and
packaging **26.3**. Nothing was downloaded. A pip cache-list probe exited 1
because the external cache was not writable; a uv tool-list probe exited 2
because cache initialization was denied. The cached packages were then read
directly and copied into this task directory for use.

All project changes and generated verification files stayed inside this task
directory. Temporary `.checks`, `build`, `slugkit.egg-info`, and `__pycache__`
directories were removed after verification; generated artifacts are not
retained as source deliverables.

## Remaining risks and release gates

- Run the configured CI before publishing. Python 3.10, 3.11, and 3.12 were
  unavailable locally; syntax parsing cannot replace their runtime tests.
  GitHub Actions execution and Ruff lint remain unverified.
- This fixture supplies the workflow as root-level `ci.yml`. GitHub requires
  `.github/workflows/ci.yml` in the release repository; the maintenance
  checklist includes placing it there before releasing.
- Builds were verified with the cached tool versions above, without an
  isolated build frontend. The existing build requirements and new Ruff extra
  are not fully pinned; minimum-version and future-tool compatibility remain
  release concerns. Reproducible tooling is a prioritized maintenance item.
- Unicode transliteration remains limited. `normalize_version` preserves
  ordinary string outputs but does not validate input. Empty strings now pass
  through instead of reproducing the old incidental `AttributeError`;
  non-string inputs are outside the documented compatibility promise.

This prepares the release; it does not publish artifacts or create a release
tag. Exact model ID: `gpt-6.1-sol`.
