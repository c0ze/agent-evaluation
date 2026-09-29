# Maintenance

## Release checklist

1. Confirm `version` in `pyproject.toml` matches the release (currently
   `0.4.0`) and that `CHANGELOG.md` has a matching section.
2. Replace `Unreleased` in `CHANGELOG.md` with the release date. Only list
   changes that are in the code; keep known limitations listed until fixed.
3. Run the checks locally on every supported Python version:
   - `python -W error::DeprecationWarning -m unittest -v`
   - `ruff check .`
4. Confirm CI is green on the release commit for all matrix entries
   (3.10 to 3.13) and the lint job.
5. Build the sdist and wheel in a clean environment and check the metadata:
   `Version`, `Requires-Python: >=3.10`, and the classifiers.
6. Install the built wheel into a fresh virtualenv on the newest supported
   Python (without setuptools) and import `slugkit`.
7. Tag the release (`v0.4.0`) and publish.

## Compatibility policy

- **Python versions:** slugkit supports the CPython versions listed in the
  `pyproject.toml` classifiers and the CI matrix, currently 3.10 to 3.13.
  `requires-python`, the classifiers, the CI matrix and ruff's
  `target-version` must change together. Dropping a Python version is noted
  under "Removed" in the changelog and happens only in a minor or major
  release, never a patch release.
- **Public API:** `slugify` and `normalize_version` are the public API.
  Output for ordinary inputs does not change within a minor series. Any
  output change is called out in the changelog.
- **`normalize_version`:** returns the input string unchanged, matching the
  pre-0.4.0 `str(LooseVersion(value))` output. It does not apply PEP 440
  normalization. Switching to `packaging.version` would change output
  (`"1.02"` would become `"1.2"`) and needs a deprecation cycle.
- **Dependencies:** slugkit has no runtime dependencies. Adding one needs a
  changelog entry.
- **CI actions:** stay on `actions/checkout@v4` and `actions/setup-python@v5`
  unless a major-version bump is reviewed on purpose. The workflow keeps
  `permissions: contents: read`.

## Next maintenance items (prioritized)

1. **Decide what `normalize_version` should mean.** It currently returns its
   input unchanged, which matches old behavior but not its name or docstring.
   Either document it as a validating pass-through, or design real
   normalization (for example PEP 440 via `packaging`) behind a new function
   or a deprecation period.
2. **Unicode handling in `slugify`.** Non-ASCII letters are dropped
   (`"Café Müller"` becomes `"caf-m-ller"`). Add ASCII transliteration
   (for example `unicodedata.normalize("NFKD", ...)` for accented letters)
   with tests, and document what happens to scripts that cannot be
   transliterated.
3. **Harden the supply chain and release path.** Pin the ruff version used in
   CI so lint results do not change underneath the project, consider pinning
   actions to commit SHAs (keeping the v4/v5 majors), and add a CI step that
   builds the wheel and installs it into a clean venv, so packaging mistakes
   are caught before release.
