# Maintaining slugkit

## Compatibility policy

Slugkit 0.4.0 supports Python 3.10 through 3.13 inclusive. Use syntax and standard-library APIs available on 3.10. When changing the supported range, update `requires-python`, the Python classifiers, Ruff's target and the CI matrix together.

Preserve the spelling of ordinary version strings, including leading zeros and prerelease suffixes. Treat changes to generated slugs as user-visible because callers may use them in existing URLs.

## Release checklist

- [ ] Set the release version in `pyproject.toml` and reconcile `CHANGELOG.md` with the release notes.
- [ ] Run `python -m unittest discover -v` and `python -m ruff check .`. Confirm all four Python versions pass in CI.
- [ ] Build the source distribution and wheel with `python -m build`. Install the wheel in a clean supported environment, check its version and exercise both public helpers outside the source tree.
- [ ] Tag the verified commit with the release version and publish the checked distributions.

## Next maintenance items, in priority order

1. Add an installed-wheel smoke test to CI so a packaging regression cannot be hidden by imports from the source tree.
2. Collect representative Unicode slug examples and agree on expected outputs before changing transliteration. Include existing URL compatibility in the decision.
3. Define the behavior for empty and malformed version strings and add tests for the agreed contract.
