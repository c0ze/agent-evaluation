# Response

Prepared slugkit `0.4.0` for release. No network access was used.

## Changed files

- `pyproject.toml` — version `0.4.0`; `requires-python` is `>=3.10,<3.14`; classifiers name CPython 3.10 through 3.13; Ruff `target-version` is `py310`; `[tool.setuptools] py-modules = ["slugkit"]` so the flat layout ships the library module and not `test_slugkit`.
- `ci.yml` — test matrix is Python 3.10, 3.11, 3.12, and 3.13. Lint runs once on 3.13. Workflow permissions are `contents: read`. Checkout uses `persist-credentials: false`. Actions stay `actions/checkout@v4` and `actions/setup-python@v5`. Test and lint commands are `python -m unittest` and `python -m ruff check .`.
- `slugkit.py` — removed the `distutils.version.LooseVersion` import. `_LooseVersion` keeps that class's string form: ordinary spellings, including leading zeros and pre-release suffixes, are returned unchanged. The `DeprecationWarning` that `distutils` emitted is gone.
- `test_slugkit.py` — `normalize_version` is checked for `1.2.0`, `2.0rc1`, `1.5.2b2`, `2.0a1`, `2.0b1`, `8.02`, `3.10a`, `3.1.1.6`, `10`, and `0.4.0`. `8.02` and `3.10a` are the cases a PEP 440 canonical parser would rewrite or reject. Added coverage for repeated punctuation in `slugify`.
- `CHANGELOG.md` — new. User-visible changes (punctuation slugs, Python 3.9 removal) are separate from internal maintenance (parser replacement, CI range and action pins). The Unicode limitation is listed as still present in 0.4.0.
- `MAINTENANCE.md` — new. Short release checklist, compatibility policy for the 3.10–3.13 window and version spelling, and three next items: Unicode `slugify`, whether non-ordinary version strings should be rejected, and a Python 3.14 decision.
- `RELEASE_NOTES.txt` and `TASK.md` were not changed. `ci.yml` stays at this directory's root, which is where the project supplied it.

## Remaining risks

- Ruff is not installed here, and the network was not used, so `python -m ruff check .` was not run. CI also installs unpinned Ruff, so later lint runs can drift.
- Python 3.10, 3.11, and 3.12 are not installed here. The new matrix was not executed on those interpreters. Syntax used in `slugkit.py` is 3.10-compatible (`list[int | str]`, `str | None`).
- GitHub Actions only runs workflows under `.github/workflows/`. This tree still keeps the workflow at `ci.yml`.
- An empty version still raises `AttributeError` (`vstring` was never set), matching `LooseVersion`. The message now names `_LooseVersion`. Ordinary versions do not hit this path.
- `normalize_version` still returns any other non-empty string unchanged. That matches old output and does not validate PEP 440.
- Unicode `slugify` is unchanged (`Café` becomes `caf`). The changelog does not call that fixed.
- The project has no license or README. None was invented.
- Python 3.14.5 ran the tests successfully, and `requires-python` still excludes 3.14. Installers on 3.14 will refuse the package until the support policy changes.

## Verification

`python3.13 --version` → `Python 3.13.7`

`python3 --version` → `Python 3.14.5`

`python3.10`, `python3.11`, `python3.12`, and `ruff` were not on `PATH`.

`python3.13 -m unittest` (the CI test command), exit 0:

```
...
----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

`python3 -m unittest` on Python 3.14.5 (outside the support window), exit 0:

```
...
----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

Earlier `python3.13 -m unittest discover -v` and the same command on Python 3.14.5 each reported, exit 0:

```
test_normalize_version (test_slugkit.SlugkitTests.test_normalize_version) ... ok
test_slugify (test_slugkit.SlugkitTests.test_slugify) ... ok
test_slugify_repeated_punctuation (test_slugkit.SlugkitTests.test_slugify_repeated_punctuation) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

`python3.13 -m py_compile slugkit.py test_slugkit.py` succeeded. The only import in `slugkit.py` is `re`. `tomllib` read `pyproject.toml` as version `0.4.0`, `requires-python` `>=3.10,<3.14`, Ruff target `py310`, and `py-modules` `["slugkit"]`. Ruby's YAML loader read `ci.yml`: permissions `{"contents"=>"read"}`, jobs `lint` and `test`, matrix `["3.10", "3.11", "3.12", "3.13"]`, and both jobs use `actions/checkout@v4` and `actions/setup-python@v5`.

A local `setuptools` 74.1.2 (already on disk under `/opt/homebrew/lib/python3.11/site-packages`, imported by Python 3.13.7) ran `setuptools.build_meta.build_wheel` with no download. It wrote `slugkit-0.4.0-py3-none-any.whl` containing `slugkit.py`, `slugkit-0.4.0.dist-info/METADATA`, `WHEEL`, `top_level.txt`, and `RECORD`. METADATA included `Version: 0.4.0` and `Requires-Python: <3.14,>=3.10`. `top_level.txt` contained `slugkit`. Generated `build/` and `slugkit.egg-info/` directories were removed afterward. `__pycache__` was removed as well.

The same Python 3.13 process compared `normalize_version` with vendored `setuptools._distutils.version.LooseVersion` for `1.2.0`, `2.0rc1`, `1.5.2b2`, `2.0a1`, `2.0b1`, `8.02`, `3.10a`, `3.1.1.6`, `10`, `0.4.0`, `2.0RC1`, `1.13++`, ` 1.2.0`, `3.2.pl0`, `2.2beta29`, `1996.07.12`, `0.960923`, `2g6`, `11g`, `5.5.kw`, `2.0b1pl0`, `v1.2.3`, `01.02.03`, `1.2.3dev`, `1.2.`, `.1`, `1..2`, `hello`, `1.2.3-rc1`, `8.02.00`, `3.10A`, and versions wrapped in newlines. Result: `mismatches 0`. Both implementations raise `AttributeError` on `""`. The `DeprecationWarning` in that run came from calling `LooseVersion` directly, not from `normalize_version`.
