"""Tests for slugkit.

The version tests are deliberately split into three groups:

* ``test_normalize_version`` pins the behavior the package promised before the
  distutils removal -- these expectations must never change silently.
* ``test_normalize_version_matches_legacy_distutils`` re-checks that promise
  against a real ``distutils.version.LooseVersion`` on any interpreter that
  still ships one, and skips elsewhere.
* the remaining tests cover the small, documented additions.
"""

import ast
import inspect
import pathlib
import unittest

import slugkit
from slugkit import normalize_version, slugify

try:  # Removed from the standard library in 3.12; gone on 3.13+ without setuptools.
    from distutils.version import LooseVersion
except ImportError:  # pragma: no cover - depends on interpreter
    LooseVersion = None

# Ordinary versions, i.e. the inputs the previous implementation handled and
# whose output must stay byte-for-byte identical.
ORDINARY_VERSIONS = [
    "1.2.0",
    "2.0rc1",
    "0.4.0",
    "10.20.30",
    "1.0.0a1",
    "1.0.0",
    "1.0.post1",
    "1.0.dev4",
    "1.0+local.1",
    "1.2.0-rc1",
    "1.2",
    "3",
]


class SlugkitTests(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")

    def test_slugify_collapses_repeated_punctuation(self):
        # Repeated separators were always collapsed to a single "-"; keep the
        # guarantee explicit rather than incidental to the regex.
        self.assertEqual(slugify("Hello---World!!"), "hello-world")
        self.assertEqual(slugify("a__b//c"), "a-b-c")
        self.assertEqual(slugify("---trim---"), "trim")

    def test_slugify_known_unicode_limitation(self):
        # Known limitation, NOT fixed in 0.4.0: non-ASCII letters are dropped
        # rather than transliterated. Pinned so that a future fix is a
        # deliberate, changelogged change.
        self.assertEqual(slugify("café"), "caf")

    def test_normalize_version(self):
        self.assertEqual(normalize_version("1.2.0"), "1.2.0")
        self.assertEqual(normalize_version("2.0rc1"), "2.0rc1")

    def test_normalize_version_ordinary_versions_are_unchanged(self):
        for value in ORDINARY_VERSIONS:
            with self.subTest(value=value):
                self.assertEqual(normalize_version(value), value)

    def test_normalize_version_strips_whitespace(self):
        self.assertEqual(normalize_version("  1.2.0  "), "1.2.0")

    def test_normalize_version_strips_single_tag_prefix(self):
        self.assertEqual(normalize_version("v0.4.0"), "0.4.0")
        self.assertEqual(normalize_version("V0.4.0"), "0.4.0")
        # Only a single leading "v" is removed.
        self.assertEqual(normalize_version("vv1.0"), "v1.0")

    def test_normalize_version_rejects_non_versions(self):
        for value in ["", "   ", "abc", "not a version!", "--", "1 2 3"]:
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    normalize_version(value)

    def test_normalize_version_rejects_non_string(self):
        for value in [1.2, 120, None, ("1", "2")]:
            with self.subTest(value=value):
                with self.assertRaises(TypeError):
                    normalize_version(value)

    @unittest.skipIf(LooseVersion is None, "distutils is not available on this interpreter")
    def test_normalize_version_matches_legacy_distutils(self):
        for value in ORDINARY_VERSIONS:
            with self.subTest(value=value):
                self.assertEqual(normalize_version(value), str(LooseVersion(value)))


class NoDistutilsTests(unittest.TestCase):
    def test_module_does_not_import_distutils(self):
        source = pathlib.Path(inspect.getfile(slugkit)).read_text(encoding="utf-8")
        imported = set()
        for node in ast.walk(ast.parse(source)):
            if isinstance(node, ast.Import):
                imported.update(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                imported.add(node.module)
        self.assertEqual(
            [name for name in sorted(imported) if name.split(".")[0] == "distutils"],
            [],
        )

    def test_module_does_not_reference_distutils_at_runtime(self):
        for name in ("LooseVersion", "StrictVersion", "Version"):
            self.assertFalse(hasattr(slugkit, name))


if __name__ == "__main__":
    unittest.main()
