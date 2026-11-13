# Maintaining slugkit

## Release checklist

1. Confirm `version` in `pyproject.toml` is the version being released.
2. Confirm the Python range agrees in all three places: `requires-python` and
   the classifiers in `pyproject.toml`, the `test` matrix in `ci.yml`, and
   ruff's `target-version` (the lowest supported version).
3. Run the checks CI runs, on at least the lowest and highest supported Python:
   - `python -W error::DeprecationWarning -m unittest -v`
   - `ruff check .`
4. Move every entry from `RELEASE_NOTES.txt` into `CHANGELOG.md`. Keep
   user-visible changes apart from internal maintenance, carry known
   limitations over as limitations, and claim nothing the code does not do.
5. Replace "not yet released" in the `CHANGELOG.md` heading with the release
   date.
6. Check that CI is green on the release commit for every matrix entry.
7. Build the sdist and wheel in a clean environment and confirm the wheel
   contains `slugkit.py` and not `test_slugkit.py`.
8. Tag the release commit `v<version>`, publish, then install the published
   package into a fresh environment and import it.

## Compatibility policy

- **Python versions.** Supported means tested in CI: currently 3.10, 3.11,
  3.12 and 3.13. `requires-python` carries only the lower bound (`>=3.10`).
  It has no upper cap, so a newer Python can install slugkit but is
  unsupported until it is added to the CI matrix and the classifiers.
- **Dropping a Python version** happens only in a minor release (never a
  patch release), is listed under user-visible changes in the changelog, and
  raises `requires-python` so older interpreters keep resolving to the last
  release that supported them.
- **Public API.** `slugify` and `normalize_version` are the public API. Their
  output for inputs that already work does not change in a patch release. A
  change to existing output needs a minor release at least and a changelog
  entry that shows a before/after example.
- **`normalize_version`** returns ordinary versions unchanged. It does not
  apply PEP 440 normalization (`"1.02"` stays `"1.02"`), and changing that
  would be a breaking change.
- **Dependencies.** slugkit has no runtime dependencies. Adding one is a
  user-visible change.
- **CI actions** are pinned to major versions (`actions/checkout@v4`,
  `actions/setup-python@v5`). A major bump is its own change with its own
  changelog entry.

## Next maintenance items, in priority order

1. **Fix Unicode handling in `slugify`.** This is the one known user-facing
   defect: non-ASCII letters are dropped rather than transliterated
   (`"Café au lait"` → `"caf-au-lait"`, and a fully non-Latin title gives an
   empty slug). Decide the intended behavior first (accent folding with
   `unicodedata` from the standard library covers Latin scripts with no new
   dependency; other scripts need a separate decision), then ship it in a
   minor release because existing slugs will change.
2. **Decide what `normalize_version` is for.** It returns its input unchanged
   for every non-empty string, as it always did under `distutils`, so the
   name promises more than the function does. Either document it as
   validation only, or deprecate it in favor of a function that really
   normalizes. Do not change its output silently.
3. **Make releases reproducible and evaluate Python 3.14.** Pin the ruff
   version used in CI (it currently installs whatever is latest, so a new
   ruff release can turn CI red with no code change), add a CI step that
   builds the sdist and wheel, and add 3.14 to the matrix and classifiers
   once it passes there.
