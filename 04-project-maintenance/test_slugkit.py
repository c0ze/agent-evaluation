import ast
import unittest
import warnings

import slugkit
from slugkit import normalize_version, slugify

# Versions whose output must stay identical to the pre-0.4.0 (distutils-based)
# implementation. Includes forms that a PEP 440 parser would rewrite
# ("1.02" -> "1.2", "1.0-beta" -> "1.0b0"), which must be left alone.
UNCHANGED_VERSIONS = [
    "1.2.0",
    "2.0rc1",
    "0.4.0",
    "1.0",
    "10.20.30",
    "1.2.3a1",
    "1.2.3b2",
    "1.0.dev1",
    "1.0.post1",
    "2024.11.14",
    "1.02.003",
    "1.0-beta",
    "1.0-beta.1",
    "v1.2.0",
    "1.0+local.1",
]


def _load_loose_version():
    """Return distutils' LooseVersion where it still exists, else None."""
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        try:
            from distutils.version import LooseVersion
        except ImportError:
            return None
    return LooseVersion


class SlugifyTests(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")

    def test_repeated_punctuation_collapses_to_one_hyphen(self):
        cases = {
            "a!!!b": "a-b",
            "Hello,,,   World!!!": "hello-world",
            "foo -- bar __ baz": "foo-bar-baz",
            "a.-_/b": "a-b",
            "---x---": "x",
            "release 0.4.0": "release-0-4-0",
        }
        for value, expected in cases.items():
            with self.subTest(value=value):
                self.assertEqual(slugify(value), expected)

    def test_only_punctuation_gives_empty_slug(self):
        self.assertEqual(slugify(" ?!... "), "")
        self.assertEqual(slugify(""), "")


class NormalizeVersionTests(unittest.TestCase):
    def test_normalize_version(self):
        self.assertEqual(normalize_version("1.2.0"), "1.2.0")
        self.assertEqual(normalize_version("2.0rc1"), "2.0rc1")

    def test_ordinary_versions_are_unchanged(self):
        for value in UNCHANGED_VERSIONS:
            with self.subTest(value=value):
                self.assertEqual(normalize_version(value), value)

    def test_empty_version_is_rejected(self):
        with self.assertRaises(ValueError):
            normalize_version("")

    def test_non_string_version_is_rejected(self):
        for value in (None, 0, 1, 1.2, b"1.2.0", ["1", "2"]):
            with self.subTest(value=value):
                with self.assertRaises(TypeError):
                    normalize_version(value)

    def test_no_warnings_are_emitted(self):
        with warnings.catch_warnings():
            warnings.simplefilter("error")
            self.assertEqual(normalize_version("1.2.0"), "1.2.0")

    def test_module_does_not_import_distutils(self):
        with open(slugkit.__file__, encoding="utf-8") as handle:
            tree = ast.parse(handle.read())
        imported = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imported.update(alias.name.split(".")[0] for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                imported.add(node.module.split(".")[0])
        self.assertNotIn("distutils", imported)

    def test_matches_distutils_where_it_still_exists(self):
        # Oracle check against the implementation that was replaced. It runs
        # on Python 3.10/3.11 (stdlib distutils) and skips on 3.12+, so it can
        # be deleted when 3.11 leaves the support range.
        loose_version = _load_loose_version()
        if loose_version is None:
            self.skipTest("distutils is not available on this interpreter")
        for value in UNCHANGED_VERSIONS:
            with self.subTest(value=value):
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    expected = str(loose_version(value))
                self.assertEqual(normalize_version(value), expected)


if __name__ == "__main__":
    unittest.main()
