# Response — 0.4.0 release preparation

## Changed files

| File | Change |
| --- | --- |
| `slugkit.py` | Removed the `from distutils.version import LooseVersion` import (distutils is gone from the stdlib in 3.12+). `normalize_version` now parses digits/ASCII-letter runs locally (`_VERSION_COMPONENT_RE`), validates that at least one component exists, and returns the value unchanged. `slugify` keeps its regex but is now documented; module got `__all__`. |
| `test_slugkit.py` | Added tests: repeated-punctuation collapsing, digits in slugs, pre-release suffixes (`2.0rc1`, `1.4.0b2`, `0.4.0.dev1`, `3.0a1`), preserved leading zeros (`1.02` -> `1.02`, unchanged vs. old behavior), rejection of values with no components, and a subprocess test proving `import slugkit` no longer pulls in `distutils`. |
| `pyproject.toml` | `version` 0.3.2 -> 0.4.0; `requires-python` `>=3.9` -> `>=3.10`; classifiers for 3.10/3.11/3.12/3.13; ruff `target-version` `py39` -> `py310`. No runtime dependency was added. |
| `ci.yml` | Matrix `["3.9","3.10"]` -> `["3.10","3.11","3.12","3.13"]`; added top-level `permissions: contents: read` and `persist-credentials: false` on checkout; kept `actions/checkout@v4` and `actions/setup-python@v5`; added `fail-fast: false`, an explicit pip upgrade, and `-v` on unittest. |
| `CHANGELOG.md` | New. 0.4.0 split into User-visible / Internal maintenance / Known limitations, derived only from `RELEASE_NOTES.txt` and the actual diff. |
| `MAINTENANCE.md` | New. Release checklist, compatibility policy (3.10-3.13, stdlib-only, no runtime deps, behavior changes need a CHANGELOG entry + test), and the next three prioritized items (Unicode transliteration; explicit `py-modules` + sdist/wheel build check; SHA-pinning actions + scheduled run). |
| `RESPONSE.md` | This file. |

`RELEASE_NOTES.txt` and `TASK.md` were left untouched (inputs).

## Behavior analysis behind the distutils removal

The old code was `return str(LooseVersion(value))`. In CPython's
`distutils.version.LooseVersion`, `parse()` stores the input verbatim in
`self.vstring` and `__str__` returns `self.vstring` — i.e. for any input it
parsed, `normalize_version` was effectively the identity function, which is why
`2.0rc1` survived unchanged. The replacement keeps that contract for ordinary
versions (identity after a successful parse) instead of switching to
`packaging.version.Version`, which would have raised on non-PEP 440 input and
rewritten values such as `1.02` or `v1.2`, and would have added a runtime
dependency. Only deliberate difference: a value with no digits and no letters
(`""`, `"!!!"`) now raises `ValueError` instead of echoing garbage (`""` used to
fail with `AttributeError`). Whitespace is still not stripped, matching the old
behavior.

## Verification results (exact)

- `python3 -m unittest -v` (CPython 3.14.7, this directory):
  `Ran 8 tests in 0.033s` / `OK` — 8/8 passed, 0 failures, 0 errors.
  Cases: `test_slugify`, `test_repeated_punctuation_collapses_to_one_separator`,
  `test_digits_are_kept`, `test_normalize_version`,
  `test_pre_release_suffixes_are_preserved`,
  `test_leading_zeros_are_not_stripped`,
  `test_value_without_components_is_rejected`,
  `test_import_does_not_use_distutils`.
- `python3 -m compileall -q slugkit.py test_slugkit.py`: `compileall OK`.
- `pyproject.toml` parsed with `tomllib`: `0.4.0`, `>=3.10`, `py310`.
- `ci.yml` parsed with `yaml.safe_load`: valid; matrix `3.10-3.13`,
  `permissions: {contents: read}`, `persist-credentials: false`,
  `actions/checkout@v4`, `actions/setup-python@v5`.
- Smoke check: `normalize_version` -> `['1.2.0', '2.0rc1', '0.4.0', '1.02', '10.0']`;
  `slugify` -> `['hello-world', 'hello-world', 'ber-caf']` (the last one
  re-confirms the documented Unicode limitation).

Not run locally (and why): `ruff check .` — no `ruff` binary and no network to
install one; `pip install -e .` / build — no `setuptools` in this
interpreter; the 3.10/3.11/3.12/3.13 matrix — only CPython 3.14.7 is installed
here. These are covered by CI in `ci.yml` and are unverified for this change.

## Remaining risks

1. **No 3.10-3.13 interpreter locally.** The matrix is unvalidated here; only
   3.14.7 was exercised. The change itself is version-agnostic (regex + stdlib
   only), but CI is the real gate.
2. **Old behavior reconstructed, not executed.** No distutils/setuptools copy
   exists on this machine, so the pre-change semantics of `LooseVersion` (input
   echoed verbatim by `__str__`) come from the CPython implementation, not from
   a live comparison on 3.9/3.10. If a downstream caller relied on comparing
   `normalize_version` output to something else, the identity assumption should
   be re-checked on an old interpreter.
3. **`ValueError` on component-free input** is a narrow behavior change (old:
   echoed garbage / `AttributeError`). Flagged in `CHANGELOG.md`; if strict
   parity is required, drop the validation and return `value` unconditionally.
4. **`requires-python` has no upper bound.** The policy range 3.10-3.13 is
   expressed via classifiers and CI, so pip will still install 0.4.0 on 3.14+
   where it is untested (it does import and pass tests on 3.14.7, but that is
   not a support commitment). Add `<3.14` if hard enforcement is wanted.
5. **Packaging relies on setuptools auto-discovery** for the flat
   `slugkit.py` layout, and no sdist/wheel was built here — listed as
   maintenance item 2.
6. **Unicode transliteration remains broken** (`"Über Café"` -> `"ber-caf"`).
   Not claimed as fixed anywhere; recorded as a known limitation and as
   maintenance item 1.
