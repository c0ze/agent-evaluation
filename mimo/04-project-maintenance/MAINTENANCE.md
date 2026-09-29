# Maintenance

## Release checklist

1. Confirm the supported Python range (3.10–3.13) matches `requires-python` in
   `pyproject.toml`, the CI matrix in `ci.yml`, and this policy.
2. Update `CHANGELOG.md` from the release notes: separate user-visible changes
   from internal maintenance, and record known limitations without claiming
   fixes that did not ship.
3. Bump `version` in `pyproject.toml`.
4. Run local checks: `python -m unittest` and `ruff check .`.
5. Push and confirm the CI test matrix passes on every supported Python.
6. Tag the release.

## Compatibility policy

- Supported Python range: 3.10 through 3.13 (`requires-python = ">=3.10"`;
  CI validates 3.10–3.13).
- Dropping or adding a Python version is a user-visible change and must appear
  in `CHANGELOG.md`.
- `slugify` and `normalize_version` keep observable behavior across patch
  releases. For ordinary version strings (dotted numerics, pre-release
  suffixes such as `2.0rc1`), `normalize_version` returns the input unchanged.
- Deprecated standard-library APIs (for example `distutils`) must not be used.
  Replacements must preserve observable behavior for ordinary inputs.

## Next maintenance priorities

1. Improve Unicode letter transliteration in `slugify` (documented known
   limitation; not fixed in 0.4.0).
2. Define and test stricter `normalize_version` semantics for non-ordinary
   inputs; today the function is a pass-through of the input string.
3. Tighten CI supply-chain posture: pin `actions/checkout` and
   `actions/setup-python` to full commit SHAs, and widen the test matrix when
   the support window grows.
