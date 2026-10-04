# RESPONSE — 0.4.0 release preparation

## Changed files

| File | Status | Change |
| --- | --- | --- |
| `slugkit.py` | modified | Removed `from distutils.version import LooseVersion`; `normalize_version` now validates and returns the input. `slugify` logic unchanged (regex hoisted to a named constant, compiled once). |
| `test_slugkit.py` | modified | 2 tests → 12 tests. Added ordinary-version regression corpus, whitespace/tag-prefix behavior, `ValueError`/`TypeError` cases, a no-`distutils`-import guard, and a conditional equivalence test against real `distutils`. |
| `pyproject.toml` | modified | `version` `0.3.2` → `0.4.0`; `requires-python` `>=3.9` → `>=3.10,<3.14`; `ruff.target-version` `py39` → `py310`; added 3.10–3.13 classifiers and a `dev = ["ruff"]` extra. |
| `ci.yml` | modified | Matrix 3.9/3.10 → 3.10–3.13 with `fail-fast: false`; lint split into its own single-interpreter (3.13) job; workflow- and job-level `permissions: contents: read`; `concurrency` group; installs via `.[dev]`. `actions/checkout@v4` and `actions/setup-python@v5` unchanged, as the release notes require. |
| `CHANGELOG.md` | **new** | 0.4.0 entry split into User-visible / Internal / Known limitations. Marked unreleased (no date invented). |
| `MAINTENANCE.md` | **new** | Release checklist, compatibility policy, next three prioritized maintenance items. |
| `RESPONSE.md` | **new** | This file. |
| `TASK.md`, `RELEASE_NOTES.txt` | untouched | Fixture inputs; left byte-for-byte unmodified. |

## The `distutils` replacement, and why

`distutils` is not importable on either interpreter available here — Python 3.13.13 and 3.14.3 both raise
`ModuleNotFoundError: No module named 'distutils'`. The package as supplied therefore failed to import at
all, including on 3.13, the version this release adds support for.

The replacement deliberately does **not** reimplement `LooseVersion`'s tokenizer. On Python ≥3.10
`LooseVersion.__str__` returns its input string unchanged, so a reimplementation that rebuilt the string
from tokens would be strictly *worse* than the original: it would drop the separators in valid forms
like `1.0.post1` and `1.0.dev4`. Instead `normalize_version` strips surrounding whitespace, removes a
single leading `v` (VCS tag form), validates the rest, and returns it. Ordinary versions are returned
byte-for-byte unchanged.

Two intentional, documented additions: `normalize_version` now raises `ValueError` on input that is not
a plausible version and `TypeError` on non-`str` input. Callers who previously relied on arbitrary
strings passing through will now see an exception; this is called out under User-visible in the changelog.
Validation is intentionally permissive (accepts `[0-9A-Za-z.+_-]` with at least one digit), so nothing
that previously worked is now rejected.

## Verification results

Environment: no network used. Interpreters available: **Python 3.13.13** and **Python 3.14.3**.

**Baseline, before changes** (`python3 -m unittest -v`, Python 3.14.3):

```
ImportError: Failed to import test module: test_slugkit
ModuleNotFoundError: No module named 'distutils'   (from slugkit.py line 1)
FAILED (errors=1)
```

**After changes** — full suite green on both interpreters:

```
$ python3 -m unittest discover          # Python 3.14.3
Ran 12 tests in 0.000s
OK (skipped=1)                            exit=0

$ ~/.local/share/mise/installs/python/3.13.13/bin/python3.13 -m unittest discover   # Python 3.13.13
Ran 12 tests in 0.000s
OK (skipped=1)                            exit=0
```

The 1 skip is `test_normalize_version_matches_legacy_distutils`, skipped because `distutils` does not
exist on either interpreter (see remaining risks).

