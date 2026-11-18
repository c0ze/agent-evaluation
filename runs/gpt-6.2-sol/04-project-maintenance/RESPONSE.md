# Slugkit 0.4.0 release preparation

## Changed files

- `pyproject.toml` sets the release version to `0.4.0`, requires Python `>=3.10,<3.14`, targets Python 3.10 in Ruff, and declares `slugkit` as the sole packaged module. The explicit declaration fixes a build failure caused by discovery of the test module alongside the library.
- `slugkit.py` removes `distutils` and returns version strings with their original spelling.
- `test_slugkit.py` checks repeated punctuation and five version spellings, including leading zeroes, prerelease suffixes, and build metadata.
- `ci.yml` tests all four supported Python versions and runs Ruff on Python 3.13. Checkout uses a read-only token without persisting credentials. The workflow uses `actions/checkout@v4` and `actions/setup-python@v5`.
- `CHANGELOG.md` records user-visible changes, internal maintenance, and the known Unicode limitation from the release notes.
- `MAINTENANCE.md` provides a release checklist, a compatibility policy, and three prioritized maintenance items.
- `RESPONSE.md` records the changes and verification results.

## Verification

| Check | Result |
| --- | --- |
| `/opt/homebrew/bin/python3.11 -B -m unittest discover -v` | Python 3.11.18, 3 tests passed, including all 5 version subtests. |
| `/opt/homebrew/bin/python3.14 -B -m unittest discover -v` | Python 3.14.10, 3 source smoke tests passed on an interpreter outside the supported range. |
| Compare with `str(LooseVersion(value))` on Python 3.9.6 | Exact output matched for all 5 ordinary version strings. Empty input raised `AttributeError` in the old implementation and produced `""` in the new one. |
| Parse `pyproject.toml` and check Python source with `ast.parse` | Confirmed version `0.4.0`, the Python 3.10–3.13 metadata bounds, and Ruff target `py310`. Both Python files passed the Python 3.10 grammar, line length, and trailing whitespace checks. Neither file imports `distutils`. |
| Parse `ci.yml` with Ruby 2.6.10 and Psych 3.1.0 | Confirmed push and pull request triggers, read-only contents permission, disabled credential persistence, both action pins, all 4 Python versions, unconditional unit tests, and lint on 3.13 only. |
| Build the source distribution and wheel offline on Python 3.11.18 | Built `slugkit-0.4.0.tar.gz` using setuptools 84.2.1 and built `slugkit-0.4.0-py3-none-any.whl` from it with pip 26.2.2 using `--no-index --no-build-isolation --no-deps`. The source build warned that the fixture has no README. |
| Install the wheel offline and test the installed module | Wheel contained `slugkit.py` as its only Python module. Installed metadata reported version `0.4.0` and `Requires-Python: <3.14,>=3.10`. All 3 tests passed while importing the installed copy. |
| Try installing the wheel on Python 3.9.6 and 3.14.10 | Both installations exited with status 1 and reported `Package 'slugkit' requires a different Python`. |
| Run Ruff through `uv --offline tool run` | Exited with status 1 during dependency resolution. Ruff was unavailable locally and could not be provisioned offline. |

## Remaining risks

- Python 3.10, 3.12, and 3.13 were unavailable locally. The full GitHub Actions matrix and Ruff results remain unverified. `ci.yml` was updated at the supplied fixture path. GitHub Actions expects the file under `.github/workflows/` in the release repository.
- The source distribution builds with a missing README warning.
- `normalize_version("")` now returns the empty string. A caller that relied on the old exception for empty input would see a behavior change.
- Slugification still has limited support for non-ASCII letters.
