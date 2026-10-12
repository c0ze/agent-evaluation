# Response: Project Maintenance for 0.4.0 Release

## Changed Files

1. **pyproject.toml**
   - Version bumped to `0.4.0`
   - `requires-python` changed from `>=3.9` to `>=3.10,<3.14`
   - Ruff `target-version` updated from `py39` to `py310`

2. **slugkit.py**
   - Removed deprecated `distutils.version.LooseVersion` import
   - Implemented custom `normalize_version` using regex to handle ordinary dotted versions and common pre-release suffixes (rc, alpha, beta, dev, post) while preserving observable behavior for tested cases

3. **ci.yml**
   - Test matrix updated from Python `["3.9", "3.10"]` to `["3.10", "3.11", "3.12", "3.13"]`
   - Actions pinned to major versions: `actions/checkout@v4`, `actions/setup-python@v5`

4. **test_slugkit.py** (expanded)
   - Added comprehensive test cases for `slugify`: repeated punctuation, leading/trailing separators, uppercase
   - Added comprehensive test cases for `normalize_version`: multiple dotted versions, all common pre-release suffixes, whitespace handling, fallback behavior for unrecognized patterns

5. **CHANGELOG.md** (created)
   - Formatted per Keep a Changelog
   - Separated user-visible changes (Fixed, Changed) from internal maintenance
   - Included known limitation about Unicode transliteration without claiming it's fixed

6. **MAINTENANCE.md** (created)
   - Release checklist (7 steps)
   - Compatibility policy (Python versions, deprecation, dependencies, breaking changes)
   - Next three prioritized maintenance items: Unicode handling, optional `packaging` dependency, type hints

## Remaining Risks

1. **Version normalization edge cases**: The custom regex-based normalizer handles common cases but may differ from `LooseVersion` for complex version strings (e.g., multiple pre-release segments, local versions, epoch). This is mitigated by the fallback returning input as-is.

2. **No lint verification**: `ruff` and `build` could not be run locally due to network restrictions preventing package installation. CI will catch lint issues on push.

3. **No multi-Python test run**: Only the current Python version was tested locally. CI matrix will validate 3.10–3.13 compatibility.

4. **Unicode handling**: Known limitation documented but not addressed; users with non-ASCII input may get poor slugs.

## Verification Results

- **Unit tests**: `python -m unittest` → **PASSED** (2 test classes, 12 test cases)
- **Basic functionality**: Manual import and function calls work correctly
  - `slugify("  Hello, World! ")` → `"hello-world"`
  - `normalize_version("2.0rc1")` → `"2.0rc1"`
- **CI configuration**: Valid YAML, correct action versions, correct Python matrix
- **Metadata alignment**: `pyproject.toml` specifies Python 3.10–3.13, version 0.4.0