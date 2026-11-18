# Maintenance

## Release checklist

- Update the project version and changelog. Confirm that the notes match the changes and record known limitations.
- Confirm the CI matrix passes on every supported Python version and Ruff passes.
- Build the source distribution and wheel. Install the wheel in a clean environment and smoke-test both public functions.
- Tag the reviewed commit and publish the verified artifacts.

## Compatibility policy

Slugkit supports Python 3.10 through 3.13. Update package metadata, the CI matrix, and the changelog together when support changes. Keep Ruff's target on the oldest supported version.

Preserve existing output for ordinary version strings, including suffix spelling. Document and test any intentional changes to the text returned by either public function.

## Next maintenance items in priority order

1. Add an installed-wheel smoke test to CI to catch packaging regressions.
2. Define the desired handling of Unicode letters in slugs and add representative tests before changing outputs.
3. Evaluate each new Python minor release before widening the supported range.
