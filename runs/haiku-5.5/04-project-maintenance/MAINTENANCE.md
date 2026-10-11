# Maintenance

## Release checklist

1. Set `version` in `pyproject.toml` and move the `Unreleased` entries in `CHANGELOG.md`
   under the new version heading with the release date.
2. Confirm CI passes for every Python in the matrix (3.10–3.13) and for the lint job.
3. From a clean checkout, run `python -m unittest` and `ruff check .` on the lowest and
   highest supported Python.
4. Build the sdist and wheel with `python -m build`, then run `twine check dist/*`.
5. Install the wheel into a fresh virtualenv on the lowest and highest supported Python,
   and check that `import slugkit` works.
6. Tag the release as `vX.Y.Z` and create the GitHub release from the CHANGELOG section.
7. Publish the built artifacts.

## Compatibility policy

- **Python versions.** The supported range is declared in `requires-python` and the
  classifiers, and it must match the CI test matrix. A Python version is added only after
  CI passes on it. Dropping a version is listed under "Removed" in the CHANGELOG and
  happens in a minor release, normally after that version's upstream end of life.
- **Public API.** `slugify` and `normalize_version` are public. A change to output for
  ordinary inputs is a breaking change and must be listed under "Changed" or "Removed".
  While the version is `0.x`, breaking changes ship in minor releases and are called out
  in the CHANGELOG.
- **Dependencies.** The runtime package has no dependencies and should stay standard
  library only. Development tooling goes in the `dev` extra.
- **Changelog sections.** User-visible changes go under the user-facing headings. Internal
  work goes under "Internal".

## Next three maintenance items (priority order)

1. **Python 3.10 end of life.** CPython 3.10 reaches end of life in October 2026
   (PEP 619). Before the next release, decide whether to drop 3.10 from `requires-python`
   and the matrix. Add Python 3.14 to CI and classifiers so the `<3.14` upper bound can be
   removed or moved.
2. **Define the `normalize_version` contract.** It currently returns its input unchanged,
   but its name and earlier docstring suggest normalization. Decide whether it stays a
   pass-through, which would be documented as such, or becomes real normalization, which
   would change output (for example for leading zeros). Add tests for the chosen behavior,
   including empty input.
3. **Non-ASCII handling in `slugify`.** Non-ASCII letters are treated as separators, so
   `"café"` becomes `"caf"`. Choose an approach, such as Unicode decomposition followed
   by ASCII filtering, and add tests. Plain decomposition does not map every letter (for
   example `ø` or `ß`), so the approach needs a decision before it is implemented.
