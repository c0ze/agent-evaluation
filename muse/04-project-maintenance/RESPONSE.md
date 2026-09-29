# Response — 0.4.0 release preparation

## Changed files

- `slugkit.py` — replaced `distutils.version.LooseVersion` with
  `packaging.version.Version`; non-PEP 440 input passes through unchanged.
- `pyproject.toml` — `version = "0.4.0"`, `requires-python = ">=3.10,<3.14"`,
  added `dependencies = ["packaging>=21"]`, 3.10–3.13 classifiers,
  `ruff target-version = "py310"`.
- `ci.yml` — matrix `["3.10", "3.11", "3.12", "3.13"]`, added
  `permissions: contents: read`; kept `actions/checkout@v4` and
  `actions/setup-python@v5`.
- `test_slugkit.py` — added repeated-punctuation `slugify` test, ordinary-version
  `normalize_version` cases (`1.0`, `0.4.0`, `1.2.3a1`, `1.2.3.post1`), and
  invalid-input passthrough test.
- `CHANGELOG.md` (new) — user-visible changes vs internal CI notes; Unicode
  limitation recorded as not fixed, per release notes.
- `MAINTENANCE.md` (new) — release checklist, compatibility policy, next three
  maintenance items.

`TASK.md` and `RELEASE_NOTES.txt` untouched.

## Remaining risks

- Only Python 3.14 available locally; 3.10–3.13 matrix validated by CI, not here.
- `packaging` added as a runtime dependency (was transitively free via stdlib).
- Non-PEP 440 `normalize_version` input now passes through instead of
  `LooseVersion` coercion — lenient fallback, edge outputs may differ.

## Verification (exact)

- `python3 -W error::DeprecationWarning -m unittest -v` — 5 tests, OK
  (also proves no `distutils` deprecation warning).
- `python3 -m py_compile slugkit.py test_slugkit.py` — ok.
- `tomllib` parse of `pyproject.toml` — `0.4.0`, `>=3.10,<3.14`,
  `['packaging>=21']`; `grep distutils slugkit.py` — 0 matches.
- `ruff check` — not run: ruff not installed and task forbids network installs.
- CI YAML — visually verified (matrix, pins, least-privilege permissions).
