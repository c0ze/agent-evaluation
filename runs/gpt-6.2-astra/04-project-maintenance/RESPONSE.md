# Slugkit 0.4.0 release preparation

## Changed files

| File | Change |
| --- | --- |
| `pyproject.toml` | Set version 0.4.0, declare Python 3.10–3.13 in the installer requirement and classifiers, and set Ruff's target to 3.10. Package the single public module and use the README as the package description. |
| `slugkit.py` | Return the supplied version string directly, preserving ordinary version spellings without importing `distutils`. |
| `test_slugkit.py` | Cover seven version spellings, including leading zeros, suffix case, prereleases and build metadata. Add a regression test for repeated punctuation. |
| `.github/workflows/ci.yml`, `ci.yml` | Put the workflow in the project's GitHub Actions directory. Keep the supplied path as a symlink. Run unit tests on each supported minor and Ruff once. Use read-only contents access, disable checkout credential persistence, and retain checkout v4 and setup-python v5. |
| `CHANGELOG.md` | Document user-visible changes, internal maintenance and the known Unicode limitation from the release notes. |
| `MAINTENANCE.md` | Record the compatibility policy, release checklist and three prioritized follow-up items. |
| `README.md` | Add tested examples for both helpers and resolve the source distribution's missing-README warning. |
| `RESPONSE.md` | Record release changes, verification and outstanding risks. |

## Offline verification

| Check | Result |
| --- | --- |
| Baseline on CPython 3.11.18 | The original suite passed 2 tests. The expanded suite also passed all 4 tests against the old implementation, which emitted a `distutils` deprecation warning. |
| `python3.11 -B -W error::DeprecationWarning -m unittest discover -v` | Exit 0. All 4 tests passed with the new implementation. |
| `python3.11 -B -m doctest -v README.md` | Exit 0. 3 examples passed, 0 failed. |
| Source distribution and wheel | Setuptools 84.2.1 built `slugkit-0.4.0.tar.gz`. Pip 26.2.2 built `slugkit-0.4.0-py3-none-any.whl` from the unpacked archive with `--no-index --no-build-isolation --no-deps`. Both builds exited 0. The final source build emitted no missing-README warning. |
| Installed wheel on CPython 3.11.18 | Installed into a fresh virtual environment offline. All 4 tests passed from a directory containing only the copied test file. An isolated import verified the module came from the environment, both helpers returned the expected strings, and the installed metadata contained version 0.4.0, the Python range and the README. The wheel's only Python source module was `slugkit.py`. |
| Wheel installer boundaries | Pip dry runs using `--python-version` for 3.10, 3.11, 3.12 and 3.13 each exited 0 with `Would install slugkit-0.4.0`. Targets 3.9 and 3.14 each exited 1 with a Python version mismatch, as expected. |
| Static configuration checks | Python's TOML parser and assertions verified package metadata, classifiers, module selection and the Ruff target. Both Python files parsed with Python 3.10 grammar and met the configured 100-character limit. Ruby's YAML parser and assertions verified both triggers, permissions, all four matrix entries, action versions, credential settings, test and lint commands, and the fixture symlink. All checks exited 0. |
| `python3.11 -B -m ruff check .` | Exit 1 with `No module named ruff`. Ruff was unavailable locally. |

## Remaining risks

- Python 3.10, 3.12 and 3.13 runtime tests and the Ruff lint result await CI. The installer dry runs checked only package metadata.
- Unicode letters can still be lost during slug generation.
- Compatibility coverage addresses ordinary versions. An empty string now returns an empty string. The previous parser raised `AttributeError` for that input.
