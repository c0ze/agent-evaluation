# Response — 0.4.0 release preparation

## Changed files

| File | Change |
| --- | --- |
| `slugkit.py` | Removed `from distutils.version import LooseVersion`. `normalize_version` now parses with a local regex (`(\d+|[a-z]+|\.)`, same component pattern distutils used), raises `ValueError("empty version number")` when the input yields no components, raises `TypeError` for non-`str`, and returns the input verbatim otherwise. `slugify` untouched. |
| `pyproject.toml` | `version = "0.4.0"`; `requires-python = ">=3.10"`; added Python classifiers 3.10-3.13 (3.9 removed); `[tool.ruff] target-version = "py310"`; added `[tool.setuptools] py-modules = ["slugkit"]` so the flat layout resolves to a single module. |
| `ci.yml` | Matrix now `["3.10", "3.11", "3.12", "3.13"]` with `fail-fast: false`; workflow-level `permissions: contents: read`; added `concurrency` cancel-in-progress; split lint into its own job (ruff); actions pinned to the versions named in the notes (`actions/checkout@v4`, `actions/setup-python@v5`); install steps use `python -m pip`; tests run via `python -m unittest discover -v`. |
| `test_slugkit.py` | Reworked into `SlugifyTests` + `NormalizeVersionTests` (12 tests): original two assertions kept; added repeated-punctuation and digit cases, pinned known Unicode limitation (`"Ärger" -> "rger"`), version round-trip and pre-release suffix cases, `ValueError` for `""`/`"."`/`"..."`, `TypeError` for non-`str`, passthrough of component-free values, and a subprocess regression test asserting importing `slugkit` does not load `distutils`. |
| `CHANGELOG.md` | New. Derived from `RELEASE_NOTES.txt`, split into User-visible / Internal / Known limitations. States the distutils removal, 3.9 drop + 3.13 validation, the already-implemented slugify punctuation behaviour (flagged as pre-existing, not new), CI/packaging maintenance, and explicitly says the Unicode limitation and the lack of full PEP 440 normalization are **not** fixed. Date left as `Unreleased` rather than invented. |
| `MAINTENANCE.md` | New. 7-step release checklist, compatibility policy (3.10-3.13, lower bound only in `requires-python`, upper bound expressed via classifiers + CI matrix; deprecation/removal process; no removed stdlib APIs), and the next three prioritized items: (1) Unicode handling in `slugify`, (2) a defined normalization contract for `normalize_version`, (3) packaging/release automation (`py.typed`, coverage gate, artifact verification, tag-only publish). |

## Verification results (exact)

Environment: Python 3.14.7 at `/usr/bin/python3`; no `pip`, no `setuptools`, no `ruff`, no network.

- `python -m unittest discover -v` -> `Ran 12 tests ... OK` (exit 0).
- `python -m compileall -q .` -> no output, exit 0.
- `python -c "import slugkit; ..."` -> `import ok, python 3.14.7` and `distutils imported? False` (i.e. the old code's import would fail here; the new one works).
- Behavioural equivalence check against a local reimplementation of `distutils.version.LooseVersion` (`str()` returning `vstring`): 16 inputs (`1.2.0`, `2.0rc1`, `1`, `1.02.0`, `3.0.dev0`, `1.4.0-beta.2`, `1.2.0+build.5`, `""`, `"   "`, `"!!!"`, `"."`, `"..."`, `ABC`, `RC1`, `v1.2.3`, `1.2B`) -> all MATCH, 0 mismatches.
- `tomllib.load("pyproject.toml")` -> parses; name `slugkit`, version `0.4.0`, `requires-python >=3.10`, classifiers 3.10/3.11/3.12/3.13.
- `yaml.safe_load("ci.yml")` -> parses; jobs `test`, `lint`; matrix `['3.10','3.11','3.12','3.13']`; `permissions {'contents': 'read'}`; `uses` values are only `actions/checkout@v4` and `actions/setup-python@v5`.
- Manual style check: no line exceeds 100 chars (`slugkit.py` max 94, `test_slugkit.py` max 90), no trailing whitespace, no unused imports.

## Remaining risks

1. **ruff not runnable locally** (not installed, no network). Lint compliance was checked by inspection only; CI's `ruff check .` is the real gate.
2. **Build not verifiable**: `pip`/`setuptools` are absent, so `pip install -e .` and sdist/wheel contents (including the added `py-modules` setting) are unverified.
3. **distutils semantics reconstructed, not executed.** `distutils` does not exist on this Python (3.14), so the old behaviour could not be run. I reproduced `str(LooseVersion(v)) == vstring` (identity + `ValueError` on component-free input), which is what the pre-existing test `normalize_version("2.0rc1") == "2.0rc1"` and the docstring "preserving pre-release suffixes" require; the alternative reading (re-joining components with `.`) would have made that test fail. If upstream intent was re-joining, pre-release output would need to change — worth a second pair of eyes on a 3.11 interpreter.
4. **Only Python 3.14 was available**; the 3.10-3.13 matrix is verified by CI, not locally. 3.14 is deliberately outside the supported range.
5. **`requires-python` has no `<3.14` cap** — intentional per the compatibility policy (avoid blocking installs on newer interpreters); supported range is expressed via classifiers and the CI matrix. If a hard cap is wanted, this is a one-line change.
6. **Fidelity quirks kept**: whitespace-only or punctuation-only strings (`"   "`, `"!!!"`) are returned unchanged rather than rejected, matching the old behaviour; this is pinned by a test and is maintenance item 2.
7. **`ci.yml` remains at the directory root** as supplied; in a real repository it must live at `.github/workflows/ci.yml` to be executed by GitHub Actions.
