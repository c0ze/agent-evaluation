# Maintenance

## Release checklist

- [ ] Confirm the package version, supported Python range, and changelog agree.
- [ ] Run the unit suite and Ruff on Python 3.10, 3.11, 3.12, and 3.13.
- [ ] Build and inspect the wheel and source archive, then verify the built package.
- [ ] Review the release diff and tag the verified 0.4.0 commit.

## Compatibility policy

The supported Python range is 3.10 through 3.13, as declared in package metadata and CI.
Python 3.9 is unsupported. Updates should preserve established behavior for ordinary inputs
to the public helpers; intentional behavior changes should be documented in `CHANGELOG.md`.

## Next maintenance items

1. **High:** Decide how Unicode letters should be handled by `slugify` and add coverage. Current
   transliteration is poor for some Unicode letters.
2. **Medium:** Define the accepted input forms for `normalize_version` and add regression cases
   for edge cases beyond ordinary dotted and pre-release strings.
3. **Low:** Add automated wheel and source-archive build checks to CI.
