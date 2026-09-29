import pathlib
import unittest

from slugkit import normalize_version, slugify


class SlugkitTests(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")

    def test_slugify_repeated_punctuation(self):
        self.assertEqual(slugify("Hello,,,   World!!!"), "hello-world")
        self.assertEqual(slugify("a---b___c"), "a-b-c")
        self.assertEqual(slugify("foo...bar"), "foo-bar")

    def test_normalize_version(self):
        self.assertEqual(normalize_version("1.2.0"), "1.2.0")
        self.assertEqual(normalize_version("2.0rc1"), "2.0rc1")

    def test_normalize_version_ordinary(self):
        for value in ["1.0", "1.2.3", "2.0", "1.0a1", "1.0b2", "1.0rc1"]:
            with self.subTest(value=value):
                self.assertEqual(normalize_version(value), value)

    def test_normalize_version_loose_fallback(self):
        # LooseVersion accepted arbitrary strings; the replacement
        # must not crash on them.
        self.assertEqual(normalize_version("hello"), "hello")
        self.assertEqual(normalize_version("1.2-foo"), "1.2-foo")

    def test_no_distutils_import(self):
        source = pathlib.Path(__file__).with_name("slugkit.py").read_text()
        self.assertNotIn("distutils", source)


if __name__ == "__main__":
    unittest.main()
