import ast
import unittest
from pathlib import Path

import slugkit
from slugkit import normalize_version, slugify


class SlugkitTests(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")

    def test_slugify_repeated_punctuation(self):
        self.assertEqual(slugify("foo---bar!!  baz??"), "foo-bar-baz")
        self.assertEqual(slugify("...leading---and---trailing!!!"), "leading-and-trailing")
        self.assertEqual(slugify("!!!"), "")
        self.assertEqual(slugify(""), "")

    def test_normalize_version_ordinary(self):
        cases = {
            "1": "1",
            "1.0": "1.0",
            "1.2.0": "1.2.0",
            "0.4.0": "0.4.0",
            "1.2.3.4": "1.2.3.4",
            "2.0rc1": "2.0rc1",
            "2.0.0rc1": "2.0.0rc1",
            "1.2.0a1": "1.2.0a1",
            "1.2.0b2": "1.2.0b2",
            "1.2.0.post1": "1.2.0.post1",
            "1.2.0.dev0": "1.2.0.dev0",
            "1.2.0rc1.dev2": "1.2.0rc1.dev2",
            "1.2.0+local.1": "1.2.0+local.1",
            "1!2.0.0": "1!2.0.0",
        }
        for raw, expected in cases.items():
            with self.subTest(raw=raw):
                self.assertEqual(normalize_version(raw), expected)

    def test_normalize_version_canonicalization(self):
        cases = {
            "  1.2.0  ": "1.2.0",
            "v1.2.0": "1.2.0",
            "V1.02.003": "1.2.3",
            "0!1.2.0": "1.2.0",
            "2.0-rc1": "2.0rc1",
            "2.0RC1": "2.0rc1",
            "1.2.0-alpha.01": "1.2.0a1",
            "1.2.0.beta2": "1.2.0b2",
            "1.2.0-1": "1.2.0.post1",
            "1.2.0+Build_01-ABC": "1.2.0+build.1.abc",
        }
        for raw, expected in cases.items():
            with self.subTest(raw=raw):
                self.assertEqual(normalize_version(raw), expected)

    def test_normalize_version_invalid_strings(self):
        invalid_values = [
            "",
            "   ",
            "not-a-version",
            "1..2",
            "1.2.0+",
            "1.2.0+a..b",
            "1.2.0-foo",
            "1.2.0\n1.3.0",
        ]
        for raw in invalid_values:
            with self.subTest(raw=raw):
                with self.assertRaises(ValueError):
                    normalize_version(raw)

    def test_normalize_version_invalid_types(self):
        for bad in (None, 123, ["1.2.0"]):
            with self.subTest(bad=bad):
                with self.assertRaises(TypeError):
                    normalize_version(bad)

    def test_no_distutils_import(self):
        source = Path(slugkit.__file__).read_text(encoding="utf-8")
        tree = ast.parse(source)
        imported_roots: set[str] = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imported_roots.add(alias.name.split(".")[0])
            elif isinstance(node, ast.ImportFrom) and node.module:
                imported_roots.add(node.module.split(".")[0])
        self.assertNotIn("distutils", imported_roots)


if __name__ == "__main__":
    unittest.main()

