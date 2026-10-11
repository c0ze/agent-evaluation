# Response: slugkit 0.4.0 release preparation

All deliverables in TASK.md are written. Local verification was partial: only Python 3.14.7
is installed here, with no pip, setuptools, ruff, or build tool, and no network. The suite
has not run on 3.10–3.13, and ruff and the package build have not run at all.

## Changed files

| File | Change |
| --- | --- |
| `pyproject.toml` | Version `0.4.0`. `requires-python = ">=3.10,<3.14"`. Classifiers for 3.10–3.13. New `dev` extra (`ruff`). Ruff `target-version` `py310` (was `py39`). |
| `slugkit.py` | Removed `from distutils.version import LooseVersion`. `normalize_version` returns its input unchanged. `slugify` is unchanged. |
| `test_slugkit.py` | Added repeated-punctuation test for `slugify`, more ordinary version cases for `normalize_version`, and a subprocess test that `slugkit` does not import `distutils`. |
| `ci.yml` | Matrix is 3.10, 3.11, 3.12, 3.13 (`fail-fast: false`). Top-level `permissions: contents: read`. Checkout sets `persist-credentials: false`. Timeouts added. Lint is its own job on 3.13. Both jobs install `.[dev]`. Actions remain `actions/checkout@v4` and `actions/setup-python@v5`. |
| `CHANGELOG.md` (new) | Built from `RELEASE_NOTES.txt`. User-visible changes are under Removed, Changed, and Known limitations. Maintenance is under Internal. The release is marked Unreleased because no date was given. |
| `MAINTENANCE.md` (new) | Release checklist, compatibility policy, and three prioritized maintenance items. |
| `RESPONSE.md` (new) | This file. |

`RELEASE_NOTES.txt` and `TASK.md` are unchanged. `ci.yml` sits at the directory root. It must
be placed at `.github/workflows/ci.yml` when it is applied to a repository.

## Decisions

- **Python range.** `requires-python` is `>=3.10,<3.14`, which matches the stated range
  literally. The upper cap blocks installs on 3.14 until CI validates it. Dropping the cap
  is a one-line change if the maintainers prefer open-ended bounds.
- **`normalize_version`.** `LooseVersion.__str__` returns the stored input string, so the
  old function returned its input for any non-empty string. The replacement is a pure
  pass-through, which keeps that behavior. I did not add real normalization, because that
  would change output and is out of scope. The name and old docstring overpromised; the
  docstring now describes what the function does.
- **`slugify`.** Left as is, because the release notes say the repeated-punctuation change is
  already implemented. Added a test for it. The Unicode limitation is documented, not fixed or
  tested as if fixed.
- **Actions.** Kept at the major tags named in the fixture notes. I did not pin to commit
  SHAs, since the notes asked for major versions.
- **Ruff.** Added as an unpinned `dev` dependency. I could not verify a specific version
  offline.

## Verification (exact results)

Environment: `/usr/bin/python3.14` (3.14.7) is the only interpreter. `ruff`, `pip`,
`setuptools`, `build`, and `twine` are not installed, and there is no network.

1. Original code on this interpreter, to confirm the import problem:
   ```
   $ python3.14 -B -c "from distutils.version import LooseVersion"
   ModuleNotFoundError: No module named 'distutils'
   ```
2. Updated test suite:
   ```
   $ python3.14 -B -m unittest -v
   test_does_not_import_distutils (test_slugkit.SlugkitTests.test_does_not_import_distutils) ... ok
   test_normalize_version (test_slugkit.SlugkitTests.test_normalize_version) ... ok
   test_slugify (test_slugkit.SlugkitTests.test_slugify) ... ok
   test_slugify_collapses_repeated_punctuation (test_slugkit.SlugkitTests.test_slugify_collapses_repeated_punctuation) ... ok

   Ran 4 tests in 0.043s

   OK
   exit=0
   ```
   Python 3.14 is outside the declared range, so this run does not show support for 3.10–3.13.
   On 3.14 the distutils test passes trivially, because distutils is absent there. Its real
   value is on 3.10 and 3.11, which were not available here.
3. `pyproject.toml` parsed with `tomllib`: name `slugkit`, version `0.4.0`, `requires-python`
   `>=3.10,<3.14`, classifiers for 3.10–3.13, extras `{'dev': ['ruff']}`, ruff
   `{'target-version': 'py310', 'line-length': 100}`.
4. `ci.yml` parsed with PyYAML: `permissions` is `{'contents': 'read'}`. The `test` job matrix is
   `['3.10', '3.11', '3.12', '3.13']`. The `lint` job runs `ruff check .` on 3.13. All
   `uses:` entries are `actions/checkout@v4` or `actions/setup-python@v5`.
5. Lint substitutes, since ruff is unavailable: no line over 100 characters
   (`grep -nE '.{101,}'` found none), no trailing whitespace, both `.py` files parse with
   `ast`, and no unused imports on manual inspection.
6. Behavior probes on 3.14:
   ```
   'café' -> 'caf'
   'naïve Ünïcode' -> 'na-ve-n-code'
   'a!!!b???c' -> 'a-b-c'
   '--Hello...World--' -> 'hello-world'
   normalize_version '1.2.0' -> '1.2.0'
   normalize_version '2.0rc1' -> '2.0rc1'
   normalize_version '1.02' -> '1.02'
   normalize_version '' -> ''
   normalize_version 'v1.0' -> 'v1.0'
   ```
7. NFKD check: `ø` and `ß` do not decompose, and ASCII filtering drops both. This supports the
   note in `MAINTENANCE.md` item 3.

Not run: `ruff check .`, the suite on 3.10, 3.11, 3.12, and 3.13, `python -m build`,
`twine check`, a wheel install smoke test, and actionlint.

Not verified by execution: that the old `LooseVersion` returned its input unchanged, and
that an empty string made it raise `AttributeError`. Both come from reading CPython's
distutils source, where `__str__` returns `self.vstring`, which only `parse()` sets. The
old code could not be run here. The CHANGELOG entry for the empty-string change relies on
that reading.

## Remaining risks

1. **Lower versions untested.** Nothing has run on 3.10–3.13. The CI matrix is the first real
   check, and the `-S` distutils test matters most on 3.10 and 3.11.
2. **Old behavior unverified.** The equivalence of `normalize_version` with the old
   implementation is argued from source, not executed. Running the old and new functions side
   by side on 3.11 would settle it.
3. **Python 3.10 end of life.** CPython 3.10 reaches end of life in October 2026 (PEP 619).
   Confirm the exact date. The lower bound may need to move in the next release.
4. **Upper bound.** `<3.14` makes pip refuse to install on 3.14 until the bound is changed.
5. **Ruff unpinned.** New Ruff releases could add rules and break CI. Pin it once a version
   has been verified.
6. **Packaging unbuilt.** Classifiers and the `dev` extra were validated only as parsed TOML.
   A real build has not run.
7. **`normalize_version` naming.** The function is a pass-through under a name that suggests
   normalization. Callers may expect real normalization.
8. **Unicode.** `slugify("café")` returns `"caf"`. This is documented as a known limitation
   and is not fixed in 0.4.0.
9. **Action pins.** Major tags, not commit SHAs, as the notes asked. Tags can be re-pointed
   by their publishers.
10. **Workflow placement.** `ci.yml` must move to `.github/workflows/` when applied.
11. **Release date.** The changelog says Unreleased. A date is needed at release time.
