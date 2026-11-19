# RESPONSE.md — Task 04: prepare 0.4.0 release

## Changed files

| File | Change |
| --- | --- |
| `pyproject.toml` | Version `0.3.2 -> 0.4.0`; `requires-python >=3.9 -> >=3.10,<3.14`; added `dependencies = ["packaging>=23"]`; added Python 3.10–3.13 classifiers; Ruff `target-version py39 -> py310`. |
| `slugkit.py` | Replaced `from distutils.version import LooseVersion` with `from packaging.version import Version, InvalidVersion`. `normalize_version` now validates with `Version` but returns the original string (see below). |
| `test_slugkit.py` | Added 4 tests: repeated-punctuation slugify, identity contract for ordinary versions (incl. canonicalization traps), non-PEP 440 passthrough, and no-`distutils`-import. Existing 2 tests kept. Total 6. |
| `ci.yml` | Matrix `["3.9","3.10"] -> ["3.10","3.11","3.12","3.13"]`; added top-level `permissions: contents: read` (least privilege); `pip install` -> `python -m pip install`; `python -m unittest` -> `python -m unittest -v`. Pinned majors kept: `actions/checkout@v4`, `actions/setup-python@v5`. |
| `CHANGELOG.md` | **New.** Derived from `RELEASE_NOTES.txt`; user-visible vs internal-maintenance sections; explicit "Unicode transliteration NOT fixed" known limitation. No invented claims. |
| `MAINTENANCE.md` | **New.** Release checklist, compatibility policy, and next three prioritized maintenance items. |

## Key design decision (compatibility)

The original `normalize_version` returned `str(LooseVersion(value))`. Verified
empirically (Python 3.11 with `setuptools._distutils`): `LooseVersion.__str__`
returns the original `vstring` **verbatim** — i.e. it is an identity function for
any non-empty input. Replacing it with `str(packaging.version.Version(value))`
would silently canonicalize ordinary versions (`1.02 -> 1.2`, `v1.2 -> 1.2`,
`1.2.0-beta -> 1.2.0b0`, `1.0-1 -> 1.0.post1`, ` 1.2 ` -> `1.2`) and break the
observable behavior. The new implementation therefore parses with `Version`
(the replacement recommended by the deprecation warning) but **returns the
input string unchanged**, and passes non-PEP 440 text through unchanged (the old
`LooseVersion` was permissive). See the docstring in `slugkit.py` and the
regression tests.

`distutils` is removed from the standard library in Python 3.12+, so the old
code could not even be imported on 3.12/3.13 — this change is required for the
declared support range.

## Exact verification results (all local, no network)

Environment: system `python3` = **Python 3.14.10** (has no `distutils`,
`packaging 26.3`, `tomllib`, `PyYAML 6.0.3`; no `ruff`, `pip`, `setuptools`, or
`build`). A bundled **Python 3.11** (Android NDK) with real `distutils` was used
only for the differential comparison below.

1. `python3 -m unittest -v` (Python 3.14): **6 tests, OK** (all pass).
2. `python3 -m unittest -v` (bundled Python 3.11, inside supported range): **6
   tests, OK** (all pass).
3. **Differential test**, 3.11 interpreter, `str(LooseVersion(s))` vs new
   `normalize_version(s)` over 21 non-empty inputs (ordinary versions + the
   canonicalization traps + non-PEP 440 text): **0 mismatches — byte-for-byte
   identical output**.
4. `pyproject.toml` parsed with `tomllib`; assertions on version `0.4.0`,
   `requires-python >=3.10,<3.14`, `packaging>=23`, classifiers 3.10–3.13, Ruff
   `py310`: **PASS**.
5. `ci.yml` parsed with `yaml.safe_load`; assertions on matrix `3.10–3.13`,
   `permissions == {contents: read}`, pinned `checkout@v4` /
   `setup-python@v5`: **PASS**.
6. `python3 -m compileall -q slugkit.py test_slugkit.py`: **PASS**.
7. Line-length (Ruff `line-length=100`), trailing-whitespace, and tab checks on
   all four source/config files: **PASS** (no violations).
8. Import + API smoke test and AST import check: `slugkit.py` imports only `re`
   and `packaging.version`; **no `distutils` import**; smoke assertions pass.
9. `grep -rn distutils`: only hits are in comments/docstrings/tests documenting
   the migration (no runtime import).

`RESPONSE.md` itself is the deliverable listing changed files, risks, and
verification results.

## Not run (feasibility limits, no network)

- `ruff check .` — `ruff` is not installed and cannot be installed without the
  network. Equivalent stdlib checks (compileall, 100-char line length, trailing
  whitespace, tabs, import verification) were run instead and pass. CI installs
  `ruff` and runs it for real.
- `python -m pip install -e .` / `python -m build` — `pip`, `setuptools`, and
  `build` are absent in the local environment and the network is disabled.
  Metadata was validated by parsing `pyproject.toml` directly. The editable
  install and build are exercised in CI settings where tooling is available; not
  verified here.

## Remaining risks

- **`ruff` / packaging build not executed locally.** A genuine lint failure or
  build/install error could still surface in CI; mitigated by the equivalent
  checks above but not fully equivalent. Recommend running `ruff check .` and a
  wheel/sdist build once tooling/network is available.
- **Empty-string edge case (intentional, documented deviation).** Old
  `str(LooseVersion(""))` raised an `AttributeError`; the new
  `normalize_version("")` returns `""`. This is outside "ordinary versions" and
  is called out as a known edge in `MAINTENANCE.md` (maintenance item #2: define
  and test empty/non-PEP 440 input policy). No ordinary-version behavior changed.
- **`packaging` adds a runtime dependency.** It must be available wherever the
  package is installed; declared as `packaging>=23`. CI installs via
  `python -m pip install -e .`.
- **Known, unfixed limitation:** Unicode letters are transliterated poorly in
  `slugify`. Explicitly not claimed as fixed in `CHANGELOG.md` (per release
  notes); tracked as priority #1 in `MAINTENANCE.md`.
- **CI runs only on `ubuntu-latest`** with no explicit `permissions` per job
  beyond the top-level `contents: read`; sufficient for a read/test workflow but
  would need review if publish steps are added.
- **Validation on Python 3.13** is configured in CI but not executed locally
  (no 3.13 interpreter available here); 3.11 and 3.14 were used as local
  proxies.

## Deliverables status

All requested deliverables completed: supported range aligned in metadata + CI;
`distutils` replaced with behavior preserved; CI coherent/least-privileged with
pinned action majors; `CHANGELOG.md` created from release notes; `MAINTENANCE.md`
created with checklist/policy/priorities; tests added/improved; all feasible
local checks run; `RESPONSE.md` written.