**Static/coherence harness** (`/tmp/verify_slugkit_release.py`, kept outside the project directory):
**47 checks passed, 0 failed.** It verified: `pyproject.toml` parses via `tomllib`; version is `0.4.0`;
`requires-python` is `>=3.10,<3.14`; `ruff.target-version` is `py310`; classifiers exactly cover
3.10–3.13 with no leftover 3.9 entry; `ci.yml` parses via PyYAML; workflow- and job-level permissions
are `contents: read`; a `concurrency` group exists; the CI matrix equals the pyproject classifier
range (cross-checked programmatically, not by eye); `fail-fast: false`; only `actions/checkout` and
`actions/setup-python` are used, pinned to `@v4` / `@v5`; both test and lint are invoked; `.[dev]` is
the install path; every `.py` file parses and compiles; no `distutils` import exists in `slugkit.py`;
no line exceeds the configured 100-char limit and no tab indentation exists; `import slugkit` succeeds;
`__all__` is accurate; `distutils` is absent from `sys.modules` after import; the changelog separates
user-visible from internal, records the known limitation, and does not claim the Unicode issue is fixed.

**Not run (and why):**

- `ruff check .` — **ruff is not installed and cannot be installed without network.** As a partial
  substitute the harness checks line length (E501) and tab indentation, and confirms every file compiles
  and has no unused imports by inspection. This is *not* equivalent to a real ruff run.
- `pip install -e ".[dev]"` / `python -m build` — **infeasible offline**: neither `setuptools` nor
  `build` is importable on either interpreter, and
  `pip install -e . --no-build-isolation --no-index` fails with
  `BackendUnavailable: Cannot import 'setuptools.build_meta'`. The `dev` extra and the editable install
  are therefore structurally validated but never actually exercised.
- The CI workflow itself — GitHub Actions cannot be run locally; `ci.yml` was validated structurally only.
- Python 3.10, 3.11, 3.12 — not installed on this machine, so the new support floor was not executed.

## Remaining risks

1. **The `distutils` equivalence test has never executed.** It skips everywhere locally because
   `distutils` is gone. The claim "output unchanged for ordinary versions" rests on two things: the
   pre-existing test expectations (`1.2.0` → `1.2.0`, `2.0rc1` → `2.0rc1`), which are reproduced exactly,
   and the documented Python ≥3.10 contract that `LooseVersion.__str__` returns its input verbatim. For
   the extra corpus entries (`1.0.post1`, `1.0.dev4`, `1.2`, `3`, `10.20.30`, `1.2.0-rc1`, `1.0+local.1`)
   that second point is a **reasoned inference, not a locally measured comparison** — I could not run a
   real `LooseVersion` anywhere. Mitigation: run `python -m unittest test_slugkit.SlugkitTests` on a
   3.10 or 3.11 interpreter where `distutils` still exists, and the test will compare the two
   implementations directly across the whole corpus. Worth doing before tagging 0.4.0.
2. **Python 3.10 is untested locally** even though it is the new floor. The code uses nothing newer than
   3.10 (`f-strings`, `str.isdigit`, `re` `\A`/`\Z`, `pathlib.read_text`), and the suite passes on 3.13,
   but the floor itself has not been executed. CI covers this once it runs.
3. **Packaging is unexercised.** Because setuptools is unavailable offline, the wheel/sdist build, the
   `dev` extra resolution, and `pip install -e .` were never run. The metadata is well-formed and parses,
   but a first real build is still an untested step.
4. **Lint is unverified** (risk 1 above): a ruff rule other than E501 could still fail in CI.
5. **The workflow file is at the repository root, not `.github/workflows/ci.yml`.** As supplied, GitHub
   Actions will not discover it. I left the layout alone because restructuring the fixture was outside
   the task's scope, and flagged it as priority #2 in `MAINTENANCE.md`. Confirm the real path before
   relying on CI.
6. **0.4.0 is still marked unreleased** and carries no release date, since none was supplied and I would
   not invent one. Add the date when the release is actually cut.
